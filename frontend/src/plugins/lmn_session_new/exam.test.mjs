import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { getSessionStore } from './sessionStore.mjs';
import { createParticipants } from './participants.mjs';
import { createExam } from './exam.mjs';
import { session, users } from '../../../e2e/fixtures/session_exam.mjs';
vi.mock('../../common/wait.mjs', () => ({ openWait: vi.fn(() => ({ close: vi.fn() })) }));
import { openWait } from '../../common/wait.mjs';
const A='/api/lmn/session/';
afterEach(()=>vi.clearAllMocks());
function setup(mode='mixed',handler) {
    const calls=[],notify=vi.fn();
    const aj=createMockAj({identity:{user:'p95-teacher'},navigate:vi.fn(),notify,messagebox:{show:vi.fn().mockResolvedValue({})},http:async r=>{
        calls.push([r.method,r.url,structuredClone(r.data)]);if(handler){const result=await handler(r);if(result)return result;}
        if(r.url===A+'exam/userinfo')return{data:r.data.users.map(cn=>({...users('p95-teacher','none').find(u=>u.cn===cn),cn:cn+'-exam',examTeacher:'p95-teacher',examMode:true}))};
        return{data:r.url===A+'userinfo'?users('p95-teacher','none'):{}};
    }});
    const store=getSessionStore(aj);store.reset();store.state.current=session('p95-teacher',mode);store.filterExamUsers();store.state.filePolling={stop:vi.fn(),dispose:vi.fn()};
    const participants=createParticipants(aj,store),api=createExam(aj,store,participants);return{aj,store,participants,api,calls,notify};
}
it('single start payload, splice/append, groups, directory and file timer stop after refresh',async()=>{
    const s=setup('none'),original=s.store.state.current.members;await s.api.startExam('p95-0');await flushPromises();
    expect(s.calls).toEqual([['patch',A+'exam/start',{session:{members:[{cn:'p95-0'}]}}],['post',A+'exam/userinfo',{users:['p95-0']}],['post','/api/lmn/smbclient/createSessionWorkingDirectory',{users:['p95-1','p95-0-exam']}]]);
    expect(s.store.state.current.members.map(u=>u.cn)).toEqual(['p95-1','p95-2','p95-0-exam']);expect(original.map(u=>u.cn)).toEqual(['p95-0','p95-1','p95-2']);expect(s.store.state.examUsers.map(u=>u.cn)).toEqual(['p95-0-exam']);expect(s.store.state.filePolling.stop.mock.calls).toEqual([[]]);expect(s.store.state.stateChanged).toBe(false);expect(openWait.mock.results[0].value.close.mock.calls).toEqual([[]]);
});
it('whole start sends complete session, refreshes all, guards all-exam and cancels',async()=>{
    const s=setup('none'),initial=structuredClone(s.store.state.current);await s.api.startExam();expect(s.calls[0]).toEqual(['patch',A+'exam/start',{session:initial}]);expect(s.calls[1]).toEqual(['post',A+'exam/userinfo',{users:['p95-0','p95-1','p95-2']}]);
    const n=s.calls.length;await s.api.startExam();expect(s.calls.length).toBe(n);s.store.state.examMode=false;s.aj.messagebox.show.mockRejectedValueOnce('cancel');await expect(s.api.startExam()).rejects.toBe('cancel');expect(s.calls.length).toBe(n);
});
it('whole stop clears mode/stops timer before response, closes wait without awaiting refresh',async()=>{
    let release,resolveRefresh;const s=setup('own',r=>r.url===A+'exam/stop'?new Promise(resolve=>release=()=>resolve({data:{}})):r.url===A+'userinfo'?new Promise(resolve=>resolveRefresh=resolve):undefined);
    const initial=structuredClone(s.store.state.current),pending=s.api.stopExam();await flushPromises();expect(s.store.state.examMode).toBe(false);expect(s.store.state.stateChanged).toBe(true);expect(s.store.state.filePolling.stop.mock.calls).toEqual([[]]);
    release();await pending;expect(s.store.state.stateChanged).toBe(false);expect(s.calls[0]).toEqual(['patch',A+'exam/stop',{session:initial}]);expect(openWait.mock.results[0].value.close.mock.calls).toEqual([[]]);resolveRefresh({data:[]});await flushPromises();s.store.state.examMode=false;const n=s.calls.length;await s.api.stopExam();expect(s.calls.length).toBe(n);
});
it('mixed stop is serial foreign then own with ENDED_FROM names; leaves busy and file timer alone',async()=>{
    const releases=[];const s=setup('mixed',r=>r.url===A+'exam/stop'?new Promise(resolve=>releases.push(()=>resolve({data:{}}))):undefined);const pending=s.api.stopRunningExams();await flushPromises();expect(s.calls.length).toBe(1);expect(s.store.state.stateChanged).toBe(false);releases[0]();await flushPromises();expect(s.calls.length).toBe(2);releases[1]();await pending;
    expect(s.calls.slice(0,2)).toEqual(users('p95-teacher').slice(0,2).map(u=>['patch',A+'exam/stop',{session:{members:[u],name:`p95-class_${u.sAMAccountName}_ENDED_FROM_p95-teacher`,type:''}}]));expect(s.store.state.filePolling.stop.mock.calls).toEqual([]);expect(s.notify.mock.calls.at(-1)).toEqual(['success','Exam mode stopped for all users.',undefined]);
});
it('single stop confirms display/teacher and awaits refresh before closing wait',async()=>{
    let resolveRefresh;const s=setup('mixed',r=>r.url===A+'userinfo'?new Promise(resolve=>resolveRefresh=resolve):undefined),pending=s.api.stopUserExam(s.store.state.current.members[0]);await flushPromises();expect(openWait.mock.results[0].value.close.mock.calls).toEqual([]);expect(s.aj.messagebox.show.mock.calls).toEqual([[{text:'Do you really want to remove P95 User0 from the exam of p95-other?',positive:'End exam mode',negative:'Cancel'}]]);resolveRefresh({data:[]});await pending;expect(openWait.mock.results[0].value.close.mock.calls).toEqual([[]]);expect(s.notify.mock.calls.at(-1)).toEqual(['success','Exam mode stopped for user P95 User0',undefined]);expect(s.store.state.stateChanged).toBe(false);
});
it.each(['startExam','stopExam'])('rejected %s retains legacy hanging wait/stateChanged',async action=>{
    const s=setup(action==='startExam'?'none':'own',r=>r.method==='patch'?Promise.reject(new Error('denied')):undefined);await expect(s.api[action]()).rejects.toThrow('denied');expect(s.store.state.stateChanged).toBe(true);expect(openWait.mock.results[0].value.close.mock.calls).toEqual([]);expect(s.calls.length).toBe(1);expect(s.store.state.filePolling.stop.mock.calls.length).toBe(action==='stopExam'?1:0);
});
it('management single no-prefix, bulk role filter/persistent toggle; error clears busy without rollback',async()=>{
    const s=setup('none'),initial=s.store.state.current.members;await s.api.setManagementGroup('internet',initial[0]);expect(s.calls[0]).toEqual(['post','/api/lmn/managementgroup',{group:'nointernet',users:['p95-0']}]);await s.api.setManagementGroupAll('wifi');await s.api.setManagementGroupAll('wifi');expect(s.calls.slice(1)).toEqual([['post','/api/lmn/managementgroup',{group:'wifi',users:['p95-0','p95-1']}],['post','/api/lmn/managementgroup',{group:'nowifi',users:['p95-0','p95-1']}]]);expect(initial.map(u=>u.wifi)).toEqual([false,false,false]);
    s.aj.http.post=vi.fn().mockRejectedValue({data:{message:'LMN API unavailable'}});await s.api.setManagementGroupAll('wifi');expect(s.store.state.current.members.map(u=>u.wifi)).toEqual([true,true,false]);expect(s.store.state.stateChanged).toBe(false);expect(s.notify.mock.calls.at(-1)).toEqual(['error','LMN API unavailable',undefined,{sticky:true}]);
});
it('discards late confirmation and further serial stops after disposal/identity change',async()=>{
    let accept;const s=setup('none');s.aj.messagebox.show=()=>new Promise(r=>accept=r);const pending=s.api.startExam();await flushPromises();s.api.dispose();accept();await pending;expect(s.calls).toEqual([]);
    let release;const t=setup('mixed',r=>r.method==='patch'?new Promise(resolve=>release=()=>resolve({data:{}})):undefined);const stopped=t.api.stopRunningExams();await flushPromises();t.aj.identity.user='other';release();await stopped;expect(t.calls.length).toBe(1);expect(t.notify.mock.calls).toEqual([]);
});
it('single lookup retains splice(-1) for missing name and removes before rejected userinfo',async()=>{
    const s=setup('none');await s.api.startExam('unknown');expect(s.store.state.current.members.slice(0,2).map(u=>u.cn)).toEqual(['p95-0','p95-1']);const t=setup('none',r=>r.url===A+'exam/userinfo'?Promise.reject(new Error('userinfo')):undefined);await expect(t.api.startExam('p95-0')).rejects.toThrow('userinfo');expect(t.store.state.current.members.map(u=>u.cn)).toEqual(['p95-1','p95-2']);expect(t.store.state.stateChanged).toBe(false);expect(t.store.state.filePolling.stop.mock.calls).toEqual([]);
});

