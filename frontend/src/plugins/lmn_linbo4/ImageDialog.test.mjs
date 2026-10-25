import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import ImageDialog from './ImageDialog.vue';
import ImagesTab from './ImagesTab.vue';
const wrappers=[];
afterEach(()=>{wrappers.forEach(w=>w.unmount());wrappers.length=0;delete window.ace;});
function setup(image={},extra={}) {
    const calls=[],aj=createMockAj({http:async req=>{calls.push(req);return {data:req.url.startsWith('/api/filesystem/')?'  script\n':['example.'+req.url.split('/').at(-1)]};},...extra});
    const wrapper=mount(ImageDialog,{props:{image:{name:'p86',size:1536,desc:'a\r\nb',...image},images:[{name:'source',reg:'  copied\n',postsync:'post',prestart:'pre'},{name:'empty'}],renameImage:vi.fn()},global:{provide:{aj}}});
    wrappers.push(wrapper); return {wrapper,calls};
}
it('loads three example lists, keeps initial rows, trims prose and preserves script whitespace',async()=>{
    const {wrapper,calls}=setup(); await flushPromises();
    expect(calls.map(c=>c.url)).toEqual(['reg','postsync','prestart'].map(k=>'/api/lmn/linbo4/examples/'+k));
    expect(wrapper.find('[data-model="image.desc"]').attributes('rows')).toEqual('3');
    expect(wrapper.text()).toContain('1.5 KB');
    const desc=wrapper.find('[data-model="image.desc"]');
    for(const value of [' ',' a',' a ',' a b',' a b ']) {desc.element.value=value;await desc.trigger('input');}
    await wrapper.find('[data-tab="reg"]').trigger('click');
    await wrapper.find('[data-source="reg:source"]').trigger('click');
    expect(wrapper.find('[data-model="image.reg"]').element.value).toEqual('  copied\n');
    await wrapper.find('[data-example="reg:example.reg"]').trigger('click');await flushPromises();
    expect(calls.at(-1).url).toEqual('/api/filesystem/read//srv/linbo/examples/example.reg?encoding=utf-8');
    await wrapper.find('[data-action="save"]').trigger('click');
    expect(wrapper.emitted('close')[0][0]).toEqual({name:'p86',size:1536,desc:'a b',reg:'  script\n'});
    expect(wrapper.props('image').desc).toEqual('a\r\nb');
});
it.each(['postsync','prestart'])('copies and edits %s without trimming',async key=>{
    const {wrapper}=setup();await flushPromises();await wrapper.find(`[data-tab="${key}"]`).trigger('click');
    await wrapper.find(`[data-source="${key}:source"]`).trigger('click');
    const field=wrapper.find(`[data-model="image.${key}"]`);await field.setValue('  edited\n');
    await wrapper.find('[data-action="save"]').trigger('click');
    expect(wrapper.emitted('close')[0][0][key]).toEqual('  edited\n');
});
it('diff hides postsync and rename, backup hides rename; failed examples do not clear draft; Close cancels',async()=>{
    const {wrapper}=setup({diff:true,reg:'original'},{http:async()=>{throw Error('fixture');}});await flushPromises();
    expect(wrapper.find('[data-tab="postsync"]').exists()).toEqual(false);expect(wrapper.find('[data-action="rename"]').exists()).toEqual(false);
    await wrapper.find('[data-action="cancel"]').trigger('click');expect(wrapper.emitted('cancel')).toEqual([[]]);
    const backup=setup({backup:true,date:'today'}).wrapper;expect(backup.find('[data-action="rename"]').exists()).toEqual(false);expect(backup.text()).toContain('Backup today');
});
it('renders images in server order, used_in, differential size, error visibility and empty/load states',async()=>{
    const images=[{name:'z',size:1024,used_in:['a','b'],diff_image:{name:'z',size:512,diff:true}},{name:'a',error:true,used_in:[]}];
    const wrapper=mount(ImagesTab,{props:{images},global:{provide:{aj:createMockAj()}}});wrappers.push(wrapper);
    expect(wrapper.findAll('tbody tr').map(r=>r.find('[data-name]').text())).toEqual(['z','a']);
    expect(wrapper.findAll('.badge.bg-success').map(r=>r.text())).toEqual(['a','b']);
    expect(wrapper.findAll('[data-action="edit"]').length).toEqual(1);
    await wrapper.find('[data-action="edit-diff"]').trigger('click');expect(wrapper.emitted('edit-image')).toEqual([[images[0].diff_image]]);
    await wrapper.find('[data-action="duplicate"]').trigger('click');expect(wrapper.emitted('duplicate-image')).toEqual([[images[0]]]);
    await wrapper.setProps({images:undefined});expect(wrapper.text()).not.toContain("There's no image");
    await wrapper.setProps({images:[]});expect(wrapper.text()).toContain("There's no image on the server yet.");
});
it('keeps scripts after failed example reads and forwards rename with the current draft',async()=>{
    const {wrapper}=setup({reg:'old'},{http:async req=>{if(req.url.startsWith('/api/filesystem/'))throw Error('read');return {data:['fixture']};}});
    await flushPromises();await wrapper.find('[data-tab="reg"]').trigger('click');await wrapper.find('[data-example="reg:fixture"]').trigger('click');await flushPromises();
    expect(wrapper.find('[data-model="image.reg"]').element.value).toEqual('old');
    await wrapper.find('[data-action="rename"]').trigger('click');expect(wrapper.props('renameImage').mock.calls).toEqual([[{name:'p86',size:1536,desc:'a\r\nb',reg:'old'}]]);
});
