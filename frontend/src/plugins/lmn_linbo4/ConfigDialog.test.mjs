import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import ConfigDialog from './ConfigDialog.vue';
import PartitionDialog from './PartitionDialog.vue';
import AcceptDialog from './AcceptDialog.vue';
import { editConfig } from './config.mjs';
import { editorConfig as config, editorVDI as vdi } from '../../../e2e/fixtures/linbo4-editor.mjs';
const wrappers=[];
afterEach(()=>{wrappers.forEach(w=>w.unmount());wrappers.length=0;});
const model=(w,key)=>w.get(`[data-model="${key}"]`);
function setup(Component=ConfigDialog,props={config:config(),vdiconfig:vdi()},options={}) {
 const requests=[],modal=vi.fn(),notify=vi.fn(),prompt=vi.fn();
 const aj=createMockAj({gettext:options.gettext,identity:{profile:{activeSchool:'p84-school'}},modal:{open:modal},notify,messagebox:{prompt},http:async req=>{requests.push(req);if(options.fail)throw Error('failed');return {data:req.url.endsWith('/icons')?['ubuntu.svg','win10.svg','old.png','linbo_hidden.svg']:[{name:'linux'}]};}});
 const w=mount(Component,{attachTo:document.body,props,global:{provide:{aj}}});wrappers.push(w);return {w,requests,modal,notify,prompt};
}
it('edits a detached draft, ngTrim allows typed inner spaces, saves color without #',async()=>{
 const source=config(),{w}=setup(ConfigDialog,{config:source,vdiconfig:null});
 const input=model(w,'config.config.LINBO.KernelOptions');input.element.focus();
 for(const c of ' inner space'){input.element.value+=c;await input.trigger('input');}
 await input.trigger('change');await model(w,'config.config.LINBO.RootTimeout').setValue('  42  ');
 await model(w,'config.config.LINBO.BackgroundColor').setValue('#aabbcc');await w.get('[data-action=save]').trigger('click');
 const result=w.emitted('close')[0][0];expect([result[0].config.LINBO.KernelOptions,result[0].config.LINBO.RootTimeout,result[0].config.LINBO.BackgroundColor,result[2]]).toEqual(['quiet inner space','42','aabbcc',true]);expect(source).toEqual(config());
});
it('private toggle preserves original checkbox callback result; expert fields and null VDI',async()=>{
 const {w}=setup(ConfigDialog,{config:config(),vdiconfig:null});expect(w.text()).not.toContain('Virtual Desktop (VDI)');
 model(w,'privateConf').element.focus();model(w,'privateConf').element.click();await flushPromises();expect(model(w,'privateConf').element.checked).toEqual(true);await w.get('[data-action=save]').trigger('click');expect(w.emitted('close')[0][0][0].config.LINBO.School).toEqual('default-school');
 model(w,'privateConf').element.click();await flushPromises();expect(model(w,'privateConf').element.checked).toEqual(false);await w.get('[data-action=save]').trigger('click');expect(w.emitted('close')[1][0][0].config.LINBO.School).toEqual('p84-school');
});
it('VDI edits alone leave config unchanged, empty numbers are null and VMID add/remove preserves types',async()=>{
 const {w}=setup();await w.get('[data-tab=vdi]').trigger('click');
 await model(w,'vdiconfig.cores').setValue('');await model(w,'vdiconfig.name').setValue('  VM Name  ');
 await model(w,'newvmid').setValue('222');await w.get('[data-action=add-vmid]').trigger('click');await w.get('[data-remove-vmid="0"]').trigger('click');
 await model(w,'expert').setValue(true);expect(model(w,'vdiconfig.tag').isVisible()).toEqual(true);
 await w.get('[data-action=save]').trigger('click');const result=w.emitted('close')[0][0];expect([result[1].cores,result[1].name,result[1].vmids,result[2]]).toEqual([null,'VM Name',[102,222],false]);
});
it('nested partition cancel leaves config unchanged, accepted edit remaps and remove needs accept',async()=>{
 const {w,modal}=setup();await w.get('[data-tab=partitions]').trigger('click');modal.mockRejectedValueOnce(Error('cancel'));
 await w.findAll('[data-edit-partition]')[1].trigger('click');await flushPromises();
 modal.mockResolvedValueOnce({partition:{...config().partitions[1],Size:'44G'},os:{...config().os[0],Name:'Test OS'}});
 await w.findAll('[data-edit-partition]')[1].trigger('click');await flushPromises();
 modal.mockRejectedValueOnce(Error('cancel'));await w.findAll('[data-remove-partition]')[0].trigger('click');await flushPromises();
 expect(w.findAll('[data-edit-partition]').length).toEqual(3);
 modal.mockResolvedValueOnce({response:'accept'});await w.findAll('[data-remove-partition]')[0].trigger('click');await flushPromises();
 await w.get('[data-action=save]').trigger('click');const data=w.emitted('close')[0][0][0];expect(data.partitions.map(p=>[p.Dev,p.Size])).toEqual([['/dev/sda1','44G'],['/dev/sda2','']]);expect(data.os[0].Name).toEqual('Test OS');
});
it('backup success closes editor, dismissal leaves it open; close never saves',async()=>{
 const {w,modal}=setup();modal.mockRejectedValueOnce(Error('cancel'));await w.get('[data-action=backups]').trigger('click');await flushPromises();expect(w.emitted('cancel')).toEqual(undefined);
 modal.mockResolvedValueOnce();await w.get('[data-action=backups]').trigger('click');await flushPromises();expect(modal.mock.calls.map(c=>[c[1].path,c[1].encoding,typeof c[1].deleteAction])).toEqual([['/srv/linbo/start.conf.p84',undefined,'function'],['/srv/linbo/start.conf.p84',undefined,'function']]);expect(w.emitted('cancel')).toEqual([[]]);expect(w.emitted('close')).toEqual(undefined);
});
it('partition loads image/icon choices, retains missing image, png warning and filters icons',async()=>{
 const source={...config().os[0],IconName:'old.png'}, {w,prompt}=setup(PartitionDialog,{partition:config().partitions[1],os:source});await flushPromises();
 expect(w.findAll('[data-icon]').map(i=>i.attributes('data-icon'))).toEqual(['ubuntu.svg','win10.svg']);expect(w.text()).toContain('png');
 expect(model(w,'os.BaseImage').findAll('option').map(o=>o.text())).toEqual(['None','linux.qcow2','missing.qcow2']);
 prompt.mockResolvedValueOnce({value:'new.qcow2'});await w.get('[data-action=new-image]').trigger('click');await flushPromises();expect(model(w,'os.BaseImage').text()).toContain('new.qcow2');
 await model(w,'partition.Label').setValue('bad label');await w.get('[data-action=save]').trigger('click');expect(w.emitted('close')[0][0].partition.Label).toEqual(undefined);expect(source.IconName).toEqual('old.png');
});
it('partition list failures keep choices undefined, cancel does not emit drafts',async()=>{
 const {w}=setup(PartitionDialog,{partition:config().partitions[0],os:null},{fail:true});await flushPromises();expect(w.findAll('[data-icon]')).toEqual([]);await w.get('[data-action=cancel]').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);expect(w.emitted('close')).toEqual(undefined);
});
it('accept dialog carries only explicit confirmation and cancellation',async()=>{
 const {w}=setup(AcceptDialog,{partition:'/dev/sda1',disk:{name:'/dev/sda'}},{gettext:text=>text==='Remove Partition {{partition}}'?'Entferne {{partition}}':text});expect(w.text()).toContain('Entferne /dev/sda1');await w.get('[data-action=save]').trigger('click');await w.get('[data-action=cancel]').trigger('click');expect(w.emitted('close')).toEqual([[{response:'accept'}]]);expect(w.emitted('cancel')).toEqual([[]]);
});

