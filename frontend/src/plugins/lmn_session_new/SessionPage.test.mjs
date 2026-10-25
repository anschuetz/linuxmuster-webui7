import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import SessionPage from './SessionPage.vue';
import { getSessionStore } from './sessionStore.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
import { session as fileSession } from '../../../e2e/fixtures/session_files.mjs';
import { session, users } from '../../../e2e/fixtures/session_participants.mjs';
const mounted=[];
afterEach(()=>{mounted.forEach(w=>w.unmount()); mounted.length=0; vi.restoreAllMocks(); vi.useRealTimers();});
function setup(type='group', current=session(type)) {
    const calls=[], off=vi.fn(); let guard;
    const aj=createMockAj({identity:{user:'p93-ui',profile:{sophomorixRole:'teacher'}},guardLeave:fn=>{guard=fn;return off;},navigate:vi.fn(),pageTitle:{set:vi.fn()},http:async r=>{
        calls.push([r.method,r.url,r.data]); if(r.url.endsWith('/userInRoom'))return{data:{usersList:[],objects:{}}};
        if(r.url.includes('/user-search/'))return{data:users()}; if(r.url.includes('/schoolClass-search/'))return{data:[{cn:'p93-class',membersCount:2,sophomorixMembers:['p93-a','p93-c']}]};
        return{data:r.url.endsWith('/userinfo')?r.data.users.map(cn=>users().find(u=>u.cn===cn)):{}};
    }});
    const store=getSessionStore(aj);store.state.current=current; const wrapper=mount(SessionPage,{global:{provide:{aj}}});mounted.push(wrapper);
    return{wrapper,store,aj,calls,off,get guard(){return guard;}};
}
it('redirects empty SID with legacy empty workdir request and without polling',async()=>{
    const s=setup('group',{sid:'',members:[]});await flushPromises();expect(s.aj.navigate.mock.calls).toEqual([['/view/lmn/sessionsList']]);expect(s.calls).toEqual([['post','/api/lmn/smbclient/createSessionWorkingDirectory',{users:[]}]]);
});
it('mount owns immediate room polling/file timer and removes guard/listeners/timers on unmount',async()=>{
    vi.useFakeTimers();const s=setup('room');await flushPromises();expect(s.calls.map(c=>c[1])).toEqual(['/api/lmn/smbclient/createSessionWorkingDirectory','/api/lmn/session/userInRoom']);
    await s.wrapper.get('[data-files-start]').trigger('click');await flushPromises();await vi.advanceTimersByTimeAsync(5000);expect(s.calls.filter(c=>c[1].endsWith('/listCollectDir')).length).toBe(2);
    await s.wrapper.get('[data-files-stop]').trigger('click');await s.wrapper.get('[data-room-toggle]').trigger('click');expect(vi.getTimerCount()).toBe(0);
    await s.wrapper.get('[data-room-toggle]').trigger('click');s.wrapper.unmount();expect(s.off.mock.calls).toEqual([[]]);expect(vi.getTimerCount()).toBe(0);const n=s.calls.length;await vi.advanceTimersByTimeAsync(10000);expect(s.calls.length).toBe(n);
});
it('typeaheads trim only model, retain inner spaces, choose/clear, and generated leave/unload cancel/accept',async()=>{
    const s=setup('schoolclass');await flushPromises();const input=s.wrapper.findAll('input')[1];let value='';for(const c of '  inner space  '){value+=c;await input.setValue(value);await flushPromises();}
    expect(s.calls.filter(c=>c[1].includes('schoolClass-search/')).at(-1)[1]).toBe('/api/lmn/session/schoolClass-search/inner space');
    await s.wrapper.get('[data-classes] button').trigger('click');await flushPromises();expect(input.element.value).toBe('');expect(s.store.state.current.members.length).toBe(3);
    const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);expect(s.guard()).toBe(false);expect(confirm.mock.calls.length).toBe(1);
    const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);expect(s.aj.navigate.mock.calls.filter(c=>c[0].endsWith('sessionsList'))).toEqual([]);
    confirm.mockReturnValue(true);await s.wrapper.get('[data-close]').trigger('click');expect(s.aj.navigate.mock.calls.at(-1)).toEqual(['/view/lmn/sessionsList']);s.wrapper.unmount();expect(s.off.mock.calls).toEqual([[]]);
});
it('renders directory names before files, student/teacher notice and real removal control',async()=>{
    const s=setup('group',{...session(),members:users().map(u=>({...u,files_error:'',files:[{name:'z.txt',isFile:true,isDir:false},{name:'dir',isDir:true}]}))});await flushPromises();
    expect(s.wrapper.findAll('[data-remove]').length).toBe(3);const row=s.wrapper.findAll('tr').find(r=>r.text().includes('Zulu'));expect(row.text().indexOf('dir')).toBeLessThan(row.text().indexOf('z.txt'));
    expect(s.wrapper.text()).toContain("It's currently not possible to create share directory");await s.wrapper.get('[data-remove]').trigger('click');await flushPromises();expect(s.store.state.current.members.length).toBe(2);
});
it('identity change tears down polling and redirects, old beforeunload handler is removed',async()=>{
    vi.useFakeTimers();const s=setup('room');await flushPromises();s.aj.identity.user='other';await flushPromises();expect(vi.getTimerCount()).toBe(0);expect(s.aj.navigate.mock.calls.at(-1)).toEqual(['/view/lmn/sessionsList']);
    s.wrapper.unmount();const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);expect(e.defaultPrevented).toBe(false);
});
it('detail group actions reuse part 1 payloads, cancel keeps name, generated save clears leave flag',async()=>{
    const s=setup();await flushPromises();s.aj.messagebox.prompt=vi.fn().mockRejectedValueOnce('cancel').mockResolvedValueOnce({value:'p93-renamed'}).mockResolvedValueOnce({value:'p93-copy'});
    await s.wrapper.get('[data-rename]').element.closest('.c6-group-actions').querySelector('button').click(); await flushPromises();
    expect(s.wrapper.get('[data-rename]').element.closest('.dropdown-menu').classList.contains('show')).toBe(true);
    await s.wrapper.get('[data-rename]').trigger('click');await flushPromises();expect(s.store.state.current.name).toBe('p93-fixture');
    await s.wrapper.get('[data-rename]').trigger('click');await flushPromises();expect(s.store.state.current.name).toBe('p93-renamed');
    await s.wrapper.get('[data-clone]').trigger('click');await flushPromises();expect(s.calls.filter(c=>c[1].includes('/sessions'))).toEqual([
        ['post','/api/lmn/session/sessions',{action:'rename-session',session:'p93-fixture',comment:'p93-renamed'}],['put','/api/lmn/session/sessions/p93-copy',{members:['p93-a','p93-b']}],
    ]);
    await s.wrapper.get('[data-kill]').trigger('click');await flushPromises();expect(s.calls.at(-1)).toEqual(['delete','/api/lmn/session/sessions/p93-fixture',undefined]);
    s.wrapper.unmount();const t=setup('schoolclass');await flushPromises();await t.wrapper.findAll('input')[1].setValue('p');await flushPromises();await t.wrapper.get('[data-classes] button').trigger('click');await flushPromises();
    t.aj.messagebox.prompt=vi.fn().mockResolvedValue({value:'p93-saved'});await t.wrapper.get('[data-save]').trigger('click');await flushPromises();expect(t.calls.at(-1)).toEqual(['put','/api/lmn/session/sessions/p93-saved',{members:['p93-a','p93-b','p93-c']}]);expect(t.guard()).toBe(true);
});
it('user typeahead supports keyboard choice, duplicates keep label, Escape and blur close results',async()=>{
    const s=setup();await flushPromises();const input=s.wrapper.findAll('input')[0];await input.setValue('p9');await flushPromises();
    await input.trigger('keydown',{key:'ArrowDown'});await input.trigger('keydown',{key:'Tab'});await flushPromises();expect(input.element.value).toContain('p93-b');expect(s.calls.filter(c=>c[1].endsWith('/participants'))).toEqual([]);
    await input.setValue('p9');await flushPromises();await input.trigger('keydown',{key:'ArrowUp'});await input.trigger('keydown',{key:'Enter'});await flushPromises();expect(s.store.state.current.members.length).toBe(3);expect(input.element.value).toBe('');
    await input.setValue('p9');await flushPromises();await input.trigger('keydown',{key:'Escape'});expect(s.wrapper.findAll('[data-users] button').length).toBe(0);
    await input.setValue('p93');await flushPromises();await input.trigger('blur');expect(s.wrapper.findAll('[data-users] button').length).toBe(0);
});
it('detail entry remount retains session but owns and destroys its timer and guard',async()=>{
    vi.useFakeTimers();const {mountDetail}=await import('./entry.mjs'), off=vi.fn();
    const aj=createMockAj({identity:{user:'p93-entry',profile:{sophomorixRole:'teacher'}},guardLeave:()=>off,http:async r=>({data:r.url.endsWith('/userInRoom')?{usersList:[],objects:{}}:{}})}),store=getSessionStore(aj);
    store.state.current=session('room');const el=document.createElement('div');let unmount=mountDetail(el,aj);await flushPromises();expect(el.querySelectorAll('input:not([type=checkbox])').length).toBe(2);expect(vi.getTimerCount()).toBe(1);unmount();expect(vi.getTimerCount()).toBe(0);expect(el.innerHTML).toBe('');
    unmount=mountDetail(el,aj);await flushPromises();expect(store.state.current.name).toBe('this_room-autogenerated');unmount();expect(off.mock.calls).toEqual([[],[]]);expect(vi.getTimerCount()).toBe(0);
});

