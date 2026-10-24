import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { createValidation } from '../../common/validation.mjs';
import { createExtras, extraRows, fieldError, extraFields } from './extras.mjs';
import ExtraStudents from './ExtraStudents.vue';
import ExtraCourses from './ExtraCourses.vue';
import FileEditorDialog from '../../common/FileEditorDialog.vue';
import FileBackupsDialog from '../../common/FileBackupsDialog.vue';
import CheckDialog from '../../common/users/CheckDialog.vue';
const student=(i=0)=>({class:'5a',last_name:'Synthetic',first_name:'Extra '+i,birthday:'1.1.2010',login:'extra'+i});
const course=()=>({course:'Extra',base_name:'extra',count:'2',birthday:'1.1.2010',gecos:'Synthetic',password:'',removal_date:'1.1.2030'});
const wrappers=[];
afterEach(()=>{wrappers.splice(0).forEach(w=>w.unmount());document.body.innerHTML='';});
function setup(kind='students',options={}) {
    const requests=[],notify=vi.fn(),reload=vi.fn(),open=vi.fn().mockResolvedValue();
    const aj=createMockAj({notify,reload,modal:{open},http:async r=>{requests.push(r);return {data:r.url==='/api/lmn/schoolsettings'?{encoding_students_extra:'utf8',encoding_courses_extra:'win1252'}:kind==='students'?[student()]:[course()]};},...options});
    return {aj,requests,notify,reload,open};
}
async function render(kind='students',options={}) {
    const s=setup(kind,options),w=mount(kind==='students'?ExtraStudents:ExtraCourses,{attachTo:document.body,global:{provide:{aj:s.aj}}});wrappers.push(w);await flushPromises();return {...s,w};
}
const action=(w,name)=>w.find(`[data-action="${name}"]`);
it.each([['students','extrastudents','utf-8'],['courses','extraclasses','cp1252']])('loads %s encoding before exact CSV route, retains metadata in save',async(kind,list,encoding)=>{
    const s=setup(kind),api=createExtras(s.aj,kind),data=await api.load();
    expect(data.encoding).toEqual(encoding);expect(s.requests.map(r=>r.url)).toEqual(['/api/lmn/schoolsettings',`/api/lmn/users/lists/${list}?encoding=${encoding}`]);
    const rows=[{...student(),_isNew:true}];await api.save(rows,encoding);expect(s.requests.at(-1)).toEqual({method:'post',url:`/api/lmn/users/lists/${list}?encoding=${encoding}`,data:rows,cfg:undefined});expect(s.notify.mock.calls).toEqual([['success','Saved',undefined]]);
});
it.each([['','utf-8'],['ascii','ascii'],['8859-1','ISO8859-1'],['8859-15','ISO8859-15'],['UTF8','ISO8859-1'],[undefined,'ISO8859-1']])('legacy encoding map/fallback for %s',async(setting,encoding)=>{
    const s=setup('students',{http:async r=>({data:r.url==='/api/lmn/schoolsettings'?{encoding_students_extra:setting}:[]})});expect((await createExtras(s.aj,'students').load()).encoding).toEqual(encoding);
});
it('retains validation error-string truthiness, empty errors, optional passwords and duplicates',()=>{
    const v=createValidation({gettext:x=>x}),rows=[student(),{...student(),class:'#comment'}];
    expect(fieldError(v,'Date','bad',false,false,rows)).toEqual('');expect(fieldError(v,'AlphaNum','has-hyphen',false,false,rows,'students')).toEqual('');
    expect(fieldError(v,'AlphaNum','extra0',false,false,rows,'students')).toEqual('has-error');expect(fieldError(v,'Date','',true,false,rows)).toEqual('has-error-new');expect(fieldError(v,'Date','',true,true,rows)).toEqual('has-error');
    expect(fieldError(v,'Password','',true,false,rows)).toEqual('');expect(fieldError(v,'Password','weak',false,false,rows)).toEqual('');expect(fieldError(v,'TODO',undefined,true,false,rows)).toEqual('');
});
it('broad Angular filter, stable typed/case-insensitive ordering; no page slicing',()=>{
    const rows=[{...student(0),class:'z',_isNew:true},{...student(1),class:'A'},{...student(2),class:'a'},{...student(3),class:'#comment'}],copy=structuredClone(rows);
    expect(extraRows(rows,'students','','class').map(r=>r.login)).toEqual(['extra3','extra1','extra2','extra0']);expect(extraRows(rows,'courses','!extra 1','first_name').map(r=>r.login)).toEqual(['extra0','extra2','extra3']);expect(extraRows(rows,'students','TRUE','class').map(r=>r.login)).toEqual(['extra0']);expect(rows).toEqual(copy);
});
it.each(['students','courses'])('%s load failure retains spinner without toolbar',async kind=>{
    const s=await render(kind,{http:vi.fn().mockRejectedValue(new Error('load'))});expect(s.w.find('[role=status]').exists()).toEqual(true);expect(s.w.find('table').exists()).toEqual(false);
});
it('students shows all 101 rows on either 100-row page; add/remove keeps raw page calculation',async()=>{
    const s=await render('students',{http:async r=>({data:r.url==='/api/lmn/schoolsettings'?{}:Array.from({length:101},(_,i)=>student(i))})});expect(s.w.findAll('tbody tr').length).toEqual(101);
    await s.w.find('[data-page="2"]').trigger('click');expect(s.w.findAll('tbody tr').length).toEqual(101);await action(s.w,'add').trigger('click');expect(s.w.findAll('tbody tr').length).toEqual(102);expect(s.w.find('.pagination .active').text()).toEqual('2');await s.w.findAll('[data-action=remove]').at(-1).trigger('click');expect(s.w.findAll('tbody tr').length).toEqual(101);
});
it('courses has no paginator; blur updates text and trims outer whitespace',async()=>{
    const s=await render('courses');expect(s.w.find('.pagination').exists()).toEqual(false);expect(s.w.find('[placeholder=Password]').attributes('type')).toEqual('password');const input=s.w.find('[placeholder=GECOS]');
    await input.setValue('  First Last  ');await action(s.w,'save').trigger('click');await flushPromises();expect(s.requests.at(-1).data[0].gecos).toEqual('Synthetic');await input.trigger('blur');await action(s.w,'save').trigger('click');await flushPromises();expect(s.requests.at(-1).data[0].gecos).toEqual('First Last');
});
it('preserves outer spaces in a course password typed character by character',async()=>{
    const s=await render('courses'),input=s.w.find('[placeholder=Password]'),typedValue='  Synthetic42!  ';
    for(const char of typedValue){input.element.value+=char;await input.trigger('input');}
    await input.trigger('blur');await action(s.w,'save').trigger('click');await flushPromises();
    expect(s.requests.at(-1).data[0].password).toEqual(typedValue);
});
it('duplicate login blocks save/check; filtering removes errors from validation DOM',async()=>{
    const writes=[],s=await render('students',{http:async r=>{if(r.method==='post')writes.push(r.data);return {data:r.url==='/api/lmn/schoolsettings'?{}:[student(),{...student(),first_name:'Other'}]};}});
    await action(s.w,'check').trigger('click');await flushPromises();expect(writes).toEqual([]);expect(s.open.mock.calls).toEqual([]);expect(s.w.findAll('.has-error').length).toEqual(2);
    await s.w.find('input[type=search]').setValue('unmatched');await action(s.w,'save').trigger('click');await flushPromises();expect(writes.length).toEqual(1);expect(writes[0].length).toEqual(2);
});
it.each(['students','courses'])('%s blank added row blocks check; invalid nonempty strings retain legacy acceptance',async kind=>{
    const s=await render(kind);await action(s.w,'add').trigger('click');expect(s.w.find('.has-error-new').exists()).toEqual(true);await action(s.w,'check').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([]);expect(s.notify.mock.calls).toEqual([['error','Required data missing',undefined]]);expect(s.w.find('.has-error').exists()).toEqual(true);
    const row=s.w.findAll('tbody tr').at(-1);for(const field of extraFields(kind).filter(f=>f.validation && !['TODO','Password'].includes(f.validation))){const input=row.find(`[placeholder="${field.label}"]`);await input.setValue(field.key==='login'?'other-invalid':'bad');await input.trigger('blur');}
    await action(s.w,'check').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([[CheckDialog,{}, {backdrop:'static'}]]);
});
it('save HTTP rejection does not notify success or open Check',async()=>{
    const s=await render('students',{http:async r=>{if(r.method==='post')throw Error('save');return {data:r.url==='/api/lmn/schoolsettings'?{}:[student()]};}});await action(s.w,'check').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([]);expect(s.notify.mock.calls).toEqual([]);
});
it.each([['students','extrastudents','utf-8'],['courses','extraclasses','cp1252']])('%s editor/backup fixed paths and reload only after resolved editor',async(kind,list,encoding)=>{
    const s=await render(kind),path=`/etc/linuxmuster/sophomorix/default-school/${list}.csv`;s.open.mockRejectedValueOnce('cancel');await action(s.w,'editor').trigger('click');await flushPromises();expect(s.reload.mock.calls).toEqual([]);await action(s.w,'editor').trigger('click');await flushPromises();expect(s.reload.mock.calls).toEqual([[]]);await action(s.w,'backups').trigger('click');await flushPromises();expect(s.open.mock.calls).toEqual([[FileEditorDialog,{path,encoding}],[FileEditorDialog,{path,encoding}],[FileBackupsDialog,{path,encoding}]]);expect(s.reload.mock.calls).toEqual([[]]);
});
it('course ordering keeps identical source rows distinct and ignores new-row metadata',()=>{
    const rows=[{...course(),_isNew:true},{...course(),_isNew:false}, {...course(),course:'Alpha'}];
    const sorted=extraRows(rows,'courses','','course');
    expect(sorted.map(row=>rows.indexOf(row))).toEqual([2,0,1]);
});
it('sort menu changes row order; blur preserves typed inner spaces',async()=>{
    const writes=[],s=await render('students',{http:async r=>{if(r.method==='post')writes.push(r.data);return {data:r.url==='/api/lmn/schoolsettings'?{}:[{...student(0),login:'z'},{...student(1),login:'a'}]};}});
    await action(s.w,'sort-menu').trigger('click');await s.w.find('[data-sort=login]').trigger('click');
    expect(s.w.findAll('[placeholder=Login]').map(input=>input.element.value)).toEqual(['a','z']);
    const input=s.w.find('[placeholder="First name"]');
    for(const value of ['F','Fi','Fir','Firs','First','First ','First L','First La','First Las','First Last']){input.element.value=value;await input.trigger('input');}
    await input.trigger('blur');await action(s.w,'save').trigger('click');await flushPromises();
    expect(writes[0][1].first_name).toEqual('First Last');
});
