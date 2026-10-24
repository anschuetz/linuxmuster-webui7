import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { reactive } from 'vue';
import { createMockAj } from '../../adapter/mock.mjs';
import ImageBackupsDialog from './ImageBackupsDialog.vue';
import LinboPage from './LinboPage.vue';
import { replaceImage } from './imageActions.mjs';
const wrappers=[];
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());});
it('orders backups descending with stable ties, renders prose and dispatches explicit callbacks',async()=>{
 const backups=[{date:'old',timestamp:1,desc:''},{date:'new',timestamp:2,desc:'one\ntwo'},{date:'tie',timestamp:2}];
 const image={name:'main',size:1024,desc:'base',backups_list:backups},editImage=vi.fn(),restoreBackup=vi.fn(),deleteBackupImage=vi.fn();
 const wrapper=mount(ImageBackupsDialog,{props:{image,editImage,restoreBackup,deleteBackupImage},global:{provide:{aj:createMockAj()}}});wrappers.push(wrapper);
 expect(wrapper.findAll('[data-backup]').map(r=>r.attributes('data-backup'))).toEqual(['new','tie','old']);
 expect(wrapper.text()).toContain('1.0 KB');expect(wrapper.find('[data-backup="new"]').text()).toContain('onetwo');
 await wrapper.find('[data-action="edit-backup"]').trigger('click');await wrapper.find('[data-action="restore-backup"]').trigger('click');await wrapper.find('[data-action="delete-backup"]').trigger('click');
 expect(editImage.mock.calls).toEqual([[backups[1]]]);expect(restoreBackup.mock.calls).toEqual([[image,'new']]);expect(deleteBackupImage.mock.calls).toEqual([[image,'new']]);
 await wrapper.find('[data-action="close"]').trigger('click');expect(wrapper.emitted('close')).toEqual([[]]);
});
it('shows saved backup metadata immediately in an already open dialog',async()=>{
 const backup={date:'date',timestamp:1,desc:'old'},state=reactive({images:[{name:'main',desc:'',backups:{date:backup},backups_list:[backup]}]});
 const wrapper=mount(ImageBackupsDialog,{props:{image:state.images[0],getImage:()=>state.images[0]},global:{provide:{aj:createMockAj()}}});wrappers.push(wrapper);
 state.images=replaceImage(state.images,state.images[0].backups.date,{...backup,desc:'updated'});await wrapper.vm.$nextTick();
 expect(wrapper.find('[data-backup]').text()).toContain('updated');
});
it('page wires backup editor and destructive callbacks and keeps selection click order with selected payloads',async()=>{
 const calls=[],opens=[],show=vi.fn(async()=>{}),aj=createMockAj({messagebox:{show},modal:{open:async(Component,props)=>{opens.push([Component,props]);if(Component!==ImageBackupsDialog)return {...props.image,desc:'saved'};}},http:async r=>{calls.push(r);return {data:r.url.endsWith('/images')?[{name:'a',backups:{date:{name:'a',backup:true,timestamp:1}},diff_image:{}},{name:'b',backups:{},diff_image:{}}]:[]};}});
 const wrapper=mount(LinboPage,{global:{provide:{aj}}});wrappers.push(wrapper);await flushPromises();
 await wrapper.findAll('.nav-tabs a')[1].trigger('click');await wrapper.find('[data-action="backups"]').trigger('click');await flushPromises();
 const [Component,props]=opens[0];expect(Component).toBe(ImageBackupsDialog);
 await props.editImage(props.image.backups_list[0]);await flushPromises();expect(props.getImage().backups.date.desc).toEqual('saved');expect(props.getImage().backups_list[0].desc).toEqual('saved');
 await props.restoreBackup(props.getImage(),'date');await props.deleteBackupImage(props.getImage(),'date');
 const checks=wrapper.findAll('input[type="checkbox"]');await checks[1].setValue(true);await checks[0].setValue(true);await checks[0].setValue(false);
 expect(checks[0].element.checked).toEqual(false);expect(checks[1].element.checked).toEqual(true);
 await wrapper.find('[data-action="delete-selected"]').trigger('click');await flushPromises();
 expect(show.mock.calls.at(-1)[0].title).toEqual("Delete 'b' ?");
 expect(calls.filter(r=>r.method==='delete').map(r=>r.url)).toEqual(['/api/lmn/linbo4/images/b']);
 expect(calls.filter(r=>r.method==='post').map(r=>[r.url,r.data.date])).toEqual([['/api/lmn/linbo4/saveBackupImage/a',undefined],['/api/lmn/linbo4/restoreBackupImage/a','date'],['/api/lmn/linbo4/deleteBackupImage/a','date']]);
});
