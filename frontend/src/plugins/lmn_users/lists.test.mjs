import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createLocale } from '../../shell/locale.mjs';
import { mount, flushPromises } from '@vue/test-utils';
import { createModalService } from '../../adapter/modal.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
import { createValidation } from '../../common/validation.mjs';
import { createLists, listFields, newListUser, validateListField, listRows, listTabs, hotkeyTabs } from './lists.mjs';
import ListManagement from './ListManagement.vue';
import AddUserDialog from './AddUserDialog.vue';
import CheckDialog from '../../common/users/CheckDialog.vue';
import FileEditorDialog from '../../common/FileEditorDialog.vue';
import FileBackupsDialog from '../../common/FileBackupsDialog.vue';
const row=(i=0)=>({class:'5a',last_name:'Synthetic',first_name:'User '+i,birthday:'1.1.2010',login:'fixture'+i,id:'id'+i,custom:{one:'preserved'}});
const wrappers=[];
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());document.body.innerHTML='';});
function setup(options={}) {
 const requests=[],notify=vi.fn(),reload=vi.fn(),open=vi.fn().mockResolvedValue();
 const aj=createMockAj({identity:{user:'global-admin'},notify,reload,modal:{open},http:async r=>{requests.push(r);return {data:r.url==='/api/lmn/activeschool'?'school-x':r.url==='/api/lmn/schoolsettings'?{encoding_courses_extra:'win1252'}:r.url==='/api/lmn/users/schoolconf'?{'userfile.teachers.csv':{SURNAME_CHARS:0,FIRSTNAME_CHARS:0}}:[row()]};},...options});
 return {aj,requests,notify,reload,open};
}
async function render(options={}){const s=setup(options),w=mount(ListManagement,{attachTo:document.body,global:{provide:{aj:s.aj}}});wrappers.push(w);await flushPromises();return {...s,w};}
const table=(w,kind='students')=>w.find(`[data-list="${kind}"]`);
const action=(w,name)=>w.find(`[data-action="${name}"]`);
const tab=(w,kind)=>w.find(`[data-tab="${kind}"]`).trigger('click');
it('keeps five original tabs, four hotkey names and six field definitions without custom columns',()=>{
 expect(listTabs).toEqual(['students','parents','teachers','extrastudents','staff']);expect(hotkeyTabs).toEqual(['students','parents','teachers','extrastudents']);
 expect(listFields('students').map(f=>[f.key,f.visible])).toEqual([['class',true],['last_name',true],['first_name',true],['birthday',true],['id',false]]);
 expect(listFields('courses').map(f=>f.key)).toEqual(['course','base_name','count','birthday','gecos','password','removal_date']);
});
it.each(['students','parents','teachers','staff','extrastudents'])('loads %s without encoding; saves complete rows including custom metadata',async kind=>{
 const s=setup(),api=createLists(s.aj);await api.load(kind);await api.save(kind,[row()],{parents:'cp1252'});
 expect(s.requests[0].url).toEqual('/api/lmn/users/lists/'+kind);expect(s.requests.at(-1)).toEqual({method:'post',url:`/api/lmn/users/lists/${kind}?encoding=${['parents','staff'].includes(kind)?'cp1252':'undefined'}`,data:[row()],cfg:undefined});
});
it.each([['utf8','utf-8'],['win1252','cp1252'],['','utf-8'],['unknown','ISO8859-1']])('only courses load settings and mapped encoding %s',async(setting,encoding)=>{
 const s=setup({http:async r=>{s.requests.push(r);return {data:r.url==='/api/lmn/schoolsettings'?{encoding_courses_extra:setting}:[]};}});expect(await createLists(s.aj).load('courses')).toEqual({rows:[],encoding});expect(s.requests.map(r=>r.url)).toEqual(['/api/lmn/schoolsettings',`/api/lmn/users/lists/extraclasses?encoding=${encoding}`]);
});
it.each([['default-school','/etc/linuxmuster/sophomorix/default-school/staff.csv'],['school-x','/etc/linuxmuster/sophomorix/school-x/school-x.staff.csv'],[undefined,'undefinedstaff.csv']])('school-specific path %s', (school,path)=>expect(createLists(setup().aj).path(school,'staff')).toEqual(path));
it('new users preserve exact role defaults and course rows contain only _isNew',()=>{
 expect(newListUser('parents')).toEqual({_isNew:true,role:'parent',class:'Parents',last_name:'',first_name:'',birthday:'01.01.1970',id:''});
 expect(newListUser('teachers')).toEqual({_isNew:true,role:'teacher',class:'Lehrer',last_name:'',first_name:'',birthday:'',login:''});
 expect(newListUser('staff').birthday).toEqual('01.01.1970');expect(newListUser('courses')).toEqual({_isNew:true});
});
it('broad search, new-row ordering and raw page slicing happen before comment suppression',()=>{
 const rows=[{...row(),class:'#comment'},row(1),{...row(2),_isNew:true}];expect(listRows(rows,'students','',undefined,1,2).map(x=>x.id)).toEqual(['id0','id1']);expect(listRows(rows,'students','preserved',undefined,2,2).map(x=>x.id)).toEqual(['id2']);expect(listRows(rows,'courses','unmatched','course',1,1)).toEqual(rows);
});
function validation(){const state={emptyCells:{},errorMessages:{}},v=createValidation({gettext:x=>x});return {state,run:(name,value,tab='students',index=0,lists={})=>validateListField(state,v,x=>x,{name,value,tab,index,page:1,size:50,lists,firstSave:false})};}
it('validation requires TODO fields and strict true; invalid date/string messages are errors',()=>{
 const s=validation();expect(s.run('TODOclass','')).toEqual('has-error-new');expect(s.state.emptyCells).toEqual({'TODOclass-students-1':1});expect(s.run('TODOclass','x')).toEqual('');expect(s.state.emptyCells).toEqual({});
 expect(s.run('Date','bad')).toEqual('has-error-new');expect(s.state.errorMessages).toEqual({'Date-students-1':'students: bad is not a valid date'});expect(s.run('Date','1.1.2010')).toEqual('');expect(s.state.errorMessages).toEqual({});
 expect(s.run('Password','', 'courses')).toEqual('');
});
it('teacher optional login, duplicate logins including comments, extrastudent class conflicts; message deduplication',()=>{
 const s=validation(),lists={teachers:[row(),{...row(),class:'#comment'}],students:[row()],extrastudents:[row(1)]};
 expect(s.run('Login','','teachers',0,lists)).toEqual('');expect(s.run('Login','fixture0','teachers',0,lists)).toEqual('has-error-new');expect(s.run('Login','fixture0','teachers',1,lists)).toEqual('has-error-new');expect(Object.values(s.state.errorMessages)).toEqual(['teachers: Duplicate teachers login']);
 expect(s.run('Login','5a','extrastudents',0,lists)).toEqual('has-error-new');expect(s.state.errorMessages['Login-extrastudents-1']).toEqual('extrastudents: Conflict between login and class');
});
it('loads students first, tabs lazily/cache teacher settings; raw custom data survive save and no dirty guard',async()=>{
 const guardLeave=vi.fn(()=>()=>{}),s=await render({guardLeave});expect(s.requests.map(r=>r.url).sort()).toEqual(['/api/lmn/activeschool','/api/lmn/users/lists/students']);expect(guardLeave.mock.calls).toEqual([]);
 await tab(s.w,'teachers');await flushPromises();await tab(s.w,'parents');await flushPromises();await tab(s.w,'teachers');await flushPromises();expect(s.requests.filter(r=>r.url==='/api/lmn/users/schoolconf').length).toEqual(1);
 await action(table(s.w,'teachers'),'save').trigger('click');await flushPromises();expect(s.requests.at(-1).data).toEqual([row()]);
});
it('table blur trims model, preserves inner spaces and sends only committed text',async()=>{
 const s=await render(),t=table(s.w),input=t.find('[placeholder="First name"]');await input.setValue(' First Last ');await action(t,'save').trigger('click');await flushPromises();expect(s.requests.at(-1).data[0].first_name).toEqual('User 0');await input.trigger('blur');await action(t,'save').trigger('click');await flushPromises();expect(s.requests.at(-1).data[0].first_name).toEqual('First Last');
});
it('dynamic hidden id column is editable, teacher existing login is disabled',async()=>{
 const s=await render(),t=table(s.w);expect(t.find('[placeholder="Student ID (optional)"]').exists()).toEqual(false);await t.find('[data-field=id]').setValue(true);expect(t.find('[placeholder="Student ID (optional)"]').exists()).toEqual(true);await tab(s.w,'teachers');await flushPromises();expect(table(s.w,'teachers').find('[placeholder=Login]').attributes('disabled')).toEqual('');
});
it('invalid rendered cells block every tab save, persist after filtering, new-row remove cleans empty cells',async()=>{
 const s=await render();s.open.mockResolvedValueOnce({...newListUser('students'),role:undefined});await action(table(s.w),'add').trigger('click');await flushPromises();await action(table(s.w),'check').trigger('click');await flushPromises();expect(s.requests.filter(r=>r.method==='post')).toEqual([]);expect(s.w.find('#error_messages').text()).toContain('empty cells');
 await table(s.w).find('input[type=search]').setValue('unmatched');await action(table(s.w),'save').trigger('click');await flushPromises();expect(s.requests.filter(r=>r.method==='post')).toEqual([]);
 await table(s.w).find('input[type=search]').setValue('');await table(s.w).findAll('[data-action=remove]').at(-1).trigger('click');await action(table(s.w),'save').trigger('click');await flushPromises();expect(s.requests.filter(r=>r.method==='post').length).toEqual(1);
});
it('save/check waits for success; HTTP rejection and cancellation never open Check',async()=>{
 const s=await render();await action(table(s.w),'check').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([[CheckDialog,{}, {backdrop:'static'}]]);
 s.aj.http.post=vi.fn().mockRejectedValue(new Error('save'));s.open.mockClear();await action(table(s.w),'check').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([]);
 s.open.mockRejectedValueOnce(new Error('cancel'));await action(table(s.w),'add').trigger('click');await flushPromises();expect(table(s.w).findAll('tbody tr').length).toEqual(1);
});
it('editor uses active school and empty encoding, reloads on close; backups never reload',async()=>{
 const s=await render();await action(table(s.w),'csv-menu').trigger('click');await action(table(s.w),'editor').trigger('click');await flushPromises();expect(s.open.mock.calls[0]).toEqual([FileEditorDialog,{path:'/etc/linuxmuster/sophomorix/school-x/school-x.students.csv',encoding:''}]);expect(s.reload.mock.calls.length).toEqual(1);
 await action(table(s.w),'backups').trigger('click');await flushPromises();expect(s.open.mock.calls[1]).toEqual([FileBackupsDialog,{path:'/etc/linuxmuster/sophomorix/school-x/school-x.students.csv',encoding:''}]);expect(s.reload.mock.calls.length).toEqual(1);
});
it('Ctrl hotkeys use the four-name map; staff Ctrl+B preserves undefined path name; listener removed on unmount',async()=>{
 const s=await render();document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',ctrlKey:true}));await flushPromises();expect(s.requests.at(-1).method).toEqual('post');await tab(s.w,'staff');await flushPromises();document.dispatchEvent(new KeyboardEvent('keydown',{key:'b',ctrlKey:true}));await flushPromises();expect(s.open.mock.calls.at(-1)[1].path).toEqual('/etc/linuxmuster/sophomorix/school-x/school-x.undefined.csv');s.w.unmount();s.open.mockClear();document.dispatchEvent(new KeyboardEvent('keydown',{key:'b',ctrlKey:true}));await flushPromises();expect(s.open.mock.calls).toEqual([]);
});
it('pending/rejected list loads retain original empty table (no spinner for initial empty string)',async()=>{
 const s=await render({http:vi.fn().mockRejectedValue(new Error('load'))});expect(table(s.w).find('table').exists()).toEqual(true);expect(table(s.w).find('[role=status]').exists()).toEqual(false);expect(table(s.w).findAll('tbody tr')).toEqual([]);
});
it.each(['students','parents','staff','teachers','extrastudents'])('add dialog %s trims text, saves without role and cancels without result',async kind=>{
 const close=vi.fn(),dismiss=vi.fn(),w=mount(AddUserDialog,{props:{kind,onClose:close,onCancel:dismiss},global:{provide:{aj:setup().aj}}});wrappers.push(w);const input=w.find('[name=first_name]');for(const c of ' First Last '){input.element.value+=c;await input.trigger('input');}await action(w,'add').trigger('click');expect(close.mock.calls[0][0]).toEqual((({role,...rest})=>({...rest,first_name:'First Last'}))(newListUser(kind)));await action(w,'cancel').trigger('click');expect(dismiss.mock.calls).toEqual([[]]);
});
it('pages by 50 before suppressing comment rows, shares size across tabs, preserves broken staff sort',async()=>{
 const source=Array.from({length:52},(_,i)=>({...row(i),last_name:String(52-i)}));source[0]={...source[0],class:'#comment'};
 const s=await render({http:async r=>({data:r.url==='/api/lmn/activeschool'?'default-school':source})}),t=table(s.w);
 expect(t.findAll('tbody tr').length).toEqual(49);await t.find('[data-page="2"]').trigger('click');expect(t.findAll('tbody tr').length).toEqual(2);
 await action(t,'rows-menu').trigger('click');await t.find('[data-size="10"]').trigger('click');expect(t.findAll('tbody tr').length).toEqual(10);
 await tab(s.w,'staff');await flushPromises();const st=table(s.w,'staff');expect(st.findAll('tbody tr').length).toEqual(9);await action(st,'sort-menu').trigger('click');await st.find('[data-sort=last_name]').trigger('click');expect(st.find('[placeholder="Last name"]').element.value).toEqual('51');
});
it('new teacher login updates immediately and preserves inner spaces typed one character at a time',async()=>{
 const s=await render();await tab(s.w,'teachers');await flushPromises();s.open.mockResolvedValueOnce({...newListUser('teachers'),last_name:'New',first_name:'Teacher',birthday:'1.1.2010',login:''});await action(table(s.w,'teachers'),'add').trigger('click');await flushPromises();
 const input=table(s.w,'teachers').findAll('[placeholder=Login]').at(-1);input.element.focus();for(const c of ' has space '){input.element.value+=c;await input.trigger('input');}
 expect(input.element.value).toEqual(' has space ');await action(table(s.w,'teachers'),'save').trigger('click');await flushPromises();expect(s.requests.filter(r=>r.method==='post')).toEqual([]);expect(s.w.find('#error_messages').text()).toContain('has space');
 await input.setValue('fresh-login');await action(table(s.w,'teachers'),'save').trigger('click');await flushPromises();expect(s.requests.at(-1).data[0].login).toEqual('fresh-login');
});
it('existing invalid login and date block check until corrected; error summary updates after correction',async()=>{
 const s=await render(),t=table(s.w);await t.find('[placeholder=Birthday]').setValue('bad');await t.find('[placeholder=Birthday]').trigger('blur');await action(t,'check').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([]);expect(s.w.find('#error_messages').text()).toContain('bad');
 await t.find('[placeholder=Birthday]').setValue('1.1.2010');await t.find('[placeholder=Birthday]').trigger('blur');await flushPromises();expect(s.w.find('#error_messages').exists()).toEqual(false);await action(t,'check').trigger('click');await flushPromises();expect(s.open.mock.calls[0][0]).toEqual(CheckDialog);
});
it('root/null identities do not load active school; later identity change refreshes path',async()=>{
 const s=await render({identity:{user:'root'}});expect(s.requests.map(r=>r.url)).toEqual(['/api/lmn/users/lists/students']);s.aj.identity.user=null;await flushPromises();expect(s.requests.length).toEqual(1);s.aj.identity.user='pgmadmin';await flushPromises();expect(s.requests.at(-1).url).toEqual('/api/lmn/activeschool');
});

