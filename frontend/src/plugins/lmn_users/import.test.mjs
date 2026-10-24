import { readFileSync } from 'node:fs';
import { createLocale } from '../../shell/locale.mjs';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { createImport, columnTitles, assignColumns, toggleColumn, moveColumn } from './import.mjs';
import UploadDialog from './UploadDialog.vue';
import SortListDialog from './SortListDialog.vue';
import ListManagement from './ListManagement.vue';
const columns=()=>Array.from({length:6},(_,i)=>({coloumn:i,data:['sample '+i]}));
const wrappers=[];
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());document.body.innerHTML='';});
const render=(Component,aj,props={})=>{const w=mount(Component,{props,global:{provide:{aj}}});wrappers.push(w);return w;};
const button=(w,text)=>w.findAll('button').find(x=>x.text()===text);
function setup(){const requests=[],notify=vi.fn(),refresh=vi.fn(),open=vi.fn().mockResolvedValue(columns());const aj=createMockAj({notify,modal:{open},http:async r=>{requests.push(r);return {status:r.method==='get'?204:200,data:r.url.endsWith('/import')&&r.data.action==='get'?columns():['LOG','imported']};}});return {requests,notify,refresh,open,aj};}
it('initial titles match both originals; append not-used only to fit CSV, no new role mappings',()=>{
 expect(columnTitles('students.csv',x=>x).map(x=>x.id)).toEqual(['class','lastname','firstname','birthday']);expect(columnTitles('teachers.csv',x=>x).map(x=>x.id)).toEqual(['lastname','firstname','birthday','login']);expect(columnTitles('parents.csv',x=>x)).toEqual(undefined);
 const input=columns(),result=assignColumns(input,columnTitles('students.csv',x=>x),x=>x);expect(result.titles.map(x=>x.name)).toEqual(['class','lastname','firstname','birthday','not used','not used']);expect(result.data.map(x=>x.coloumn)).toEqual(['class','lastname','firstname','birthday',undefined,undefined]);expect(input).toEqual(columns());
});
it('custom inserts at index four, toggles without mutation; reordering changes mapped fields only',()=>{
 const initial=assignColumns(columns(),columnTitles('teachers.csv',x=>x),x=>x).titles;const custom=toggleColumn(initial,'password');expect(initial).toHaveLength(6);expect(custom.map(x=>x.id)).toEqual(['lastname','firstname','birthday','login','password',undefined,undefined]);
 const moved=moveColumn(custom,0,1);expect(assignColumns(columns(),moved,x=>x).data.map(x=>x.coloumn)).toEqual(['firstname','lastname','birthday','login','password',undefined]);expect(toggleColumn(custom,'password')).toEqual(initial);
});
it.each([true,false])('import mode %s preserves exact payload, LOG refresh and two translated notices',async check=>{
 const s=setup();await createImport(s.aj).complete('students','p124.csv',check,s.refresh);
 expect(s.requests.map(r=>[r.url,r.data])).toEqual(check?[
 ['/api/lmn/users/lists/import',{action:'get',path:'/tmp/p124.csv',userlist:'students.csv'}],['/api/lmn/users/lists/import',{action:'save',data:columns(),userlist:'students.csv'}]
 ]:[['/api/lmn/users/lists/csv',{tmp_path:'/tmp/p124.csv',userlist:'students.csv'}]]);
 expect(s.refresh.mock.calls).toEqual([[]]);expect(s.notify.mock.calls.map(x=>x.slice(0,2))).toEqual([['success','imported'],['success','Saved']]);
});
it('ERROR is raw, without refresh; unknown result has no effects',async()=>{
 for(const data of [['ERROR','raw'],['OTHER','ignored']]){const s=setup();s.aj.http.post=vi.fn().mockResolvedValue({data});await createImport(s.aj).complete('teachers','p124.csv',false,s.refresh);expect(s.refresh.mock.calls).toEqual([]);expect(s.notify.mock.calls.map(x=>x.slice(0,2))).toEqual(data[0]==='ERROR'?[['error','raw']]:[]);}
});
it('sort dismissal never saves, HTTP errors never refresh',async()=>{
 const s=setup();s.open.mockRejectedValue(Error('dismiss'));await createImport(s.aj).complete('students','p124.csv',true,s.refresh);expect(s.requests).toHaveLength(1);expect(s.refresh.mock.calls).toEqual([]);
 s.aj.http.post=vi.fn().mockRejectedValue(Error('HTTP'));await expect(createImport(s.aj).complete('students','p124.csv',false,s.refresh)).rejects.toThrow('HTTP');
});
it('sort modal custom/reorder/accept and abort keep raw samples, unused id omitted from JSON',async()=>{
 const s=setup(),w=render(SortListDialog,s.aj,{userlist:'students.csv',columns:columns()});await w.get('input[type=checkbox]').setValue(true);await w.findAll('[data-column-title]')[0].trigger('dragstart');await w.findAll('[data-column-title]')[1].trigger('drop');await button(w,'Accept Sorting').trigger('click');
 expect(JSON.parse(JSON.stringify(w.emitted('close')[0][0])).map(x=>x.coloumn)).toEqual(['lastname','class','firstname','birthday','id',undefined]);expect(w.text()).toContain('sample 0');await button(w,'Abort').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);
});
it('upload close before selection never sends a request',async()=>{const s=setup(),w=render(UploadDialog,s.aj,{role:'students',refresh:s.refresh});await button(w,'Close').trigger('click');expect(s.requests).toEqual([]);expect(w.emitted('close')).toEqual([[]]);});
it('upload keeps progress title inside its dialog; then mapped workflow reloads only the list',async()=>{
 const s=setup();let release;const post=s.aj.http.post;s.aj.http.post=(url,...args)=>url==='/api/filesystem/upload'?new Promise(resolve=>release=()=>resolve({status:200})):post(url,...args);
 const w=render(UploadDialog,s.aj,{role:'students',refresh:s.refresh});const input=w.findAll('input[type=file]')[1];Object.defineProperty(input.element,'files',{value:[new File(['abc'],'p124.csv')]});await input.trigger('change');await flushPromises();expect(w.get('h4').text()).toEqual('Uploading: 0%');expect(w.find('[role=progressbar]').exists()).toEqual(true);release();await flushPromises();expect(s.refresh.mock.calls).toEqual([[]]);expect(w.emitted('close')).toEqual([[]]);expect(s.notify.mock.calls[0].slice(0,2)).toEqual(['success','Uploaded']);
});
it('unmount during upload aborts before finish or import; HTTP failure leaves progress open without success',async()=>{
 const s=setup();let done;s.aj.http.get=()=>new Promise(resolve=>done=resolve);const w=render(UploadDialog,s.aj,{role:'students',refresh:s.refresh});const input=w.findAll('input[type=file]')[0];Object.defineProperty(input.element,'files',{value:[new File(['x'],'p124.csv')]});await input.trigger('change');w.unmount();wrappers.pop();done({status:204});await flushPromises();expect(s.requests).toEqual([]);expect(s.refresh.mock.calls).toEqual([]);
 const f=setup();f.aj.http.post=vi.fn().mockRejectedValue(Error('failure'));const v=render(UploadDialog,f.aj,{role:'students',refresh:f.refresh});const field=v.findAll('input[type=file]')[0];Object.defineProperty(field.element,'files',{value:[new File(['x'],'p124.csv')]});await field.trigger('change');await flushPromises();expect(v.get('h4').text()).toEqual('Uploading: 0%');expect(f.notify.mock.calls).toEqual([]);expect(v.emitted('close')).toEqual(undefined);
});
it('Listmanagement opens the upload with static backdrop, refreshes forcefully after LOG',async()=>{
 const s=setup();s.aj.http.get=vi.fn().mockResolvedValue({data:[]});const w=render(ListManagement,s.aj);await flushPromises();await w.get('[data-list=students] [data-action=csv-menu]').trigger('click');await w.get('[data-list=students] [data-action=upload]').trigger('click');expect(s.open).toHaveBeenCalledWith(UploadDialog,expect.objectContaining({role:'students',refresh:expect.any(Function)}),{backdrop:'static'});const count=s.aj.http.get.mock.calls.length;await s.open.mock.calls[0][1].refresh();expect(s.aj.http.get.mock.calls.length).toEqual(count+1);expect(w.find('[data-list=extrastudents] [data-action=upload]').exists()).toEqual(false);
});