it('places transfers between Users and Working directory with an empty foreign-exam cell', async () => {
    const s = setup('group', fileSession(true)); s.store.filterExamUsers(); await flushPromises();
    expect(s.wrapper.findAll('thead th').map(h => h.element.firstChild?.textContent ?? '')).toEqual(['Users', 'Transfer', 'Working directory', '', '', '', '', '', '']);
    const rows = s.wrapper.findAll('tbody tr');
    const own = rows.find(row => row.findAll('td')[0].text().includes('p94-1')).findAll('td');
    expect(own).toHaveLength(9);
    expect(own[1].find('[data-share-user]').exists()).toBe(true);
    expect(own[1].find('[data-collect-toggle]').exists()).toBe(true);
    expect(own[2].find('button').exists()).toBe(false);
    expect(own[8].find('[data-remove]').exists()).toBe(true);
    const foreign = rows.find(row => row.findAll('td')[0].text().includes('p94-0')).findAll('td');
    expect(foreign).toHaveLength(9);
    expect(foreign[1].text()).toBe('');
    expect(foreign[1].find('button').exists()).toBe(false);
});

it('management row sends old checkbox value, keeps canonical group references, and shows the Ajenti busy spinner',async()=>{
    const s=setup('group',fileSession());await flushPromises();let resolve;
    s.aj.http.post=vi.fn(()=>new Promise(r=>resolve=r));
    await s.wrapper.get('[data-management-wifi]').setValue(true);
    expect(s.aj.http.post.mock.calls).toEqual([['/api/lmn/managementgroup',{group:'wifi',users:['p94-0']}]]);
    expect(s.store.state.current.members[0].wifi).toBe(true);
    expect(s.wrapper.find('progress-spinner .one').exists()).toBe(true);
    resolve({data:{}});await flushPromises();expect(s.wrapper.find('progress-spinner').exists()).toBe(false);
});

it('omits exam, management and password cells for non-students as in Angular', async () => {
    const s = setup('group', { ...session(), members: users() }); await flushPromises();
    const row = s.wrapper.findAll('tbody tr').find(row => row.get('td i').text() === 'p93-c');
    const cells = row.findAll('td');
    expect(cells).toHaveLength(4);
    expect(cells[3].find('[data-remove]').exists()).toBe(true);
    expect(row.find('[data-exam-start-user], [data-exam-stop-user], [data-management], input[type="password"]').exists()).toBe(false);
});
