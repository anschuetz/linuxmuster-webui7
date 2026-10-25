import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { createModalService } from '../../shell/modal.mjs';
import { result } from '../../../e2e/fixtures/users_3.mjs';
import { responses } from '../../plugins/lmn_settings/fixtures.test-data.mjs';
import { createSchoolSettings } from '../../plugins/lmn_settings/school.mjs';
import { openUsersCheck, summarySelection, applySelection, statusName } from './check.mjs';
import CheckDialog from './CheckDialog.vue';
import CheckResultsDialog from './CheckResultsDialog.vue';
import ApplyDialog from './ApplyDialog.vue';
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.useRealTimers(); document.body.innerHTML = ''; });
function setup(overrides={}) {
    const requests=[], notify=vi.fn(), reload=vi.fn(), open=vi.fn().mockResolvedValue();
    const aj=createMockAj({notify,reload,modal:{open},http:async r=>{requests.push(r);return {data:r.url.endsWith('/check')?result():''};},...overrides});
    return {aj,requests,notify,reload,open};
}
function render(component,aj,props={}) {
    const w=mount(component,{attachTo:document.body,props,global:{provide:{aj},mocks:{$gettext:aj.gettext}}});wrappers.push(w);return w;
}
const button=(w,n=0)=>w.findAll('.modal-footer button')[n];
it('derives summary choices from RESULT > 0 without changing the response',()=>{
    const data=result({add:0,move:2,kill:-1}), copy=structuredClone(data);
    expect(summarySelection(data)).toEqual({doAdd:false,doMove:true,doKill:false});expect(data).toEqual(copy);
});
it.each([
    ['all',{doAdd:false,doMove:true,doKill:true}],['error',{doAdd:false,doMove:true,doKill:true}],
    ['add',{doAdd:true,doMove:false,doKill:false}],['move',{doAdd:false,doMove:true,doKill:false}],['kill',{doAdd:false,doMove:false,doKill:true}],
])('uses exact legacy %s flags without changing summary choices',(mode,expected)=>{
    const selected={doAdd:false,doMove:true,doKill:true};expect(applySelection(mode,selected)).toEqual(expected);expect(selected).toEqual({doAdd:false,doMove:true,doKill:true});
});
it('preserves all untranslated status names and unknown values',()=>{
    expect('U A E S P T L D F R K X M ?'.split(' ').map(statusName)).toEqual(['Usable (U)','Activated (A)','Enabled (E)','Self-activated (S)','Permanent (P)','Tolerated (T)','Locked (L)','Deactivated (D)','Frozen (F)','Removable (R)','Killable (K)','Exam (X)','Managed (M)','?']);
});
it('opens Check through aj with static backdrop and default width',async()=>{
    const {aj,open}=setup();await openUsersCheck(aj);expect(open.mock.calls).toEqual([[CheckDialog,{}, {backdrop:'static'}]]);
});
it.each([
    [null,['error','Unknown error!','Please run sophomorix-check manually to identity the reason.']],
    [{OUTPUT:[{TYPE:'ERROR',MESSAGE_EN:'output failure'}]},['error','output failure',undefined]],
])('closes for empty response or first OUTPUT error, never opens Results',async(data,notification)=>{
    const {aj,notify,open}=setup({http:async()=>({data})});const w=render(CheckDialog,aj);
    expect(w.find('[role=status]').exists()).toBe(true);expect(button(w).isVisible()).toBe(false);
    await flushPromises();expect(notify.mock.calls).toEqual([notification]);expect(w.emitted('close')).toEqual([[]]);expect(open.mock.calls).toEqual([]);
});
it('keeps ERRORLIST failures with keyed ERROR details and a Close button',async()=>{
    const data=result();data.CHECK_RESULT.ERRORLIST=['bad'];const {aj,notify,open}=setup({http:async()=>({data})});const w=render(CheckDialog,aj);await flushPromises();
    expect(w.find('.alert-danger').text()).toContain('p119-error');expect(w.text()).toContain('--> Synthetic reason');expect(w.find('[role=status]').isVisible()).toBe(false);expect(button(w).isVisible()).toBe(true);
    expect(notify.mock.calls).toEqual([['error','Check failed',undefined]]);expect(open.mock.calls).toEqual([]);await button(w).trigger('click');expect(w.emitted('close')).toEqual([[]]);
});
it('notifies check HTTP errors and stops working without closing or inventing details',async()=>{
    const {aj,notify}=setup({http:async()=>{throw {data:{message:'denied'}};}});const w=render(CheckDialog,aj);await flushPromises();
    expect(notify.mock.calls).toEqual([['error','Check failed','denied']]);expect(w.find('.alert-danger').isVisible()).toBe(true);expect(w.emitted('close')).toBeUndefined();expect(button(w).isVisible()).toBe(true);
});
it('opens Results with unchanged response and default dismissal, then closes Check',async()=>{
    const data=result();const {aj,open,requests}=setup({http:async r=>{requests.push(r);return {data};}});open.mockRejectedValue(new Error('Results cancelled'));const w=render(CheckDialog,aj);await flushPromises();
    expect(requests.map(r=>[r.method,r.url])).toEqual([['get','/api/lmn/users/lists/check']]);expect(open.mock.calls).toEqual([[CheckResultsDialog,{data}]]);expect(w.emitted('close')).toEqual([[]]);
});
it.each(['all','add','move','kill','error'])('Results renders summary/details and opens %s Apply',async mode=>{
    const {aj,open}=setup();open.mockRejectedValue(new Error('Apply cancelled'));const w=render(CheckResultsDialog,aj,{data:result()});
    expect(w.findAll('input[type=checkbox]').map(b=>b.element.checked)).toEqual([true,true,true]);expect(w.text()).toContain('Synthetic New');expect(w.text()).toContain('Usable (U) --> Killable (K)');expect(w.text()).toContain('attic --> p119-class');expect(w.find('.badge.bg-danger').exists()).toBe(true);
    if(mode==='all')await w.find('input[type=checkbox]').setValue(false);
    else await w.findAll('.nav-tabs a')[['all','add','move','kill','error'].indexOf(mode)].trigger('click');
    expect(button(w).text()).toEqual({all:'Apply',add:'Add user(s)',move:'Move user(s)',kill:'Kill user(s)',error:'Errors'}[mode]);
    await button(w).trigger('click');expect(w.emitted('close')).toEqual([[]]);expect(open.mock.calls).toEqual([[ApplyDialog,{params:applySelection(mode,{doAdd:mode!=='all',doMove:true,doKill:true})},{backdrop:'static',size:'lg'}]]);
});
it('zero summary hides tabs/options and disables Apply; cancel never applies',async()=>{
    const {aj,open}=setup();const w=render(CheckResultsDialog,aj,{data:result({add:0,move:0,kill:0,errors:0})});
    expect(w.findAll('.nav-tabs a').filter(a=>a.isVisible()).map(a=>a.text())).toEqual(['Summary']);expect(w.findAll('input').filter(b=>b.isVisible())).toEqual([]);expect(button(w).attributes('disabled')).toBeDefined();await button(w,1).trigger('click');expect(w.emitted('cancel')).toEqual([[]]);expect(open.mock.calls).toEqual([]);
});
it('data.error hides summary details without disabling the legacy Apply action',()=>{
    const {aj}=setup();const w=render(CheckResultsDialog,aj,{data:{...result(),error:'existing error'}});expect(w.find('.alert-danger').text()).toContain('existing error');expect(w.find('.card').isVisible()).toBe(false);expect(button(w).attributes('disabled')).toBeUndefined();
});
it.each([false,true])('Apply failure=%s posts only supplied flags, reports completion, reloads only on success',async fail=>{
    let resolve,reject;const {aj,requests,notify,reload}=setup({http:r=>{requests.push(r);return new Promise((done,no)=>{resolve=done;reject=no;});}});
    const params={doAdd:false,doMove:true,doKill:false};const w=render(ApplyDialog,aj,{params});expect(w.find('[role=status]').isVisible()).toBe(true);expect(button(w).isVisible()).toBe(false);expect(requests.map(r=>[r.method,r.url,r.data])).toEqual([['post','/api/lmn/users/lists/apply',params]]);
    if(fail)reject({data:{message:'failed fixture'}});else resolve({data:''});await flushPromises();expect(w.find('[role=status]').isVisible()).toBe(false);expect(button(w).isVisible()).toBe(true);expect(reload.mock.calls).toEqual([]);expect(notify.mock.calls).toEqual([fail?['error','Failed','failed fixture']:['success','Changes applied',undefined]]);await button(w).trigger('click');expect(w.emitted('close')).toEqual([[]]);w.unmount();wrappers.splice(wrappers.indexOf(w),1);expect(reload.mock.calls).toEqual(fail?[]:[[]]);
});
it('keeps successful Apply and its final log visible until Close, then reloads Settings',async()=>{
    vi.useFakeTimers();let destroy;
    const {aj,reload}=setup({http:async r=>({data:r.url.includes('/log')?'final sophomorix log\n':{}})});
    aj.modal=createModalService(()=>aj,{$on:(_event,callback)=>{destroy=callback;return ()=>{};}});
    reload.mockImplementation(()=>destroy());
    const pending=aj.modal.open(ApplyDialog,{params:{doAdd:true,doMove:false,doKill:false}},{backdrop:'static'});
    await flushPromises();await vi.advanceTimersByTimeAsync(1000);await flushPromises();
    expect(document.querySelector('.modal pre').textContent).toContain('final sophomorix log');
    expect(document.querySelector('.modal-footer').style.display).not.toBe('none');expect(reload).not.toHaveBeenCalled();
    document.querySelector('.modal-footer button').click();await pending;
    expect(document.querySelector('.modal')).toBeNull();expect(reload).toHaveBeenCalledTimes(1);
});
it.each([[CheckDialog,'/tmp/sophomorix-check.log'],[ApplyDialog,'/tmp/sophomorix.log']])('reuses LmLog in %s with offsets, autoscroll and timer cleanup',async(component,path)=>{
    vi.useFakeTimers();const {aj,requests}=setup({http:async r=>{requests.push(r);return {data:r.url.includes('/log')?'abc\n':new Promise(()=>{})};}});const w=render(component,aj,{params:{doAdd:true,doMove:false,doKill:false}});
    const pre=w.find('pre');Object.defineProperty(pre.element,'scrollHeight',{value:450});await vi.advanceTimersByTimeAsync(1000);await flushPromises();expect(pre.text()).toEqual('abc');expect(pre.element.scrollTop).toBe(450);
    await w.find('input[type=checkbox]').setValue(false);pre.element.scrollTop=0;await vi.advanceTimersByTimeAsync(1000);expect(pre.element.scrollTop).toBe(0);expect(requests.filter(r=>r.url.includes('/log')).map(r=>r.url)).toEqual([`/api/lmn/log${path}?offset=0`,`/api/lmn/log${path}?offset=4`]);
    w.unmount();wrappers.splice(wrappers.indexOf(w),1);const before=requests.length;await vi.advanceTimersByTimeAsync(3000);expect(requests.length).toBe(before);
});
it('Settings save success opens shared Check with aj; failed save never checks',async()=>{
    const {aj,open}=setup();let failed=false;const requests=[];aj.http.get=async url=>({data:responses()[url]});aj.http.post=async(url,data)=>{requests.push([url,data]);if(failed)throw {data:{message:'save failed'}};return {data:{}};};
    const state=createSchoolSettings(aj);await state.ready;await state.saveAndCheck();expect(open.mock.calls).toEqual([[CheckDialog,{}, {backdrop:'static'}]]);expect(requests).toEqual([['/api/lmn/schoolsettings',state.settings]]);
    open.mockClear();failed=true;await state.saveAndCheck();expect(open.mock.calls).toEqual([]);
});
it('Escape dismisses working Check without cancelling HTTP',async()=>{
    let resolve;const {aj,requests}=setup({http:r=>{requests.push(r);return new Promise(done=>{resolve=done;});}});aj.modal=createModalService(()=>aj);
    const pending=openUsersCheck(aj);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await expect(pending).rejects.toThrow('Modal cancelled');resolve({data:null});await flushPromises();expect(requests.map(r=>r.url)).toEqual(['/api/lmn/users/lists/check']);expect(document.querySelector('.modal')).toBeNull();
});
