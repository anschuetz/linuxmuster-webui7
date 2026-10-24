import { afterEach, expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { imageBytes, textRows, createImageActions } from './images.mjs';
import ImageDialog from './ImageDialog.vue';
const base = '/api/lmn/linbo4';
afterEach(() => window.history.replaceState({}, '', '/'));
function setup(overrides = {}) {
    const calls = [], notify = vi.fn(), reload = vi.fn(), replace = vi.fn();
    const aj = createMockAj({ notify, reload, http: async request => { calls.push(request); return {data:null}; }, ...overrides });
    return { aj, calls, notify, reload, replace, actions: createImageActions(aj, replace) };
}
it('keeps the bytes filter and initial description/info row counts', () => {
    expect([undefined,NaN,Infinity,0,12,1024,1536,1048575].map(n=>imageBytes(n,x=>x))).toEqual(['-','-','-','0 bytes','12 bytes','1.0 KB','1.5 KB','1024.0 KB']);
    expect(['',undefined,'a','a\r\nb\rc\n'].map(textRows)).toEqual([1,1,2,5]);
    expect(imageBytes(0,x=>'DE:'+x)).toEqual('DE:0 bytes');
});
it.each(['main','diff','backup'])('saves %s with the original payload, success and timed restart', async kind => {
    const image = {name:'p86',desc:'old', ...(kind==='diff'?{diff:true}:kind==='backup'?{backup:true,timestamp:123}: {})};
    const result = {...image,desc:'new'}, modal = {open:vi.fn(async()=>result)};
    const { actions, calls, notify, reload, replace }=setup({modal});
    await actions.editImage(image,[image]);
    expect(modal.open.mock.calls).toEqual([[ImageDialog,{image,images:[image],renameImage:actions.renameImage}]]);
    expect(replace.mock.calls).toEqual([[image,result]]);
    expect(image.desc).toEqual('old');
    expect(calls).toEqual([
        {method:'post',url:base+(kind==='backup'?'/saveBackupImage/p86':'/images/p86'),data:kind==='backup'?{data:result,timestamp:123}:{data:result,diff:image.diff},cfg:undefined},
        {method:'get',url:base+'/restart-services',data:undefined,cfg:undefined},
    ]);
    expect(notify.mock.calls).toEqual([['success',kind==='backup'?'Backup saved':'Saved',undefined],['info','Restarting multicast and torrent services, please wait ...','',{timeout:7000}],['success','Multicast and torrent services restarted',undefined]]);
    expect(window.location.hash).toEqual('#images'); expect(reload.mock.calls).toEqual([[]]);
});
it('cancels the editor without writes and retains the pre-write list update after save failure', async () => {
    const image={name:'p86'}, result={...image,info:'draft'};
    const {actions,calls,replace,notify}=setup({modal:{open:vi.fn().mockRejectedValueOnce('cancel').mockResolvedValueOnce(result)},http:async()=>{throw Error('save');}});
    await actions.editImage(image,[]); expect(replace.mock.calls).toEqual([]);
    await actions.editImage(image,[]); expect(replace.mock.calls).toEqual([[image,result]]);
    expect(calls).toEqual([]); expect(notify.mock.calls).toEqual([]);
});
it.each(['renameImage','duplicateImage'])('%s preserves prompt cancellation, name validation and duplicate acceptance', async action => {
    const prompt=vi.fn().mockRejectedValueOnce('cancel').mockResolvedValueOnce({value:'invalid.name'}).mockResolvedValueOnce({value:'p86'});
    const {actions,calls,notify}=setup({messagebox:{prompt}});
    for(let n=0;n<3;n++) await actions[action]({name:'p86'});
    expect(prompt.mock.calls).toEqual(Array(3).fill(['New name','p86']));
    expect(notify.mock.calls[0]).toEqual(['error','invalid.name is not a valid name for a linbo image.',undefined]);
    expect(calls.map(c=>[c.method,c.url,c.data])).toEqual([['post',base+'/'+action+'/p86',{new_name:'p86'}],['get',base+'/restart-services',undefined]]);
});
it('restart failure reports the original error, without hash/reload; rename rejection does not restart', async () => {
    const {actions,notify,reload}=setup({http:async()=>{throw Error('failure');}});
    await actions.restartServices();
    expect(notify.mock.calls).toEqual([['info','Restarting multicast and torrent services, please wait ...','',{timeout:7000}],['error','Failed to restart multicast and torrent services. Please see the log files',undefined]]);
    expect(reload.mock.calls).toEqual([]); expect(window.location.hash).toEqual('');
    notify.mockClear(); await actions.renameImage({name:'p86'}); expect(notify.mock.calls).toEqual([]);
});
