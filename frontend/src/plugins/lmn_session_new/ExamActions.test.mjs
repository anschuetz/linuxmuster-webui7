import { expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { shallowReactive } from 'vue';
import ExamActions from './ExamActions.vue';
import ManagementControls from './ManagementControls.vue';
import { createMockAj } from '../../adapter/mock.mjs';
import { session } from '../../../e2e/fixtures/session_exam.mjs';
function setup(Component, user) {
    const state=shallowReactive({current:session('p95-teacher','none'),examMode:false,examUsers:[],extExamUsers:[]});
    if(user) state.current={...state.current,members:[user,...state.current.members.slice(1)]};
    const api=Object.fromEntries(['startExam','stopExam','stopRunningExams','stopUserExam','setManagementGroup','setManagementGroupAll'].map(k=>[k,vi.fn().mockResolvedValue()]));
    const store={state,replaceMembers(members){state.current={...state.current,members};}};
    const wrapper=mount(Component,{props:{store,api,user},global:{provide:{aj:createMockAj()}}});if(user) state.current={...state.current,members:[wrapper.props('user'),...state.current.members.slice(1)]};return{state,api,wrapper};
}
it('header exam controls follow empty/mixed/all and room conditions, report cancellations through shell',async()=>{
    const s=setup(ExamActions);await s.wrapper.get('[data-exam-start-all]').trigger('click');expect(s.api.startExam.mock.calls).toEqual([[]]);
    s.state.current={...s.state.current,type:'room'};await flushPromises();expect(s.wrapper.find('button').exists()).toBe(false);
    s.state.extExamUsers=[s.state.current.members[0]];await flushPromises();await s.wrapper.get('[data-exam-stop-running]').trigger('click');expect(s.api.stopRunningExams.mock.calls).toEqual([[]]);
    s.state.examMode=true;await flushPromises();s.api.stopExam.mockRejectedValue('cancel');await s.wrapper.get('[data-exam-stop-all]').trigger('click');await flushPromises();expect(s.api.stopExam.mock.calls).toEqual([[]]);s.wrapper.unmount();
});
it('row exam controls start with cn or stop with full user, display supervisor',async()=>{
    const user=session('p95-teacher','none').members[0],s=setup(ExamActions,user);await s.wrapper.get('[data-exam-start-user]').trigger('click');expect(s.api.startExam.mock.calls).toEqual([[user.cn]]);
    const exam={...user,examMode:true,examTeacher:'other'};await s.wrapper.setProps({user:exam});expect(s.wrapper.text()).toBe('other');await s.wrapper.get('[data-exam-stop-user]').trigger('click');expect(s.api.stopUserExam.mock.calls).toEqual([[exam]]);s.wrapper.unmount();
});
it('management controls expose only wifi/internet/printing, toggle one checkbox after sending pre-toggle user',async()=>{
    const user=session('p95-teacher','none').members[0],s=setup(ManagementControls,user);
    expect(s.wrapper.findAll('input').map(w=>w.attributes('data-management'))).toEqual(['wifi','internet','printing']);await s.wrapper.get('[data-management-wifi]').setValue(true);expect(s.api.setManagementGroup.mock.calls).toEqual([['wifi',user]]);expect(s.state.current.members[0].wifi).toBe(true);expect(user.wifi).toBe(false);s.wrapper.unmount();
});
it('management header reflects all/none/mixed across all roles and calls bulk action',async()=>{
    const s=setup(ManagementControls);expect(s.wrapper.get('[data-management-all-internet]').classes()).toContain('btn-lmn-success-inv');expect(s.wrapper.get('[data-management-all-wifi]').classes()).toContain('btn-lmn-danger-inv');s.state.current={...s.state.current,members:s.state.current.members.map((u,i)=>({...u,wifi:i===2}))};await flushPromises();expect(s.wrapper.get('[data-management-all-wifi]').classes()).toContain('btn-default');await s.wrapper.get('[data-management-all-wifi]').trigger('click');expect(s.api.setManagementGroupAll.mock.calls).toEqual([['wifi']]);s.wrapper.unmount();
});
