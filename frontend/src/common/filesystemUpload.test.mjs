import { expect, it, vi } from 'vitest';
import { createMockAj } from '../adapter/mock.mjs';
import { uploadFilesystem } from './filesystemUpload.mjs';
const file=(size=20)=>new File([new Uint8Array(size)], 'p124.csv', {type:'text/csv'});
function setup(fn=()=>({data:[],status:204})) { const calls=[];const aj=createMockAj({http:async r=>{calls.push(r);return fn(r);}});return {calls,aj}; }
it('uses Flow metadata, nominal 1 MiB chunks with last remainder, multipart and filesystem finish only',async()=>{
 const s=setup(),progress=vi.fn();await uploadFilesystem(s.aj,file(2097275),'/tmp/',progress);
 const posts=s.calls.filter(r=>r.method==='post'&&r.url==='/api/filesystem/upload');
 expect(posts.map(r=>r.data.get('flowCurrentChunkSize'))).toEqual(['1048576','1048699']);
 expect(posts.map(r=>r.data.get('file').size)).toEqual([1048576,1048699]);
 expect(posts.every(r=>r.cfg.headers['Content-Type']===undefined)).toEqual(true);
 expect(s.calls.at(-1)).toMatchObject({method:'post',url:'/api/filesystem/finish-upload',data:[{id:'2097275-p124csv',path:'/tmp/',name:'p124.csv'}]});
 expect(progress.mock.calls.at(-1)).toEqual([1]);
});
it('skips an existing chunk (200), but sends a missing chunk (204)',async()=>{
 const s=setup(r=>({data:[],status:r.method==='get'?200:200}));await uploadFilesystem(s.aj,file(),'/tmp/');expect(s.calls.map(r=>r.method)).toEqual(['get','post']);
});
it.each(['get','chunk'])('preserves Flow completion after a failed %s request',async phase=>{
 const s=setup(r=>{if((phase==='get'&&r.method==='get')||(phase==='chunk'&&r.url==='/api/filesystem/upload'&&r.method==='post'))throw Error('fixture');return {data:[],status:204};});
 await expect(uploadFilesystem(s.aj,file(),'/tmp/')).resolves.toEqual([]);expect(s.calls.at(-1).url).toEqual('/api/filesystem/finish-upload');
});
it('rejects finish failure',async()=>{
 const s=setup(r=>{if(r.url.endsWith('finish-upload'))throw Error('fixture');return {status:204};});await expect(uploadFilesystem(s.aj,file(),'/tmp/')).rejects.toThrow('fixture');
});
it('cancels an in-flight chunk request and never calls finish',async()=>{
 let complete;const s=setup(r=>r.method==='get'?new Promise(resolve=>{complete=resolve;}):({data:[]}));const t=uploadFilesystem(s.aj,file(),'/tmp/');t.cancel();complete({status:204});await expect(t).rejects.toMatchObject({name:'AbortError'});expect(s.calls).toHaveLength(1);
});
it('finish already in progress reports its result even when cancelled',async()=>{
 let finish;const s=setup(r=>r.url.endsWith('finish-upload')?new Promise(resolve=>{finish=resolve;}):{status:200});const t=uploadFilesystem(s.aj,file(),'/tmp/');await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));t.cancel();finish({data:['/tmp/p124.csv']});await expect(t).resolves.toEqual(['/tmp/p124.csv']);
});