it('invalid color drops model and close discards edits',async()=>{
 const {w}=setup();await model(w,'config.config.LINBO.BackgroundColor').setValue('red');await w.get('[data-action=save]').trigger('click');expect(w.emitted('close')[0][0][0].config.LINBO.BackgroundColor).toEqual(undefined);
 const cancel=setup();await model(cancel.w,'config.config.LINBO.RootTimeout').setValue('30');await cancel.w.get('[data-action=cancel]').trigger('click');expect(cancel.w.emitted('close')).toEqual(undefined);expect(cancel.w.emitted('cancel')).toEqual([[]]);
});
it('page opens editor from either group action and imports only after successful config POST',async()=>{
 const {default:LinboPage}=await import('./LinboPage.vue');
 const calls=[],modal=vi.fn().mockResolvedValueOnce([config(),null,true]).mockRejectedValueOnce(Error('cancel'));
 const aj=createMockAj({modal:{open:modal},http:async r=>{calls.push(r);return {data:r.url.endsWith('/configs')?[{file:'start.conf.p84',images:[],settings:{}}]:r.url.includes('/config/')?config():[]};}});
 const w=mount(LinboPage,{global:{provide:{aj}}});await flushPromises();await w.get('button:has(.fa-pencil)').trigger('click');await flushPromises();
 expect(w.find('[data-action=import]').exists()).toEqual(true);expect(calls.filter(r=>r.method==='post').map(r=>r.url)).toEqual(['/api/lmn/linbo4/config/start.conf.p84','/api/lmn/linbo4/vdi/start.conf.p84.vdi']);
 await w.get('tbody td').trigger('click');await flushPromises();expect(modal.mock.calls.length).toEqual(2);w.unmount();
});
it('dragging an OS partition across disks remaps root/cache; add and remove disk actions keep the original presets',async()=>{
 const {w}=setup();await w.get('[data-tab=partitions]').trigger('click');await w.get('[data-action=add-disk]').trigger('click');
 await w.findAll('.partition-block')[1].trigger('dragstart');await w.get('[data-disk="1"]').trigger('drop');
 await w.get('[data-disk="1"] [data-kind="Linux"]').trigger('click');
 await w.get('[data-action=add-disk]').trigger('click');
 await w.get('[data-disk="2"] button').trigger('click');expect(w.findAll('[data-disk]').length).toEqual(2);
 await w.get('[data-action=save]').trigger('click');const data=w.emitted('close')[0][0][0];
 expect([data.config.LINBO.Cache,data.os.map(o=>o.Root),data.partitions.map(p=>p.Dev)]).toEqual(['/dev/sda2',['/dev/sdb1','/dev/sdb2'],['/dev/sda1','/dev/sda2','/dev/sdb1','/dev/sdb2']]);
});
it('partition advanced fields preserve NTFS kernel selection, typed timeout and boot flags; icon menu closes outside/on Escape',async()=>{
 const {w,prompt}=setup(PartitionDialog,{partition:{...config().partitions[1],FSType:'ntfs'},os:config().os[0]});await flushPromises();
 const advanced=w.findAll('button').find(b=>b.text()==='Advanced');await advanced.trigger('click');
 await model(w,'partition.Id').setValue('7');await model(w,'partition.FSType').setValue('ntfs');
 await w.findAll('.nav-tabs a')[1].trigger('click');await model(w,'os.Kernel').setValue('reboot');
 await model(w,'os.Autostart').setValue(true);await model(w,'os.AutostartTimeout').setValue('  10  ');await model(w,'os.Hidden').setValue(false);
 const toggle=w.get('button:has(img)');await toggle.trigger('click');expect(toggle.attributes('aria-expanded')).toEqual('true');document.body.click();await w.vm.$nextTick();expect(toggle.attributes('aria-expanded')).toEqual('false');
 await toggle.trigger('click');window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await w.vm.$nextTick();expect(toggle.attributes('aria-expanded')).toEqual('false');
 await toggle.trigger('click');await w.get('[data-icon="win10.svg"]').trigger('click');
 prompt.mockRejectedValueOnce(Error('cancel'));await w.get('[data-action=new-image]').trigger('click');await flushPromises();
 await w.get('[data-action=save]').trigger('click');const result=w.emitted('close')[0][0];expect([result.partition.Id,result.os.Kernel,result.os.IconName,result.os.Autostart,result.os.AutostartTimeout,result.os.Hidden]).toEqual(['7','reboot','win10.svg',true,'10',false]);
});
it('invalid numeric browser input is undefined while clearing a valid number remains null',async()=>{
 const {w}=setup();await w.get('[data-tab=vdi]').trigger('click');
 const cores=model(w,'vdiconfig.cores');Object.defineProperty(cores.element,'validity',{value:{badInput:true}});cores.element.value='';await cores.trigger('input');
 await w.get('[data-action=save]').trigger('click');expect(w.emitted('close')[0][0][1]).toEqual({...vdi(),cores:undefined});
});

