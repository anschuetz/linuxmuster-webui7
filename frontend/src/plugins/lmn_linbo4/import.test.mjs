import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { createModalService } from '../../adapter/modal.mjs';
import ImportDialog from './ImportDialog.vue';
import { importDevices } from './import.mjs';
const wrappers = [];
afterEach(() => { wrappers.splice(0).forEach(w => w.unmount()); vi.useRealTimers(); vi.restoreAllMocks(); });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
function setup() {
    vi.useFakeTimers({toFake:['setInterval','clearInterval']});
    const pending=deferred(), notify=vi.fn(), requests=[];
    const aj=createMockAj({ notify, http: async request => {
        requests.push(request);
        return request.method==='post' ? pending.promise : {data: requests.filter(r=>r.method==='get').length===1 ? 'ä log\n' : ''};
    }});
    const wrapper=mount(ImportDialog,{attachTo:document.body,global:{provide:{aj}}});wrappers.push(wrapper);
    return {wrapper,pending,notify,requests};
}
const button = (w,text) => w.findAll('a').find(a=>a.text()===text);
const tick = async () => {await vi.advanceTimersByTimeAsync(1000);await flushPromises();};
it('posts without body, waits, retains hidden/completed log polling and offsets until close/unmount',async()=>{
    const {wrapper:w,pending,notify,requests}=setup();
    expect(requests).toEqual([{method:'post',url:'/api/lmn/devices/import',data:undefined,cfg:undefined}]);
    expect(w.find('[role="progressbar"]').exists()).toBe(true);expect(button(w,'Close')).toBeUndefined();
    await tick();expect(w.get('pre').text()).toBe('ä log');
    await button(w,'Hide details').trigger('click');expect(w.get('pre').isVisible()).toBe(false);
    await tick();expect(requests.filter(r=>r.method==='get').map(r=>r.url)).toEqual(['/api/lmn/log/tmp/import_devices.log?offset=0','/api/lmn/log/tmp/import_devices.log?offset=6']);
    pending.resolve({data:null});await flushPromises();
    expect(notify.mock.calls).toEqual([['success','Import complete',undefined]]);
    expect(w.find('[role="progressbar"]').exists()).toBe(false);
    await tick();expect(requests.filter(r=>r.method==='get').length).toBe(3);
    await button(w,'Details').trigger('click');expect(w.get('pre').isVisible()).toBe(true);
    await button(w,'Close').trigger('click');expect(w.emitted('close')).toEqual([[]]);
    w.unmount();wrappers.pop();await tick();expect(requests.length).toBe(4);expect(vi.getTimerCount()).toBe(0);
});
it.each([false,true])('failure toggles existing log visibility (hidden=%s), notifies backend message and permits close',async hidden=>{
    const {wrapper:w,pending,notify}=setup();
    if(hidden) await button(w,'Hide details').trigger('click');
    pending.reject({data:{message:'fixture failed'}});await flushPromises();
    expect(notify.mock.calls).toEqual([['error','Import failed','fixture failed']]);
    expect(w.get('pre').isVisible()).toBe(hidden);expect(button(w,'Close').exists()).toBe(true);
});
it('opens static large modal, resets dirty state before completion, reloads only on explicit close',async()=>{
    const result=deferred(), events=[], aj=createMockAj({reload:()=>events.push('reload'),modal:{open:(...args)=>{events.push(args);return result.promise;}}});
    const operation=importDevices(aj,()=>events.push('clean'));
    expect(events).toEqual([[ImportDialog,{}, {backdrop:'static'}],'clean']);
    result.resolve();await operation;expect(events.at(-1)).toBe('reload');
});
it('Escape/scope cancellation keeps early clean state without reloading',async()=>{
    const pending=deferred(), reload=vi.fn(), clean=vi.fn();
    const aj=createMockAj({reload,modal:{open:()=>pending.promise}});
    const operation=importDevices(aj,clean);expect(clean.mock.calls).toEqual([[]]);
    pending.reject(new Error('cancel'));await operation;expect(reload.mock.calls).toEqual([]);
});
it('real modal ignores backdrop, allows Escape and clears the log timer on scope destruction',async()=>{
    const listeners={}, pending=deferred(), reload=vi.fn();
    const aj=createMockAj({reload,http:async request=>request.method==='post'?pending.promise:{data:''}});
    aj.modal=createModalService(()=>aj,{$on:(event,fn)=>{listeners[event]=fn;return ()=>{};}});
    let operation=importDevices(aj,()=>{});await flushPromises();
    expect(document.querySelector('.modal-dialog').classList.contains('modal-lg')).toBe(true);
    document.querySelector('.modal').click();await flushPromises();expect(document.querySelector('.modal')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await operation;
    expect(document.querySelector('.modal')).toBeNull();expect(reload.mock.calls).toEqual([]);
    vi.useFakeTimers({toFake:['setInterval','clearInterval']});operation=importDevices(aj,()=>{});await flushPromises();expect(vi.getTimerCount()).toBe(1);
    listeners.$destroy();await operation;expect(vi.getTimerCount()).toBe(0);
    pending.resolve({data:null});await flushPromises();
});
