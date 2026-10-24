import { mount, flushPromises } from '@vue/test-utils';
import { describe, it, expect, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { users, config } from '../../../e2e/fixtures/users_2.mjs';
import { matchesUser, selectUsers, sortedUsers, pageUsers, createUsers } from './users.mjs';
import UsersTable from './UsersTable.vue';
import Students from './Students.vue';
import Teachers from './Teachers.vue';
import Staff from './Staff.vue';
import Parents from './Parents.vue';
import UserDetails from '../../common/users/UserDetails.vue';
import ShowPassword from '../../common/users/ShowPassword.vue';
import CustomPassword from '../../common/users/CustomPassword.vue';
import { mount as mountEntry } from './entry.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function setup(options={}) {
    const requests=[],notify=vi.fn(),reload=vi.fn(),pageTitle={set:vi.fn()},open=vi.fn(async()=>{});
    const aj=createMockAj({notify,reload,pageTitle,modal:{open},http:async r=>{
        requests.push(r);
        if(r.url.includes('/config/'))return {data:config()};
        if(r.url.includes('/usermap/'))return {data:{[r.url.split('/').at(-1)]:{USED:75,TYPE:'warning'}}};
        if(r.url.includes('/sophomorixUsers/'))return {data:users(r.url.split('/').at(-1))};
        return {data:true};
    },...options});
    return {aj,requests,notify,reload,pageTitle,open};
}
const render=(role='students',options={})=>{const s=setup(options);return {...s,w:mount(UsersTable,{attachTo:document.body,props:{role},global:{provide:{aj:s.aj}}})};};
const section=w=>w.findAll('[data-section]').find(s=>s.isVisible());
const rows=w=>section(w).findAll('tbody tr').filter(r=>r.isVisible());
const action=(w,name)=>section(w).find(`[data-action="${name}"]`);
const search=w=>section(w).find('input[type=search]');
const select=w=>section(w).find('thead input[type=checkbox]');
it('preserves broad student negation/nested fields versus restricted teacher/staff/parent search',()=>{
    const u={...users()[0],$private:'private',nullable:null};
    expect(['students','teachers','staff','parents'].map(r=>matchesUser(u,'custom-only',r))).toEqual([true,false,false,false]);
    expect(['students','teachers','staff','parents'].map(r=>matchesUser(u,'p118-class',r))).toEqual([true,false,true,true]);
    expect(['!multi-a','!!multi-a','private','hidden','!missing'].map(q=>matchesUser(u,q,'students'))).toEqual([false,true,false,true,true]);
    expect(matchesUser({givenName:undefined},'none','staff')).toBe(false);
});
it('selection uses fixed fields even for students and includes teachers class; never mutates input',()=>{
    const list=users().slice(0,2);const selected=selectUsers(list,'p118-class',true);
    expect(selected.map(x=>x.selected)).toEqual([true,true]);expect(list.map(x=>x.selected)).toEqual([undefined,undefined]);
    expect(selectUsers(selected,'custom-only',false)).toEqual(selected);
    expect(selectUsers(selected,'P118-0',false).map(x=>x.selected)).toEqual([false,true]);
    expect(selectUsers(list,undefined,true).map(x=>x.selected)).toEqual([true,true]);
});
it('preserves descending _isNew including undefined and stable case-insensitive ties before raw page slicing',()=>{
    const a={...users()[0],givenName:'equal'},b={...users()[1],givenName:'Equal'},n={...users()[2],_isNew:true,givenName:'Z'};
    const original=[a,b,n];expect(sortedUsers(original,'givenName')).toEqual([a,b,n]);expect(original).toEqual([a,b,n]);
    expect(sortedUsers([{sophomorixStatus:{tag:'Z'}},{sophomorixStatus:{tag:'a'}}],'sophomorixStatus.tag')).toEqual([{sophomorixStatus:{tag:'a'}},{sophomorixStatus:{tag:'Z'}}]);
    expect(pageUsers(users(),'students','', 'sophomorixAdminClass',2,50).map(x=>x.sAMAccountName)).toEqual(['p118-49','p118-50','p118-51','p118-52']);
    expect(pageUsers(users(),'students','p118-0','givenName',2,50)).toEqual([]);
});
it.each([['students',Students,'Students'],['teachers',Teachers,'Teachers'],['staff',Staff,'Staff'],['parents',Parents,'Parents']])('%s wrapper loads independent display/list requests and title',async(role,Component,title)=>{
    const s=setup();const w=mount(Component,{attachTo:document.body,global:{provide:{aj:s.aj}}});await flushPromises();
    expect(s.requests.map(r=>r.url).toSorted()).toEqual([`/api/lmn/config/customfields/${role}`,`/api/lmn/sophomorixUsers/${role}`].toSorted());
    expect(s.pageTitle.set.mock.calls).toEqual([[title]]);expect(rows(w).length).toBe(50);expect(w.text().includes('hidden')).toBe(false);w.unmount();
});
it('keeps loading instead of empty state before/rejected list or failed custom configuration',async()=>{
    const pending=deferred();const {w}=render('staff',{http:r=>r.url.includes('/config/')?Promise.reject(Error('config')):pending.promise});
    expect(w.find('[role=status]').exists()).toBe(true);expect(w.find('.alert-info').exists()).toBe(false);
    pending.reject(Error('denied'));await flushPromises();expect(w.find('[role=status]').exists()).toBe(true);expect(w.find('.alert-info').exists()).toBe(false);w.unmount();
});
it.each(['students','teachers','staff','parents'])('%s keeps sentinel and empty-array distinction',async role=>{
    const s=setup();let list=['none'];s.aj.http.get=async url=>({data:url.includes('/config/')?config():list});
    const w=mount(UsersTable,{attachTo:document.body,props:{role},global:{provide:{aj:s.aj}}});await flushPromises();
    expect(w.find('.alert-info').exists()).toBe(role!=='students');expect(rows(w).length).toBe(role==='students'?1:0);w.unmount();
    list=[];const empty=mount(UsersTable,{attachTo:document.body,props:{role},global:{provide:{aj:s.aj}}});await flushPromises();expect(empty.find('.alert-info').exists()).toBe(role==='students');empty.unmount();
});
it('student tabs share raw pagination and sort but retain queries/selections per list',async()=>{
    const {w,requests}=render();await flushPromises();expect(rows(w).map(r=>r.find('i').text())).toEqual(users().slice(0,50).map(u=>u.sAMAccountName));
    let typed='';for(const char of '  Synthetic 02  '){typed+=char;await search(w).setValue(typed);}await search(w).trigger('change');expect(rows(w).length).toBe(1);
    await search(w).setValue('custom-only');await search(w).trigger('change');await select(w).setValue(true);expect(action(w,'batch-menu').exists()).toBe(false);
    await search(w).setValue('p118-5');await search(w).trigger('change');await select(w).setValue(false);await select(w).setValue(true);
    await action(w,'batch-menu').trigger('click');await action(w,'batch-reset').trigger('click');await flushPromises();
    expect(requests.filter(r=>r.method==='post').map(r=>[r.url,r.data])).toEqual([['/api/lmn/users/passwords/reset-first',{users:'p118-5,p118-50,p118-51,p118-52'}]]);
    await search(w).setValue('');await search(w).trigger('change');await section(w).find('[data-page="2"]').trigger('click');expect(rows(w).length).toBe(3);
    await w.find('[data-tab=attic]').trigger('click');expect(rows(w).length).toBe(0);
    await w.find('[data-tab=students]').trigger('click');await section(w).find('[data-page="1"]').trigger('click');await w.find('[data-tab=attic]').trigger('click');expect(rows(w).length).toBe(1);expect(rows(w)[0].text().includes('old-class')).toBe(true);
    await select(w).setValue(true);await action(w,'batch-menu').trigger('click');await action(w,'batch-random').trigger('click');await flushPromises();expect(requests.at(-1).data).toEqual({users:'p118-53'});w.unmount();
});
it('selects hidden/commented rows after filtering and pages raw totals; retains selection outside query',async()=>{
    const list=users('teachers').map((u,i)=>i===0?{...u,class:['#']}:u);
    const requests=[];const {w}=render('teachers',{http:async r=>{requests.push(r);return {data:r.url.includes('/config/')?config():r.method==='post'?{}:list};}});await flushPromises();expect(rows(w).length).toBe(49);
    await search(w).setValue('p118-class');await search(w).trigger('change');expect(rows(w).length).toBe(0);await select(w).setValue(true);
    await action(w,'batch-menu').trigger('click');await action(w,'batch-reset').trigger('click');await flushPromises();expect(requests.at(-1).data).toEqual({users:list.map(u=>u.sAMAccountName).join(',')});
    await search(w).setValue('p118-1');await search(w).trigger('change');await select(w).setValue(false);await action(w,'batch-menu').trigger('click');await action(w,'batch-custom').trigger('click');await flushPromises();w.unmount();
});
it('renders custom columns in different teacher positions and hides string null, uses list badges',async()=>{
    const {w}=render('teachers');await flushPromises();const cells=rows(w)[0].findAll('td');
    expect(cells[1].text()).toBe('p118-0smtp:p118@test.invalid');expect(cells[2].text()).toBe('User Equalcustom-only');expect(cells[3].findAll('.label').map(x=>x.text())).toEqual(['multi-a','multi-b']);w.unmount();
});
it('uses all sort options, presets and other numeric sizes without resetting search page',async()=>{
    const {w}=render('teachers');await flushPromises();await action(w,'sort-menu').trigger('click');await section(w).find('[data-sort="sAMAccountName"]').trigger('click');
    expect(rows(w).slice(0,3).map(r=>r.find('i').text())).toEqual(['p118-0','p118-1','p118-10']);
    await action(w,'rows-menu').trigger('click');await section(w).find('[data-size="10"]').trigger('click');expect(rows(w).length).toBe(10);
    await section(w).find('input[type=number]').setValue('2');await section(w).find('input[type=number]').trigger('change');expect(rows(w).length).toBe(2);
    await section(w).find('input[type=number]').setValue('');await section(w).find('input[type=number]').trigger('change');expect(rows(w).length).toBe(0);w.unmount();
});
it('reuses password dialogs, blurs only first-password wait, single/custom batch preserve targets',async()=>{
    const pending=deferred(),s=render('staff');await flushPromises();s.aj.modal.open=vi.fn(()=>pending.promise);
    await action(s.w,'password-p118-0').trigger('click');await action(s.w,'show-p118-0').trigger('click');expect(section(s.w).find('table').classes()).toContain('lmn-blurred');expect(s.aj.modal.open.mock.calls).toEqual([[ShowPassword,{username:'p118-0'},{backdrop:'static',keyboard:false}]]);
    pending.resolve();await flushPromises();expect(section(s.w).find('table').classes()).not.toContain('lmn-blurred');
    s.aj.modal.open=vi.fn(async()=>{});await action(s.w,'password-p118-0').trigger('click');await action(s.w,'custom-current-p118-0').trigger('click');expect(s.aj.modal.open.mock.calls[0]).toEqual([CustomPassword,{users:users('staff')[0],pwtype:'current'}]);
    await select(s.w).setValue(true);await action(s.w,'batch-menu').trigger('click');await action(s.w,'batch-custom').trigger('click');expect(s.aj.modal.open.mock.calls[1][1]).toEqual({users:users('staff').map(u=>({...u,selected:true})),pwtype:'first'});s.w.unmount();
});
it.each(['students','teachers','staff','parents'])('%s details close/dismiss refreshes only teachers',async role=>{
    const pending=deferred();const {w,open,reload}=render(role,{modal:{open:vi.fn(()=>pending.promise)}});await flushPromises();await action(w,'details').trigger('click');
    pending.reject(Error('cancel'));await flushPromises();expect(reload.mock.calls).toEqual(role==='teachers'?[[]]:[]);w.unmount();
});
it('does not refresh a destroyed teacher view after a modal settles',async()=>{
    const pending=deferred();const {w,reload}=render('teachers',{modal:{open:()=>pending.promise}});await flushPromises();await action(w,'details').trigger('click');w.unmount();pending.resolve();await flushPromises();expect(reload.mock.calls).toEqual([]);
});
it('teacher quotas request every account in parallel and publish only a complete response',async()=>{
    const gates=users('teachers').map(()=>deferred());const requests=[];const {w}=render('teachers',{http:r=>{
        requests.push(r);if(r.url.includes('/usermap/'))return gates[Number(r.url.split('-').at(-1))].promise;
        return Promise.resolve({data:r.url.includes('/config/')?config():users('teachers')});
    }});await flushPromises();await action(w,'quotas').trigger('click');expect(requests.filter(r=>r.url.includes('/usermap/')).length).toBe(54);
    gates[0].resolve({data:{'p118-0':{USED:75,TYPE:'warning'}}});await flushPromises();expect(w.text().includes('75 %')).toBe(false);
    gates.slice(1).forEach((g,i)=>g.resolve({data:{['p118-'+(i+1)]:{USED:20,TYPE:'success'}}}));await flushPromises();expect(rows(w)[0].text().includes('75 %')).toBe(true);expect(rows(w)[0].find('.progress-bar').attributes('style')).toContain('75%');w.unmount();
});
it('quota failure keeps old placeholder and late responses after unmount have no effects',async()=>{
    const pending=deferred();const {w}=render('teachers',{http:async r=>{if(r.url.includes('/usermap/'))return pending.promise;return {data:r.url.includes('/config/')?config():users('teachers')};}});await flushPromises();await action(w,'quotas').trigger('click');pending.reject(Error('denied'));await flushPromises();expect(w.find('.progress-bar').exists()).toBe(false);w.unmount();
    const late=deferred(),s=render('teachers',{http:()=>late.promise});s.w.unmount();late.resolve({data:users()});await flushPromises();expect(s.notify.mock.calls).toEqual([]);
});
it('parent deletion preserves confirmations, true/false result, CSV reminder and no reload',async()=>{
    const {aj,requests,notify,reload}=setup({http:async r=>{requests.push(r);return {data:true};}});const show=vi.spyOn(aj.messagebox,'show');await createUsers(aj).killParent('p118-0');
    expect(requests.map(r=>[r.url,r.data])).toEqual([['/api/lmn/sophomorixUsers/killuser',{user:'p118-0'}]]);expect(show.mock.calls.map(x=>x[0].title)).toEqual(['Kill user p118-0','Clean up parents.csv']);expect(notify.mock.calls).toEqual([['success','User p118-0 successfully deleted!',undefined]]);expect(reload.mock.calls).toEqual([]);
    aj.http.post=async()=>({data:false});await createUsers(aj).killParent('p118-0');expect(notify.mock.calls.at(-1)).toEqual(['error',"There was an error during the process. Please try manually to execute the command 'sophomorix-kill --kill p118-0' to get more informations.",undefined]);
});
it('parent cancellation and HTTP rejection never create a success/reminder',async()=>{
    const {aj,requests,notify}=setup({messagebox:{show:()=>Promise.reject(Error('cancel'))}});await createUsers(aj).killParent('p118-0');expect(requests).toEqual([]);
    const show=vi.fn(async()=>{});aj.messagebox.show=show;aj.http.post=async()=>{throw Error('denied');};await createUsers(aj).killParent('p118-0');expect(show.mock.calls.length).toBe(1);expect(notify.mock.calls).toEqual([]);
});
it('mount entry chooses each fixture view and unmounts its app',async()=>{
    for(const view of ['students','teachers','staff','parents']) {const {aj}=setup();const host=document.createElement('div');const unmount=mountEntry(host,aj,{view});await flushPromises();expect(host.querySelector('table')).not.toBeNull();unmount();expect(host.innerHTML).toBe('');}
});

it('batch print uses source selection and reports shared print failure; row resets/random reuse password service',async()=>{
    const {w,requests,notify}=render('parents');await flushPromises();await select(w).setValue(true);
    await action(w,'batch-menu').trigger('click');await action(w,'batch-print').trigger('click');await flushPromises();
    expect(requests.at(-1).url).toEqual('/api/lmn/users/passwords/print');expect(requests.at(-1).data).toEqual({users:users('parents').map(u=>u.sAMAccountName).join(',')});expect(notify.mock.calls.at(-1)[0]).toEqual('error');
    await action(w,'password-p118-0').trigger('click');await action(w,'reset-p118-0').trigger('click');await flushPromises();
    await action(w,'password-p118-0').trigger('click');await action(w,'random-p118-0').trigger('click');await flushPromises();expect(requests.slice(-2).map(r=>[r.url,r.data])).toEqual([['/api/lmn/users/passwords/reset-first',{users:'p118-0'}],['/api/lmn/users/passwords/set-random',{users:'p118-0'}]]);w.unmount();
});
