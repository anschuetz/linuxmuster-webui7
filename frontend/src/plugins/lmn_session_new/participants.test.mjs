import { afterEach, expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { getSessionStore } from './sessionStore.mjs';
import { createParticipants, sortedParticipants, sortedFiles } from './participants.mjs';
import { createPolling } from './polling.mjs';
import { session, users } from '../../../e2e/fixtures/session_participants.mjs';
const A = '/api/lmn/session/', M = '/api/lmn/smbclient/';
function setup(type = 'group') {
    const calls = [], notices = [], responses = {};
    const aj = createMockAj({ identity: { user: 'p93-owner', refresh: vi.fn(async () => {}) }, navigate: vi.fn(), notify: (...args) => notices.push(args), http: async r => {
        calls.push([r.method, r.url, r.data]); if (responses[r.url] instanceof Error) throw responses[r.url];
        return { data: responses[r.url] ?? (r.url === A + 'userinfo' ? r.data.users.map(cn => users().find(u => u.cn === cn)) : {}) };
    }, messagebox: { prompt: vi.fn(async () => ({ value: 'fixture-pw' })) } });
    const store = getSessionStore(aj); store.state.current = session(type); store.state.user_missing_membership = [];
    return { aj, store, calls, notices, responses, api: createParticipants(aj, store) };
}
afterEach(() => vi.useRealTimers());
it('deduplicates users/classes and preserves real add/refresh/remove payloads', async () => {
    const s = setup(); await s.api.addUser(users()[0]); expect(s.calls).toEqual([]);
    expect(s.notices).toEqual([['success', 'p93-a is already member of the course.', undefined]]);
    await s.api.addClass({ sophomorixMembers: ['p93-a','p93-c'] });
    expect(s.calls).toEqual([
        ['post', A+'userinfo', {users:['p93-c']}], ['post', A+'participants', {users:['p93-c'],session:'p93-fixture'}],
        ['post', A+'userinfo', {users:['p93-a','p93-b','p93-c']}], ['post', M+'createSessionWorkingDirectory', {users:['p93-a','p93-b']}],
    ]);
    await s.api.addClass({sophomorixMembers:['p93-a']}); expect(s.calls.length).toBe(4);
    await s.api.remove(s.store.state.current.members[1]); expect(s.calls.at(-1)).toEqual(['patch',A+'participants',{users:['p93-b'],session:'p93-fixture'}]);
    expect(s.store.state.current.members.map(u=>u.cn)).toEqual(['p93-a','p93-c']); expect(s.api.sessionChanged.value).toBe(false);
});
it('generated membership changes client only, replaces arrays, unknown removal does nothing', async () => {
    const s = setup('schoolclass'), before = s.store.state.current.members; await s.api.addUser(users()[2]);
    expect(before).toEqual(users().slice(0,2)); expect(s.api.sessionChanged.value).toBe(true); expect(s.calls.some(c=>c[1]===A+'participants')).toBe(false);
    await s.api.remove(s.store.state.current.members[0]); await s.api.remove(users()[0]); expect(s.store.state.current.members.map(u=>u.cn)).toEqual(['p93-b','p93-c']);
});
it('failed removal/user lookup preserves state; failed optimistic add still refreshes as legacy', async () => {
    const s = setup(); s.responses[A+'participants'] = new Error('denied'); await expect(s.api.remove(s.store.state.current.members[0])).rejects.toThrow('denied');
    expect(s.store.state.current.members).toEqual(users().slice(0,2)); s.responses[A+'userinfo']=new Error('offline'); await expect(s.api.addUser(users()[2])).rejects.toThrow('offline'); expect(s.api.sessionChanged.value).toBe(false);
    delete s.responses[A+'userinfo']; await s.api.addUser(users()[2]); expect(s.store.state.current.members.map(u=>u.cn)).toEqual(['p93-a','p93-b','p93-c']);
});
it('empty room retains users, nonempty attaches COMPUTER without mkdir or exam recalculation', async () => {
    const s=setup('room'); s.responses[A+'userInRoom']={usersList:[],objects:{}}; await s.api.updateParticipants(); expect(s.store.state.current.members).toEqual(users().slice(0,2));
    s.responses[A+'userInRoom']={usersList:['p93-c'],objects:{'p93-c':{COMPUTER:'pc'}}}; await s.api.updateParticipants(); expect(s.store.state.current.members).toEqual([{...users()[2],computer:'pc'}]); expect(s.calls.length).toBe(3);
});
it('workdir teacher exclusion, global and per-user errors, persistent missing membership', async () => {
    const s=setup(); s.store.state.current={...session(),members:users()}; s.responses[M+'createSessionWorkingDirectory']={global:'offline','p93-a':'missing'}; await s.api.createWorkingDirectory(s.store.state.current.members);
    expect(s.calls).toEqual([['post',M+'createSessionWorkingDirectory',{users:['p93-a','p93-b']}]]); expect(s.store.state.current.members.map(u=>u.files_error)).toEqual(['NOTJOINED','offline','offline']); expect(s.api.missingClasses.value).toBe('p93-class'); expect(s.notices).toEqual([['error','offline',undefined,{sticky:true}]]);
    s.responses[M+'createSessionWorkingDirectory']={}; await s.api.createWorkingDirectory(s.store.state.current.members); expect(s.store.state.current.members.map(u=>u.files_error)).toEqual(['','','']); expect(s.store.state.user_missing_membership.map(u=>u.cn)).toEqual(['p93-a']);
});
it('listCollectDir filters files sentinel rather than files_error and reports missing items permanently', async () => {
    const s=setup(); s.store.state.current={...session(),members:[{...users()[0],files:'ERROR'},{...users()[1],files_error:'NOTJOINED',files:[]}]};
    s.responses[M+'listCollectDir']={'p93-b':{items:[{name:'fixture'}]},unknown:'ignored'}; await s.api.updateFileList(); expect(s.calls).toEqual([['post',M+'listCollectDir',{participants:[{...users()[1],files_error:'NOTJOINED',files:[]}]}]]); expect(s.store.state.current.members[1].files).toEqual([{name:'fixture'}]);
    s.responses[M+'listCollectDir']={'p93-b':'missing'}; await s.api.updateFileList(); expect(s.notices).toEqual([['error','Can not list directory from Zoe Alpha: missing',undefined,{sticky:true}]]);
});
it('membership ERROR stops; LOG invokes masked kerberos, workdir and identity refresh', async () => {
    const s=setup(); s.responses[M+'createSessionWorkingDirectory']={'p93-a':'missing'}; await s.api.createWorkingDirectory(s.store.state.current.members);
    s.responses['/api/lmn/groupmembership/membership']=['ERROR','denied']; await s.api.fixMembership(); expect(s.aj.messagebox.prompt.mock.calls).toEqual([]);
    s.responses['/api/lmn/groupmembership/membership']=['LOG','joined']; s.responses[M+'refresh_krbcc']={type:'success',msg:'renewed'}; s.responses[M+'createSessionWorkingDirectory']={}; await s.api.fixMembership();
    expect(s.aj.messagebox.prompt.mock.calls).toEqual([['Please give your password:','','password']]); expect(s.aj.identity.refresh.mock.calls).toEqual([[]]); expect(s.api.missingClasses.value).toEqual([]); expect(s.store.state.current.members[0].files).toEqual([]);
    expect(s.calls.at(-3)).toEqual(['post','/api/lmn/groupmembership/membership',{action:'addadmins',entity:'p93-owner',groupname:'p93-class',type:'class'}]); expect(s.calls.at(-2)).toEqual(['post',M+'refresh_krbcc',{pw:'fixture-pw'}]); expect(s.calls.at(-1)).toEqual(['post',M+'createSessionWorkingDirectory',{users:['p93-a']}]);
});
it('kerberos rejection/cancellation and identity failure retain missing classes', async () => {
    const s=setup(); s.responses[M+'createSessionWorkingDirectory']={'p93-a':'missing'}; await s.api.createWorkingDirectory(s.store.state.current.members); s.responses[M+'refresh_krbcc']={type:'error',msg:'bad'};
    await expect(s.api.refreshKerberos()).rejects.toBeUndefined(); expect(s.aj.identity.refresh.mock.calls).toEqual([]); expect(s.api.missingClasses.value).toBe('p93-class');
    s.aj.messagebox.prompt.mockRejectedValueOnce('cancel'); await expect(s.api.refreshKerberos()).rejects.toBe('cancel'); s.responses[M+'refresh_krbcc']={}; s.responses[M+'createSessionWorkingDirectory']={}; s.aj.identity.refresh.mockRejectedValueOnce(new Error('identity')); await expect(s.api.refreshKerberos()).rejects.toThrow('identity'); expect(s.api.missingClasses.value).toBe('p93-class');
});
it('search minimum lengths and ten-result limits retain exact URLs', async () => {
    const s=setup(); s.responses[A+'user-search/aa']=Array(12).fill(users()[0]); s.responses[A+'schoolClass-search/a']=[{cn:'class'}]; expect(await s.api.findUsers('a')).toEqual([]); expect(await s.api.findClasses('')).toEqual([]); expect(s.calls).toEqual([]);
    expect((await s.api.findUsers('aa')).length).toBe(10); expect(await s.api.findClasses('a')).toEqual([{cn:'class'}]); expect(s.calls.map(c=>c[1])).toEqual([A+'user-search/aa',A+'schoolClass-search/a']);
});
it('disposal and owner/session changes discard pending responses', async () => {
    const s=setup(); let resolve; s.aj.http.post=()=>new Promise(r=>{resolve=r;}); const pending=s.api.addUser(users()[2]); s.api.dispose(); resolve({data:[users()[2]]}); await pending; expect(s.store.state.current.members).toEqual(users().slice(0,2)); await s.api.addUser(users()[0]); expect(s.notices).toEqual([]);
    const t=setup(); t.aj.http.get=()=>new Promise(r=>{resolve=r;}); const room=t.api.updateParticipants(); t.aj.identity.user='another'; resolve({data:{usersList:[],objects:{}}}); await room; expect(t.store.state.current.members).toEqual(users().slice(0,2));

    const u=setup(); u.aj.http.post=()=>new Promise(r=>{resolve=r;}); const old=u.api.createWorkingDirectory(u.store.state.current.members); u.store.reset(); u.store.state.current=session(); resolve({data:{'p93-a':'missing'}}); await old; expect(u.store.state.user_missing_membership).toEqual([]);
});
it('four stable Angular string sorts and directories-first name sort', () => {
    expect([0,1,2,3].map(i=>sortedParticipants(users(),i).map(u=>u.cn))).toEqual([['p93-b','p93-c','p93-a'],['p93-a','p93-b','p93-c'],['p93-a','p93-c','p93-b'],['p93-b','p93-a','p93-c']]);
    expect(sortedFiles([{name:'z',isDir:false},{name:'b',isDir:true},{name:'A',isDir:true}])).toEqual([{name:'A',isDir:true},{name:'b',isDir:true},{name:'z',isDir:false}]);
});
it('immediate/5s polling survives errors, replaces timer on start, stops/disposes all timers', async () => {
    vi.useFakeTimers(); const task=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined), poll=createPolling(task); poll.start(); expect(poll.active.value).toBe(true); expect(task.mock.calls.length).toBe(1);
    await vi.advanceTimersByTimeAsync(5000); expect(task.mock.calls.length).toBe(2); poll.start(); expect(task.mock.calls.length).toBe(3); expect(vi.getTimerCount()).toBe(1); poll.stop(); await vi.advanceTimersByTimeAsync(5000); expect(task.mock.calls.length).toBe(3); expect(poll.active.value).toBe(false);
    poll.start(); poll.dispose(); poll.start(); await vi.advanceTimersByTimeAsync(5000); expect(task.mock.calls.length).toBe(4); expect(vi.getTimerCount()).toBe(0);
});
it('real removal keeps the legacy captured-index behavior after an intervening member refresh',async()=>{
    const s=setup();let resolve;s.aj.http.patch=()=>new Promise(r=>{resolve=r;});const pending=s.api.remove(s.store.state.current.members[0]);
    s.store.state.current={...s.store.state.current,members:s.store.state.current.members.map(u=>({...u}))};resolve({data:[]});await pending;expect(s.store.state.current.members.map(u=>u.cn)).toEqual(['p93-b']);
});
it('disposed kerberos action never opens a prompt or sends a credential request',async()=>{
    const s=setup();s.api.dispose();await s.api.refreshKerberos();expect(s.aj.messagebox.prompt.mock.calls).toEqual([]);expect(s.calls).toEqual([]);
});
it('identity replacement and session reset dispose the file timer retained by the store',async()=>{
    vi.useFakeTimers();
    for(const reset of [s=>s.store.reset(),s=>getSessionStore(createMockAj({identity:{user:'p93-other'}}))]){
        const s=setup(),poll=createPolling(vi.fn().mockResolvedValue(undefined));s.store.state.filePolling=poll;poll.start();expect(vi.getTimerCount()).toBe(1);
        reset(s);expect(s.store.state.filePolling).toBeUndefined();expect(poll.active.value).toBe(false);expect(vi.getTimerCount()).toBe(0);
    }
});