it('uses original German catalog keys including encoded Save &amp; check',async()=>{
 const po=readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_users/locale/de/LC_MESSAGES/app.po','utf8');
 const catalog=Object.fromEntries([...po.matchAll(/^msgid (".*")\nmsgstr (".*")$/gm)].map(([,key,value])=>[JSON.parse(key),JSON.parse(value)]));
 const locale=createLocale({http:{get:async()=>({data:catalog})}});await locale.setLanguage('de');
 const s=await render({gettext:locale.gettext});expect(action(table(s.w),'check').text()).toEqual('Speichern & Prüfen');expect(s.w.findAll('[data-tab]').map(a=>a.text())).toEqual(['Schüler','Eltern','Lehrer','Extra-Schüler','Mitarbeitende']);
 const w=mount(AddUserDialog,{props:{kind:'extrastudents'},global:{provide:{aj:s.aj}}});wrappers.push(w);expect(w.text()).toContain('Schulklasse:');expect(w.text()).toContain('Gewünschter Login:');
});

it('real modalservice adds the new user and cancel leaves the table unchanged',async()=>{
 const s=setup();s.aj.modal=createModalService(()=>s.aj);const w=mount(ListManagement,{attachTo:document.body,global:{provide:{aj:s.aj}}});wrappers.push(w);await flushPromises();
 await action(table(w),'add').trigger('click');await flushPromises();const dialog=document.querySelector('.modal');dialog.querySelector('[name=first_name]').value='Added';dialog.querySelector('[name=first_name]').dispatchEvent(new Event('input',{bubbles:true}));dialog.querySelector('[data-action=add]').click();await flushPromises();expect(table(w).findAll('tbody tr').length).toEqual(2);expect(document.querySelector('.modal')).toEqual(null);
 await action(table(w),'add').trigger('click');await flushPromises();document.querySelector('.modal [data-action=cancel]').click();await flushPromises();expect(table(w).findAll('tbody tr').length).toEqual(2);expect(document.querySelector('.modal')).toEqual(null);
});