it('preserves untouched invalid color and label; only real config edits trigger a config POST',async()=>{
 for(const change of ['none','vdi','size']) {
  const source=config();source.config.LINBO.BackgroundColor='black';source.partitions[1].Label='ubuntu-root';
  const requests=[];let result,partitionResult;
  const aj=createMockAj({http:async req=>{requests.push(req);return {data:req.url.includes('/vdi/')?vdi():source};},modal:{open:async()=>{
   const {w,modal}=setup(ConfigDialog,{config:source,vdiconfig:vdi()});
   modal.mockImplementationOnce(async(Component,props)=>{
    const child=setup(Component,props).w;
    if(change==='size')await model(child,'partition.Size').setValue('44G');
    await child.get('[data-action=save]').trigger('click');
    partitionResult=child.emitted('close')[0][0];
    return partitionResult;
   });
   await w.get('[data-tab=partitions]').trigger('click');await w.findAll('[data-edit-partition]')[1].trigger('click');await flushPromises();
   if(change==='vdi')await model(w,'vdiconfig.cores').setValue('4');
   await w.get('[data-action=save]').trigger('click');
   result=w.emitted('close')[0][0];
   return result;
  }}});
  await editConfig(aj,'start.conf.p84',vi.fn());
  expect(partitionResult.partition.Label).toEqual('ubuntu-root');
  expect(result[0].config.LINBO.BackgroundColor).toEqual('black');
  expect(result[0].partitions[1].Label).toEqual('ubuntu-root');
  const writes=requests.filter(req=>req.method==='post'&&req.url.includes('/config/'));
  expect(writes).toHaveLength(change==='size'?1:0);
  if(change==='size')expect(writes[0].data.partitions[1].Size).toEqual('44G');
 }
});
