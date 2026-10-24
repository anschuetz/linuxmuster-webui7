import { expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { editorConfig as config, editorVDI as vdi } from '../../../e2e/fixtures/linbo4-editor.mjs';
import { prepareEditor, rebuildDisks, addDisk, changeDiskType, addPartition, removePartition, partitionSize, partitionName, partitionColor, saveEditor, editConfig } from './config.mjs';
const base='/api/lmn/linbo4';
it('copies input, prefixes background, tags cache and saves unchanged',()=>{
 const source=config(),s=prepareEditor(source,vdi());expect(source).toEqual(config());
 expect(s.config.config.LINBO.BackgroundColor).toEqual('#112233');
 expect(s.disks.map(d=>[d.name,d.DiskType,d.partitions.map(p=>p._isCache)])).toEqual([['/dev/sda','sata',[false,false,true]]]);
 expect(saveEditor(s)).toEqual([{...config(),partitions:config().partitions.map(p=>({...p,_isCache:p.Dev==='/dev/sda3'}))},vdi(),false]);
});
it.each([['mmc','/dev/mmcblk0p'],['nvme','/dev/nvme0n1p'],['disk','/dev/disk0p'],['sata','/dev/sdb']])('remaps %s cache and OS immutably',(type,name)=>{
 const s=prepareEditor(config(),null),n=changeDiskType(s,0,type);
 expect([n.disks[0].name,n.config.config.LINBO.Cache,n.config.os[0].Root,n.config.os[0].Boot]).toEqual([name,name+'3',name+'2',name+'2']);
 expect(s.disks[0].name).toEqual('/dev/sda');expect(saveEditor(n)[2]).toEqual(true);
});
it('groups all source types and preserves lexical partition sorting',()=>{
 const source=config();source.partitions=['/dev/sda2','/dev/sda10','/dev/mmcblk0p1','/dev/nvme0n1p1','/dev/disk0p1'].map(Dev=>({Dev}));
 expect(prepareEditor(source,null).disks.map(d=>[d.name,d.DiskType,d.partitions.map(p=>p.Dev)])).toEqual([['/dev/sda','sata',['/dev/sda10','/dev/sda2']],['/dev/mmcblk0p','mmc',['/dev/mmcblk0p1']],['/dev/nvme0n1p','nvme',['/dev/nvme0n1p1']],['/dev/disk0p','disk',['/dev/disk0p1']]]);
});
it('adds unique disks and each partition default, including original undefined icon suffix',()=>{
 let s=addDisk(prepareEditor(config(),null));expect(s.disks[1]).toEqual({name:'/dev/sdb',DiskType:'sata',partitions:[]});
 for(const kind of ['EFI','MSR','Windows','Linux','Swap','Data','Extended','Cache'])s=addPartition(s,1,kind);
 expect(s.disks[1].partitions.map(p=>[p.Id,p.Size,p.FSType,p.Bootable])).toEqual([['ef',204800,'vfat',true],['0c01',131072,'',false],['7','40G','ntfs',true],['83','20G','ext4',true],['82','4G','swap',false],['7','10G','ntfs',false],['5','','',false],['83','','ext4',false]]);
 expect(s.config.os.slice(-2).map(o=>[o.Name,o.IconName,o.Root])).toEqual([['Windows 10','win10.undefined','/dev/sdb3'],['Ubuntu','ubuntu.undefined','/dev/sdb4']]);expect(s.config.config.LINBO.Cache).toEqual('/dev/sdb8');
});
it('removes and renumbers while retaining orphan OS and undefined boot/root',()=>{
 const s=removePartition(prepareEditor(config(),null),0,1);expect(s.disks[0].partitions.map(p=>p.Dev)).toEqual(['/dev/sda1','/dev/sda2']);expect([s.config.os[0].Root,s.config.os[0].Boot,s.config.config.LINBO.Cache]).toEqual([undefined,undefined,'/dev/sda2']);
});
it('reorders across disks',()=>{
 const s=addDisk(prepareEditor(config(),null)), n=rebuildDisks({...s,disks:[{...s.disks[0],partitions:[s.disks[0].partitions[2],s.disks[0].partitions[0]]},{...s.disks[1],partitions:[s.disks[0].partitions[1]]}]});expect([n.config.os[0].Root,n.config.config.LINBO.Cache,saveEditor(n)[2]]).toEqual(['/dev/sdb1','/dev/sda1',true]);
});
it('preserves size parsing and partition title/border precedence',()=>{
 expect(['1M','2g','1t','123','',204800].map(Size=>partitionSize({Size}))).toEqual([1048576,2147483648,1099511627776,125952,undefined,undefined]);
 const s=prepareEditor(config(),null);expect(s.disks[0].partitions.map(p=>[partitionName(s,p,x=>x),partitionColor(s,p)])).toEqual([['EFI','#737373'],['Ubuntu','#3232B7'],['LINBO Cache','#F3E000']]);
 expect([{FSType:'swap'},{Id:'0c01'},{Label:'data'},{}].map(p=>partitionName(s,p,x=>x))).toEqual(['Swap','MSR','data','Partition']);expect([{FSType:'swap'},{}].map(p=>partitionColor(s,p))).toEqual(['#E09305','#58B158']);
});
function setup(result,fail=''){
 const requests=[],changed=vi.fn(),notify=vi.fn(),modal=vi.fn(async()=>{if(result instanceof Error)throw result;return result;});
 const aj=createMockAj({modal:{open:modal},notify,http:async req=>{requests.push(req);if(req.url===fail)throw Error('failed');return {data:req.url.includes('/vdi/')?vdi():config()};}});return {aj,requests,changed,notify,modal};
}
it('opens config then VDI and saves both independently, marks dirty only after config success',async()=>{
 const s=setup([config(),vdi(),true]);await editConfig(s.aj,'start.conf.p84',s.changed);
 expect(s.requests.map(r=>[r.method,r.url,r.data])).toEqual([['get',base+'/config/start.conf.p84',undefined],['get',base+'/vdi/start.conf.p84.vdi',undefined],['post',base+'/config/start.conf.p84',config()],['post',base+'/vdi/start.conf.p84.vdi',vdi()]]);expect(s.changed.mock.calls).toEqual([[]]);
});
it('unchanged and null VDI still POST VDI; cancellation has no writes',async()=>{
 const s=setup(saveEditor(prepareEditor(config(),null)));await editConfig(s.aj,'start.conf.p84',s.changed);expect(s.requests.filter(r=>r.method==='post').map(r=>r.data)).toEqual([null]);expect(s.changed.mock.calls).toEqual([]);
 const c=setup(Error('cancel'));await editConfig(c.aj,'start.conf.p84',c.changed);expect(c.requests.map(r=>r.method)).toEqual(['get','get']);
});
it.each(['config','vdi'])('failed %s load opens no dialog',async kind=>{
 const s=setup(null,base+`/${kind}/start.conf.p84${kind==='vdi'?'.vdi':''}`);await editConfig(s.aj,'start.conf.p84',s.changed);expect(s.modal.mock.calls).toEqual([]);expect(s.changed.mock.calls).toEqual([]);
});
it('failed config POST retains dirty false and still saves VDI',async()=>{
 const s=setup([config(),null,true]);s.aj.http.post=async(url,data)=>{s.requests.push({method:'post',url,data});if(url.includes('/config/'))throw Error('failed');};await editConfig(s.aj,'start.conf.p84',s.changed);expect(s.changed.mock.calls).toEqual([]);expect(s.requests.filter(r=>r.method==='post').map(r=>r.url)).toEqual([base+'/config/start.conf.p84',base+'/vdi/start.conf.p84.vdi']);
});
it('LINBO backup delete cancellation stays closed; confirmation removes and reopens before HTTP completion',async()=>{
 const {configBackups}=await import('./config.mjs');const open=vi.fn(async()=>undefined),show=vi.fn(),notify=vi.fn(),requests=[];
 let finish;const aj=createMockAj({modal:{open},notify,messagebox:{show},http:req=>{requests.push(req);return new Promise(resolve=>{finish=resolve;});}});
 await configBackups(aj,'p84');const props=open.mock.calls[0][1];
 show.mockRejectedValueOnce(Error('cancel'));await props.deleteAction({name:'.start.conf.p84.bak.200'});expect(requests).toEqual([]);expect(open.mock.calls.length).toEqual(1);
 show.mockResolvedValueOnce();const deletion=props.deleteAction({name:'.start.conf.p84.bak.200'});await Promise.resolve();
 expect(requests).toEqual([{method:'post',url:'/api/lmn/remove-file',data:{filepath:'/srv/linbo/.start.conf.p84.bak.200'},cfg:undefined}]);expect(open.mock.calls.length).toEqual(2);
 expect(notify.mock.calls).toEqual([['success','Backup file removed',undefined]]);finish({data:null});await deletion;
});
