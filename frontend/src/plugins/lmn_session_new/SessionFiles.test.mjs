import { expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SessionFiles from './SessionFiles.vue';
import { createMockAj } from '../../adapter/mock.mjs';
import { session } from '../../../e2e/fixtures/session_files.mjs';
const setup=(userIndex,foreign=false,error='')=>{
    const current=session(foreign),user=userIndex===undefined?undefined:{...current.members[userIndex],files_error:error};
    const store={state:{current,extExamUsers:foreign?[user]:[]}},aj=createMockAj();
    const api=Object.fromEntries(['shareUser','shareAll','collectUser','collectAll','browseCollected'].map(k=>[k,vi.fn().mockResolvedValue()]));
    const wrapper=mount(SessionFiles,{props:{store,api,user},global:{provide:{aj}}});return{wrapper,api,user};
};
it('toolbar invokes share/copy/move/archive, dropdown closes on command',async()=>{
    const s=setup();await s.wrapper.get('[data-share-all]').trigger('click');await s.wrapper.get('[data-collect-toggle]').trigger('click');expect(s.wrapper.find('.dropdown-menu.show').exists()).toBe(true);await s.wrapper.get('[data-collect-all-copy]').trigger('click');await s.wrapper.get('[data-collect-toggle]').trigger('click');await s.wrapper.get('[data-collect-all-move]').trigger('click');await s.wrapper.get('[data-archive]').trigger('click');await flushPromises();
    expect(s.api.shareAll.mock.calls).toEqual([[]]);expect(s.api.collectAll.mock.calls).toEqual([['copy'],['move']]);expect(s.api.browseCollected.mock.calls).toEqual([[]]);s.wrapper.unmount();
});
it('student/examuser row actions call single transfers; teacher/error/foreign-exam rows have none',async()=>{
    for(const index of [0,1]){const s=setup(index);await s.wrapper.get('[data-share-user]').trigger('click');await s.wrapper.get('[data-collect-toggle]').trigger('click');await s.wrapper.get('[data-collect-user-copy]').trigger('click');await s.wrapper.get('[data-collect-toggle]').trigger('click');await s.wrapper.get('[data-collect-user-move]').trigger('click');await flushPromises();expect(s.api.shareUser.mock.calls).toEqual([[s.user]]);expect(s.api.collectUser.mock.calls).toEqual([['copy',s.user],['move',s.user]]);s.wrapper.unmount();}
    for(const args of [[2],[0,true],[0,false,'NOTJOINED']]){const s=setup(...args);expect(s.wrapper.find('button').exists()).toBe(false);s.wrapper.unmount();}
});
it('modal cancellation is consumed by the row and causes no unhandled rejection',async()=>{const s=setup(0);s.api.shareUser.mockRejectedValue(new Error('cancel'));await s.wrapper.get('[data-share-user]').trigger('click');await flushPromises();expect(s.api.shareUser.mock.calls.length).toBe(1);s.wrapper.unmount();});