it('loads actual German PO for upload warning, controls and sort labels',async()=>{
 const po=readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_users/locale/de/LC_MESSAGES/app.po','utf8');
 const catalog={};for(const entry of po.split(/\n\n/)){const match=entry.match(/msgid ((?:".*"\n?)+)msgstr ((?:".*"\n?)+)/);if(match){const parse=text=>text.trim().split('\n').map(line=>JSON.parse(line)).join('');catalog[parse(match[1])]=parse(match[2]);}}
 const locale=createLocale({http:{get:async()=>({data:catalog})}});await locale.setLanguage('de');const s=setup();s.aj.gettext=locale.gettext;
 const upload=render(UploadDialog,s.aj,{role:'teachers',refresh:s.refresh});expect(upload.get('h4').text()).toEqual('CSV laden');expect(upload.text()).toContain('Möchten Sie eine Liste csv hochladen?');expect(upload.text()).toContain('Direkt speichern');expect(upload.text()).toContain('Spalten überprüfen');
 const sort=render(SortListDialog,s.aj,{userlist:'teachers.csv',columns:columns()});expect(sort.text()).toContain('Liste sortieren');expect(sort.text()).toContain('Linuxmuster muss wissen');expect(sort.text()).toContain('Sortierung akzeptieren');expect(sort.findAll('[data-column-title]').map(x=>x.text())).toEqual(['Nachname','Vorname','Geburtsdatum','benutzername','nicht verwendet','nicht verwendet']);
});

it('production list route mounts the registered Vue view without the old page controller',()=>{
 const root='../usr/lib/linuxmuster-webui/plugins/lmn_users/';
 expect(readFileSync(root+'resources/partial/listmanagement.html','utf8').trim()).toEqual('<lmn-vue-mount entry="LmnVue_lmn_users" view="listmanagement"></lmn-vue-mount>');
 expect(readFileSync(root+'resources/js/listmanagement.route.es','utf8')).not.toContain('controller:');
});

it.each(['parents.csv','staff.csv'])('retains raw numeric columns for undefined %s mapping',async userlist=>{
 const s=setup(),w=render(SortListDialog,s.aj,{userlist,columns:columns()});expect(w.findAll('[data-column-title]')).toEqual([]);expect(w.find('input[type=checkbox]').exists()).toEqual(false);await button(w,'Accept Sorting').trigger('click');expect(w.emitted('close')).toEqual([[columns()]]);
});
