import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import FileSelectDialog from './FileSelectDialog.vue';
import { createMockAj } from '../../adapter/mock.mjs';
import { items } from '../../../e2e/fixtures/session_files.mjs';
const mounted=[];
afterEach(()=>{mounted.forEach(w=>w.unmount());mounted.length=0;vi.restoreAllMocks();});
function setup(action='copy') {
    let listing=items('own'), resolve;const calls=[],notices=[];
    const prompt=vi.fn().mockResolvedValue({value:'new name'}),show=vi.fn().mockResolvedValue({});
    const aj=createMockAj({messagebox:{prompt,show},notify:(...a)=>notices.push(a),http:async r=>{calls.push([r.url,r.data]);return {data:r.url.endsWith('/list')?await new Promise(r=>{resolve=()=>r({items:listing});}):{}};}});
    const wrapper=mount(FileSelectDialog,{props:{action,path:'own',printPath:'transfer',user:'p94-0'},global:{provide:{aj},stubs:{SmbUpload:{name:'SmbUpload',template:'<div><slot :browse-ref="()=>{}" :progress="[]" /></div>'}}}});mounted.push(wrapper);
    return{wrapper,calls,notices,prompt,show,get resolve(){return resolve;},set listing(v){listing=v;}};
}
it('has loading state, hides collected, directories first then case-insensitive names, preserves backend selected order',async()=>{
    const s=setup();expect(s.wrapper.text()).not.toContain('Empty directory.');s.resolve();await flushPromises();expect(s.wrapper.findAll('[data-item]').map(w=>w.attributes('data-item'))).toEqual(['Bdir','a.txt','z.txt']);
    await s.wrapper.get('[data-save]').trigger('click');expect(s.notices.at(-1)[1]).toBe('Please select at least one file!');expect(s.wrapper.emitted('close')).toBeUndefined();
    await s.wrapper.get('[data-item="a.txt"] input').setValue(true);await s.wrapper.get('[data-item="z.txt"] input').setValue(true);await s.wrapper.get('[data-save]').trigger('click');expect(s.wrapper.emitted('close')[0][0]).toEqual({response:'accept',items:[{...items('own')[0],selected:true},{...items('own')[3],selected:true}]});
});
it('invert-all toggles hidden items too and does not refresh count; back follows legacy history including reload entries',async()=>{
    const s=setup();s.resolve();await flushPromises();await s.wrapper.get('[data-item="a.txt"] input').setValue(true);await s.wrapper.get('[data-toggle-all]').setValue(true);expect(s.wrapper.get('[data-count]').text()).toContain('1');
    await s.wrapper.get('[data-save]').trigger('click');expect(s.wrapper.emitted('close')[0][0].items.map(i=>i.name)).toEqual(['z.txt','collected','Bdir']);
    await s.wrapper.get('[data-open]').trigger('click');s.listing=[];s.resolve();await flushPromises();expect(s.wrapper.text()).toContain('Empty directory.');expect(s.calls.at(-1)).toEqual(['/api/lmn/smbclient/list',{path:'own/Bdir'}]);
    await s.wrapper.get('[data-back]').trigger('click');s.listing=items('own');s.resolve();await flushPromises();expect(s.calls.at(-1)).toEqual(['/api/lmn/smbclient/list',{path:'own'}]);expect(s.wrapper.find('[data-back]').exists()).toBe(false);
});
it('share hides invert-all; archive hides all selection/save controls; close cancels',async()=>{
    const s=setup('share');s.resolve();await flushPromises();expect(s.wrapper.find('[data-toggle-all]').exists()).toBe(false);await s.wrapper.get('[data-close]').trigger('click');expect(s.wrapper.emitted('cancel')).toEqual([[]]);
    const a=setup('');a.resolve();await flushPromises();expect(a.wrapper.find('input').exists()).toBe(false);expect(a.wrapper.find('[data-save]').exists()).toBe(false);expect(a.wrapper.text()).toContain('Browse collected files');
});
it('mkdir, rename and file/directory delete use existing smbclient payloads then reload; cancellations write nothing',async()=>{
    const s=setup();s.resolve();await flushPromises();
    const actions=[['[data-mkdir]','/directory',{path:'own/new name'}],['[data-item="z.txt"] [data-rename]','/move',{src:'own/z.txt',dst:'own/new name'}],['[data-delete-file]','/unlink',{path:'own/a.txt'}],['[data-delete-dir]','/rmdir',{path:'own/Bdir'}]];
    for(const [selector,api,data]of actions){const before=s.calls.length;await s.wrapper.get(selector).trigger('click');await flushPromises();expect(s.calls[before]).toEqual(['/api/lmn/smbclient'+api,data]);s.resolve();await flushPromises();}
    s.prompt.mockRejectedValue(new Error('cancel'));s.show.mockRejectedValue(new Error('cancel'));const n=s.calls.length;for(const [selector]of actions){await s.wrapper.get(selector).trigger('click');await flushPromises();}expect(s.calls.length).toBe(n);
});
it('upload completion reloads currently displayed path through shared SmbUpload',async()=>{
    const s=setup();s.resolve();await flushPromises();s.wrapper.findComponent({name:'SmbUpload'}).vm.$emit('uploaded',[]);await flushPromises();expect(s.calls.at(-1)).toEqual(['/api/lmn/smbclient/list',{path:'own'}]);s.resolve();await flushPromises();
});
it('late directory response after unmount does not update the dialog',async()=>{const s=setup();s.wrapper.unmount();s.resolve();await flushPromises();expect(s.wrapper.emitted('close')).toBeUndefined();});
it('integrates shared upload browse/progress/finish with the current directory and reloads its listing',async()=>{
    let flow;class Flow {
        constructor(options){flow=this;this.options=options;this.files=[];this.handlers=new Map();}
        on(e,f){this.handlers.set(e,[...(this.handlers.get(e)||[]),f]);}off(e,f){this.handlers.set(e,(this.handlers.get(e)||[]).filter(h=>h!==f));}
        fire(e){for(const f of this.handlers.get(e)||[])f();}assignBrowse=vi.fn();assignDrop=vi.fn();unAssignDrop=vi.fn();cancel=vi.fn();upload=vi.fn();
    }
    vi.stubGlobal('Flow',Flow);const calls=[];const aj=createMockAj({http:async r=>{calls.push([r.url,r.data]);return{data:r.url.endsWith('/list')?{items:items('own')}:[]};}});
    const wrapper=mount(FileSelectDialog,{props:{path:'own',printPath:'transfer',action:'share',user:'all'},global:{provide:{aj}}});mounted.push(wrapper);await flushPromises();await wrapper.get('[data-open]').trigger('click');await flushPromises();
    expect(flow.options).toEqual({target:'/api/lmn/smbclient/upload',chunkSize:1048576});expect(flow.assignBrowse.mock.calls[0][0].getAttribute('aria-label')).toBe('Upload file');
    flow.files=[{uniqueIdentifier:'p94-id',name:'p94.txt',progress:()=>0.25}];flow.fire('filesSubmitted');flow.fire('fileProgress');await flushPromises();expect(wrapper.get('[role=progressbar]').attributes('aria-valuenow')).toBe('25');expect(wrapper.text()).toContain('p94.txt (25 %)');
    flow.fire('complete');await flushPromises();expect(calls.slice(-2)).toEqual([['/api/lmn/smbclient/finish-upload',[{id:'p94-id',path:'own/Bdir',name:'p94.txt'}]],['/api/lmn/smbclient/list',{path:'own/Bdir'}]]);expect(wrapper.find('[role=progressbar]').exists()).toBe(false);wrapper.unmount();vi.unstubAllGlobals();
});