it('keeps the legacy header groups after single start until refresh, while central exam groups are current',async()=>{
    const s=setup('none');await s.api.startExam('p95-0');
    expect(s.store.state.examUsers.map(u=>u.cn)).toEqual(['p95-0-exam']);expect(s.store.state.examViewGroups.own).toEqual([]);
    s.store.filterExamUsers();expect(s.store.state.examViewGroups.own.map(u=>u.cn)).toEqual(['p95-0-exam']);
});

it('mixed stop after single start uses the retained controller groups, excluding the newly started account until refresh',async()=>{
    const newUser={...users('p95-teacher','none')[0],cn:'p95-new',sAMAccountName:'p95-new'};
    const s=setup('mixed',r=>r.url===A+'exam/userinfo'?{data:[{...newUser,cn:'p95-new-exam',sAMAccountName:'p95-new-exam',examTeacher:'p95-teacher',examMode:true}]}:undefined);
    s.store.state.current={...s.store.state.current,members:s.store.state.current.members.concat(newUser)};s.store.filterExamUsers();
    await s.api.startExam(newUser.cn);await s.api.stopRunningExams();
    expect(s.calls.filter(c=>c[1]===A+'exam/stop').map(c=>c[2].session.members[0].cn)).toEqual(['p95-0','p95-1']);
});
