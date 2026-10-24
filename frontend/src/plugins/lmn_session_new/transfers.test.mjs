import { expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { createTransfers, collectStamp } from './transfers.mjs';
import { session, users, teacherHome, items } from '../../../e2e/fixtures/session_files.mjs';
const M='/api/lmn/smbclient/';
function setup(foreign=false) {
    const calls=[], notices=[], open=vi.fn().mockResolvedValue({response:'accept',items:items('own').slice(0,1)}), show=vi.fn().mockResolvedValue({});
    const aj=createMockAj({identity:{user:'p94-teacher',profile:{homeDirectory:teacherHome,sAMAccountName:'p94-teacher'}},modal:{open},messagebox:{show},notify:(...a)=>notices.push(a),http:async r=>{calls.push([r.url,r.data]);return{data:{}};}});
    const store={state:{current:session(foreign),extExamUsers:foreign?[users()[0]]:[],user_missing_membership:[]}}, participants={missingClasses:{value:undefined},isCurrent:()=>true,createWorkingDirectory:vi.fn(async u=>{calls.push(['workdir',u.map(u=>u.cn)]);})};
    const api=createTransfers(aj,store,participants,()=>new Date(2026,9,24,12,34,56));return{api,aj,store,participants,calls,notices,open,show};
}
it('formats local clock fields and leading zeros',()=>{expect(collectStamp(new Date(2026,0,2,3,4,5))).toBe('20260102-030405');});
it('shares student/examuser sequentially in source order; single cancel and nonaccept do nothing',async()=>{
    const s=setup();s.open.mockResolvedValue({response:'accept',items:items('own').slice(0,2)});await s.api.shareAll();
    expect(s.calls).toEqual(users().slice(0,2).flatMap(u=>['z.txt','collected'].map(n=>[M+'copy',{src:'own/'+n,dst:u.homeDirectory+'\\transfer\\p94-teacher/'+n}])));
    expect(s.open.mock.calls[0][1]).toEqual({path:teacherHome+'\\transfer',printPath:'transfer',action:'share',user:'all'});
    s.open.mockRejectedValueOnce(new Error('cancel'));await expect(s.api.shareUser(users()[0])).rejects.toThrow('cancel');s.open.mockResolvedValueOnce({response:'no'});await s.api.shareUser(users()[0]);expect(s.calls.length).toBe(4);
});
it('foreign exam blocks both all operations before dialogs or writes',async()=>{const s=setup(true);await s.api.shareAll();await s.api.collectAll('move');expect(s.calls).toEqual([]);expect(s.open.mock.calls).toEqual([]);expect(s.show.mock.calls.length).toBe(2);});
it.each(['copy','move'])('collect-all %s creates timestamp directory then transfers filtered users then recreates for all',async op=>{
    const s=setup();await s.api.collectAll(op);const dest=teacherHome+'\\transfer\\collected\\group_p94_20261024-123456';
    expect(s.calls).toEqual([[M+'directory',{path:dest}],...users().slice(0,2).map(u=>[M+op,{src:u.homeDirectory+'\\transfer\\p94-teacher\\_collect',dst:dest+'\\'+u.sAMAccountName+'/'}]),['workdir',['p94-0','p94-1','p94-2']]]);
});
it('collect-user creates directory before dialog/cancel; archive is browsing only',async()=>{
    const s=setup(),user=users()[0];s.open.mockRejectedValueOnce(new Error('cancel'));await expect(s.api.collectUser('move',user)).rejects.toThrow();expect(s.calls.length).toBe(1);
    await s.api.collectUser('copy',user);expect(s.calls.at(-1)).toEqual([M+'copy',{src:'own/z.txt',dst:teacherHome+'\\transfer\\collected\\group_p94_20261024-123456\\p94-0/z.txt'}]);expect(s.participants.createWorkingDirectory.mock.calls).toEqual([]);
    await s.api.browseCollected();expect(s.open.mock.calls.at(-1)[1]).toEqual({path:teacherHome+'\\transfer\\collected',printPath:teacherHome+'\\transfer\\collected',action:'',user:''});
});
it('awaits each copy before starting the next; invalid owner stops after current write',async()=>{
    const s=setup();let done; s.aj.http.post=vi.fn(()=>new Promise(resolve=>{done=()=>resolve({data:{}});}));const promise=s.api.shareAll();await Promise.resolve();await Promise.resolve();expect(s.aj.http.post.mock.calls.length).toBe(1);s.participants.isCurrent=()=>false;done();await promise;expect(s.aj.http.post.mock.calls.length).toBe(1);
});
it('single share targets one user, transfer errors are reported by shared SMB and legacy sequence continues',async()=>{
    const s=setup();s.aj.http.post=vi.fn().mockRejectedValue({data:{message:'fixture denied'}});await s.api.shareUser(users()[1]);
    expect(s.aj.http.post.mock.calls).toEqual([[M+'copy',{src:'own/z.txt',dst:users()[1].homeDirectory+'\\transfer\\p94-teacher/z.txt'}]]);expect(s.notices.map(n=>n.slice(0,2))).toEqual([['error','fixture denied'],['success','File z.txt shared to p94-1!']]);
});
it('collect cancellation result creates only the legacy empty target; stale modal cannot transfer for a different session',async()=>{
    const s=setup();s.open.mockResolvedValueOnce({response:'cancel'});await s.api.collectUser('move',users()[0]);expect(s.calls.length).toBe(1);
    let resolve;s.open.mockReturnValueOnce(new Promise(r=>{resolve=r;}));const pending=s.api.shareUser(users()[0]);s.participants.isCurrent=()=>false;resolve({response:'accept',items:items('own')});await pending;expect(s.calls.length).toBe(1);
    await s.api.shareAll();await s.api.shareUser(users()[0]);await s.api.collectAll('copy');await s.api.collectUser('copy',users()[0]);await s.api.browseCollected();expect(s.calls.length).toBe(1);expect(s.open.mock.calls.length).toBe(2);
});
it('collect-all refreshes missing-class display after working directory recreation',async()=>{
    const s=setup();s.store.state.user_missing_membership=[{sophomorixAdminClass:'p94-class'},{sophomorixAdminClass:'p94-class'}];await s.api.collectAll('move');await Promise.resolve();expect(s.participants.missingClasses.value).toBe('p94-class,p94-class');
});
