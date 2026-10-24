import { expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { createDestructiveActions, replaceImage } from './imageActions.mjs';
const base='/api/lmn/linbo4';
const cases=[
 ['deleteImage',[{name:'main'}],'delete','/images/main',undefined,{title:"Delete 'main' ?",text:'This deletes the whole directory /srv/linbo/images/main, with its backups, its differential image and every file in it, including files added by hand.',positive:'Delete',negative:'Cancel'},'Failed to delete image :'],
 ['deleteDiffImage',[{name:'main',diff:true}],'delete','/deleteDiffImage/main',undefined,{text:"Delete 'main' differential image?",positive:'Delete',negative:'Cancel'},'Failed to delete backup :'],
 ['deleteBackupImage',[{name:'main'},'20261001'],'post','/deleteBackupImage/main',{date:'20261001'},{title:"Delete the backup of 'main' ?",text:'This deletes the whole backup directory of 20261001 in /srv/linbo/images/main/backups, including files added by hand.',positive:'Delete',negative:'Cancel'},'Failed to delete backup :'],
 ['restoreBackup',[{name:'main'},'20261001'],'post','/restoreBackupImage/main',{date:'20261001'},{text:"Do you really want to restore the backup at '20261001'? This will move the actual image to a backup.",positive:'Restore',negative:'Cancel'},'Failed to restore backup! '],
];
function setup(http=async()=>({data:null})) {
 const show=vi.fn(async()=>{}),notify=vi.fn(),restart=vi.fn(async()=>{}),calls=[];
 const aj=createMockAj({messagebox:{show},notify,http:async r=>{calls.push(r);return http(r);}});
 return {show,notify,restart,calls,actions:createDestructiveActions(aj,restart)};
}
it.each(cases)('%s confirms exact warning, cancels without writes and restarts once after success',async(action,args,method,url,data,warning)=>{
 const {show,restart,calls,actions}=setup();show.mockRejectedValueOnce('cancel');await actions[action](...args);
 expect(calls).toEqual([]);expect(restart.mock.calls).toEqual([]);await actions[action](...args);
 expect(show.mock.calls).toEqual([[warning],[warning]]);expect(calls).toEqual([{method,url:base+url,data,cfg:undefined}]);expect(restart.mock.calls).toEqual([[]]);
});
it.each(cases)('%s reports backend error without restart',async(action,args,_method,_url,_data,_warning,prefix)=>{
 const {actions,restart,notify}=setup(async()=>{throw {data:{message:'fixture failure'}};});
 await actions[action](...args);expect(notify.mock.calls).toEqual([['error',prefix+'fixture failure',undefined]]);expect(restart.mock.calls).toEqual([]);
});
it('launches batch deletes in parallel and restarts only after the last succeeds',async()=>{
 const finish=[],{show,actions,calls,restart}=setup(()=>new Promise(resolve=>finish.push(resolve)));
 const pending=actions.deleteImages([{name:'a'},{name:'b'}]);await Promise.resolve();
 expect(calls.map(r=>[r.method,r.url])).toEqual([['delete',base+'/images/a'],['delete',base+'/images/b']]);
 expect(show.mock.calls).toEqual([[{title:"Delete 'a,b' ?",text:'This deletes the whole directory of each image in /srv/linbo/images, with its backups, its differential image and every file in it, including files added by hand.',positive:'Delete',negative:'Cancel'}]]);
 finish[0]({data:null});await Promise.resolve();expect(restart.mock.calls).toEqual([]);finish[1]({data:null});await pending;expect(restart.mock.calls).toEqual([[]]);
});
it('cancels batch and preserves no restart on partial failure',async()=>{
 const {show,actions,calls,restart,notify}=setup(async r=>{if(r.url.endsWith('/b'))throw {data:{message:'batch'}};return {data:null};});
 show.mockRejectedValueOnce('cancel');await actions.deleteImages([{name:'a'},{name:'b'}]);expect(calls).toEqual([]);
 await actions.deleteImages([{name:'a'},{name:'b'}]);expect(calls.length).toEqual(2);expect(restart.mock.calls).toEqual([]);expect(notify.mock.calls).toEqual([['error','Failed to delete image :batch',undefined]]);
});
it('updates backup map and list together, preserving the original and allowing repeated saves',()=>{
 const backup={name:'main',backup:true,date:'date',timestamp:1,desc:'old'};
 const source=[{name:'main',backups:{date:backup},backups_list:[backup],diff_image:{name:'main',diff:true}}];
 const result={...backup,desc:'saved'},next=replaceImage(source,backup,result);
 expect(next[0].backups.date).toEqual(result);expect(next[0].backups_list).toEqual([result]);expect(next[0].backups.date).toBe(next[0].backups_list[0]);expect(source[0].backups.date.desc).toEqual('old');
 const newer={...result,desc:'second'};expect(replaceImage(next,result,newer)[0].backups_list).toEqual([newer]);
 expect(replaceImage(source,source[0],{...source[0],desc:'main'})[0].desc).toEqual('main');
 expect(replaceImage(source,source[0].diff_image,{diff:true,desc:'diff'})[0].diff_image).toEqual({diff:true,desc:'diff'});
});

it('keeps backup map/list shared after a whole-image draft has been serialized',()=>{
 const backup={date:'date',desc:'old'},source=[{name:'main',backups:{date:backup},backups_list:[backup]}];
 const draft=JSON.parse(JSON.stringify(source[0]));
 const next=replaceImage(source,source[0],draft);
 expect(next[0].backups_list[0]).toBe(next[0].backups.date);
 expect(replaceImage(next,next[0].backups_list[0],{date:'date',desc:'saved'})[0].backups.date).toEqual({date:'date',desc:'saved'});
});

it('sets the images hash after successful main/batch deletes even when restart returns without reload',async()=>{
 for(const action of ['deleteImage','deleteImages']) {
  window.history.replaceState({},'', '/view/lmn/linbo4');
  const {actions}=setup();await actions[action](action==='deleteImages'?[{name:'a'}]:{name:'a'});
  expect(window.location.hash).toEqual('#images');
 }
 window.history.replaceState({},'', '/');
});
