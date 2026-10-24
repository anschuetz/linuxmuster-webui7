import { mount, flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { syntheticPassword, firstPassword } from '../../../e2e/fixtures/users_1.mjs';
import { createMockAj } from '../../adapter/mock.mjs';
import { createPasswords } from './passwords.mjs';
import { createCustomFields, mapCustomRole, groupDetails, quotaDetails, formatUserDate } from './customFields.mjs';
import ShowPassword from './ShowPassword.vue';
import CustomPassword from './CustomPassword.vue';
import UserDetails from './UserDetails.vue';
const sample = () => ({ cn:'p117-user', sAMAccountName:'p117-user', givenName:'Synthetic', sn:'User', sophomorixRole:'student', sophomorixBirthdate:'hidden', memberOf:['CN=class,OU=schoolclasses,DC=test'], parents:[], proxyAddresses:[], sophomorixCustom1:'old', sophomorixCustomMulti1:['old'], sophomorixStatus:{tag:'U',color:'success'} });
const config = { custom:{1:{show:true,title:'Single'}}, customMulti:{1:{show:true,title:'Multi'}}, proxyAddresses:{show:true,title:'Mail'} };
function setup(extra={}) {
    const requests=[], notify=vi.fn();
    const aj=createMockAj({identity:{user:'global-admin',profile:{isAdmin:true}}, notify, http:async r=>{requests.push(r); if(r.url.includes('/config/')) return {data:config}; if(r.url.includes('/sophomorixUsers/')) return {data:[sample()]}; if(r.url.includes('/quota/')) return {data:{home:{used:75,hard_limit:100}}}; return {data:true};}, ...extra});
    return {aj, requests, notify};
}
const render=(c,aj,props={})=>mount(c,{props,global:{provide:{aj},mocks:{$gettext:aj.gettext}}});
it('normalizes exam names only for reads and suppresses exam status request',async()=>{
    const requests=[];const {aj}=setup({http:async r=>{requests.push(r.url);return {data:firstPassword};}});
    const w=render(ShowPassword,aj,{username:'p117-user-exam'});await flushPromises();
    expect(requests).toEqual(['/api/lmn/users/passwords/p117-user']);expect(w.findAll('td')[1].text()).toEqual('p117-user-exam');
    expect(w.find('span').text()).toEqual('');w.unmount();
});
it('loads first password and status independently, preserves visible value on blur and closes',async()=>{
    const requests=[];const {aj}=setup({http:async r=>{requests.push(r.url);return {data:r.url.includes('first-password-set')?false:firstPassword};}});
    const w=render(ShowPassword,aj,{username:'p117-user'});await flushPromises();
    expect(requests).toEqual(['/api/lmn/users/passwords/p117-user','/api/lmn/users/p117-user/first-password-set']);
    expect(w.text().includes(firstPassword)).toBe(true);expect(w.find('span').text()).toEqual('Changed from user');await w.trigger('blur');expect(w.text().includes(firstPassword)).toBe(true);
    await w.find('.modal-footer a').trigger('click');expect(w.emitted('close')).toEqual([[]]);w.unmount();
});
it('reports password GET failure without claiming a loaded value',async()=>{
    const {aj,notify}=setup({http:async()=>{throw {data:{message:'denied'}};}});const w=render(ShowPassword,aj,{username:'p117-user-exam'});await flushPromises();
    expect(notify.mock.calls.length).toBe(1);expect(w.find('.password').exists()).toBe(false);w.unmount();
});
it.each(['first','current'])('preserves all typed custom %s password whitespace and exact users CSV',async type=>{
    const {aj,requests,notify}=setup();const w=render(CustomPassword,aj,{users:[sample(),{sAMAccountName:'p117-second'}],pwtype:type});
    const input=w.find('input');let typed='';for(const char of syntheticPassword){typed+=char;await input.setValue(typed);}await input.trigger('keyup.enter');await flushPromises();
    expect(requests.map(r=>[r.method,r.url,{users:r.data.users,validPassword:r.data.password===syntheticPassword}])).toEqual([['post','/api/lmn/users/passwords/set-'+type,{users:'p117-user,p117-second',validPassword:true}]]);
    expect(notify.mock.calls).toEqual([['success','New password set',undefined,{sticky:true}]]);expect(w.emitted('close')).toEqual([[]]);w.unmount();
});
it('rejects empty custom password, keeps dialog on API error, cancel never writes',async()=>{
    const http=vi.fn(async()=>{throw {data:{message:'policy'}};});const {aj,notify}=setup({http});const w=render(CustomPassword,aj,{users:sample(),pwtype:'invalid'});
    await w.findAll('.modal-footer a')[1].trigger('click');expect(http.mock.calls).toEqual([]);await w.find('input').setValue(syntheticPassword);await w.findAll('.modal-footer a')[1].trigger('click');await flushPromises();
    expect(w.emitted('close')).toBeUndefined();expect(notify.mock.calls.at(-1)).toEqual(['error','Password change failed: policy',undefined,{sticky:true}]);await w.findAll('.modal-footer a')[0].trigger('click');expect(w.emitted('close')).toEqual([[]]);w.unmount();
});
it('opens reusable dialogs with non-dismissible first-password options',async()=>{
    const open=vi.fn(async()=>{});const {aj}=setup({modal:{open}});const pw=createPasswords(aj);await pw.showFirstPassword('p117-user');await pw.setCustomPassword(sample(),'current');
    expect(open.mock.calls).toEqual([[ShowPassword,{username:'p117-user'},{backdrop:'static',keyboard:false}],[CustomPassword,{users:sample(),pwtype:'current'}]]);
});
it('batch reset/random/custom use only selected accounts and preserve command mapping',async()=>{
    const {aj,requests}=setup();const open=vi.spyOn(aj.modal,'open');const pw=createPasswords(aj);const list=[{...sample(),selected:true},{sAMAccountName:'skip'},{sAMAccountName:'p117-two',selected:true}];
    await pw.batchPasswords(list,'reset-first');await pw.batchPasswords(list,'random-first');await pw.batchPasswords(list,'custom-first');await pw.batchPasswords(list,'unknown');
    expect(requests.map(r=>[r.url,r.data])).toEqual([['/api/lmn/users/passwords/reset-first',{users:'p117-user,p117-two'}],['/api/lmn/users/passwords/set-random',{users:'p117-user,p117-two'}]]);expect(open.mock.calls[0][1]).toEqual({users:[list[0],list[2]],pwtype:'first'});
});
it('password reset/random failures stay sticky',async()=>{
    const {aj,notify}=setup({http:async()=>{throw {data:{message:'denied'}};}});const pw=createPasswords(aj);await pw.resetFirstPassword('p117-user');await pw.setRandomFirstPassword('p117-user');expect(notify.mock.calls).toEqual(Array(2).fill(['error','Password change failed: denied',undefined,{sticky:true}]));
});
it.each(['user-p117.pdf','error'])('batch print closes wait and downloads only successful PDF (%s)',async name=>{
    const {aj,requests}=setup({http:async r=>{requests.push(r);return {data:name};}});const close=vi.fn();aj.messagebox.show=()=>Object.assign(Promise.resolve(),{close});const download=vi.fn();await createPasswords(aj,{download}).printSelectedPasswords([{...sample(),selected:true}]);
    expect(requests.map(r=>[r.url,r.data])).toEqual([['/api/lmn/users/passwords/print',{users:'p117-user'}]]);expect(download.mock.calls).toEqual(name.startsWith('user-')?[['/api/lmn/users/passwords/download/'+name]]:[]);expect(close.mock.calls).toEqual([[]]);
});
it('print failure releases wait and notifies',async()=>{
    const {aj,notify}=setup({http:async()=>{throw Error('unavailable');}});const close=vi.fn();aj.messagebox.show=()=>Object.assign(Promise.resolve(),{close});await createPasswords(aj).printSelectedPasswords([]);expect(close.mock.calls).toEqual([[]]);expect(notify.mock.calls[0][0]).toBe('error');
});
it('maps custom roles, DN groups, dates and all quota branches like Angular',()=>{
    expect(['schooladmins','globaladmins','students'].map(mapCustomRole)).toEqual(['schooladministrators','globaladministrators','students']);expect(groupDetails(sample().memberOf)).toEqual([{cn:'class',category:'schoolclasses'}]);
    expect(formatUserDate('19700101000000.0Z',x=>x)).toBe('Never');expect(formatUserDate(undefined,x=>x)).toBe('undefined');expect(formatUserDate('20260102120304.0Z',x=>x)).toBe('02 Jan 2026 - 12:03:04');
    expect(quotaDetails({cloud:{},mail:{},bad:{ERROR:true},str:{used:2,hard_limit:'unknown'},free:{used:5,hard_limit:0},low:{used:59,hard_limit:100},mid:{used:60,hard_limit:100},high:{used:80,hard_limit:100}},x=>x)).toEqual([
        {share:'bad',total:'Error',used:'?',usage:0,type:'danger'},{share:'str',total:'unknown',used:2,usage:0,type:'success'},{share:'free',total:'NO LIMIT',used:5,usage:0,type:'success'},{share:'low',total:'100 MiB',used:59,usage:59,type:'success'},{share:'mid',total:'100 MiB',used:60,usage:60,type:'warning'},{share:'high',total:'100 MiB',used:80,usage:80,type:'danger'}]);
});
it('custom config/display/user values preserve role URL and title mapping',async()=>{
    const calls=[];const {aj}=setup({http:async r=>{calls.push(r);return {data:{...config,customDisplay:['','proxyAddresses','sophomorixCustom1','sophomorixCustomMulti1']}};}});const c=createCustomFields(aj);await c.loadConfig('schooladmins');await c.loadUserFields('p117-user');expect(await c.loadDisplay('teachers')).toEqual({customDisplay:['','proxyAddresses','sophomorixCustom1','sophomorixCustomMulti1'],customTitle:['','Mail','Single','Multi']});expect(calls.map(r=>r.url)).toEqual(['/api/lmn/config/customfields/schooladministrators','/api/lmn/users/p117-user/customfields','/api/lmn/config/customfields/teachers']);
});
it('custom single/multi/proxy operations retain exact payloads and empty-to-null string',async()=>{
    const {aj,requests}=setup({messagebox:{prompt:async()=>({value:''}),show:async()=>{}}});const c=createCustomFields(aj);expect(await c.editCustom('p117-user','old',1)).toBe('null');await c.addCustomMulti('p117-user',2);await c.removeCustomMulti('p117-user','old',2);await c.addProxyAddresses('p117-user');await c.removeProxyAddresses('p117-user','SMTP:old');
    expect(requests.map(r=>[r.method,r.url,r.data])).toEqual([['post','/api/lmn/users/p117-user/custom/1',{value:''}],['post','/api/lmn/users/p117-user/custommulti/2',{value:''}],['patch','/api/lmn/users/p117-user/custommulti/2',{value:'old'}],['post','/api/lmn/users/p117-user/proxyaddresses',{address:''}],['patch','/api/lmn/users/p117-user/proxyaddresses',{address:'SMTP:old'}]]);
});
it('custom cancellation and HTTP failure preserve Angular promise semantics',async()=>{
    const http=vi.fn(async()=>{throw Error('failed');});const {aj,notify}=setup({http,messagebox:{prompt:async()=>{throw Error('cancel');},show:async()=>{throw Error('cancel');}}});const c=createCustomFields(aj);await expect(c.editCustom('p117-user','old',1)).rejects.toThrow('cancel');await expect(c.removeCustomMulti('p117-user','old',1)).rejects.toThrow('cancel');expect(http.mock.calls).toEqual([]);aj.messagebox.prompt=async()=>({value:'new'});await expect(c.addCustomMulti('p117-user',1)).resolves.toBeUndefined();expect(notify.mock.calls.at(-1)[0]).toBe('error');
});
it('details load independently, hide birthday, toggle groups/quotas and cancel deletion',async()=>{
    const {aj,requests}=setup();aj.messagebox.show=vi.fn(async()=>{throw Error('cancel');});const w=render(UserDetails,aj,{id:'p117-user',role:'students'});await flushPromises();
    expect(requests.map(r=>r.url)).toEqual(['/api/lmn/sophomorixUsers/students/p117-user','/api/lmn/quota/user/p117-user','/api/lmn/config/customfields/students']);expect(w.text()).toContain('Synthetic User');expect(w.text()).not.toContain('Birthday:');expect(w.text()).toContain('75 MiB / 100 MiB - 75%');
    await w.find('[data-action=groups]').trigger('click');expect(w.find('[data-section=groups]').isVisible()).toBe(false);await w.find('[data-action=quotas]').trigger('click');expect(w.find('[data-section=quotas]').isVisible()).toBe(false);
    await w.find('[data-action=kill]').trigger('click');await flushPromises();expect(requests.filter(r=>r.method==='post')).toEqual([]);await w.find('.modal-footer a:last-child').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);w.unmount();
});
it('non-admin skips custom config and account removal; root loads config but cannot kill',async()=>{
    for(const [user,configCount] of [['teacher',0],['root',1]]){const {aj,requests}=setup({identity:{user,profile:{isAdmin:false}}});const w=render(UserDetails,aj,{id:'p117-user',role:'globaladmins'});await flushPromises();expect(requests.filter(r=>r.url.includes('/config/')).length).toBe(configCount);expect(w.find('[data-action=kill]').exists()).toBe(false);w.unmount();}
});
it('details errors keep loading data absent and notify',async()=>{
    const {aj,notify}=setup({http:async()=>{throw Error('offline');}});const w=render(UserDetails,aj,{id:'p117-user',role:'students'});await flushPromises();expect(w.find('[data-action=kill]').exists()).toBe(false);expect(notify.mock.calls.length).toBe(3);w.unmount();
});
it('parent search needs 3 trimmed chars, filters target roles, add/remove use immutable loaded data',async()=>{
 const {aj,requests}=setup();const original=sample();aj.http.get=async url=>({data:url.includes('/config/')?config:url.includes('/quota/')?{}:[original]});
 aj.http.post=async(url,data)=>{requests.push({method:'post',url,data});return {data:url.endsWith('ldap-search')?[{login:'p117-parent',label:'Parent',displayName:'Parent',role:'parent'},{login:'bad',role:'student'},{login:'bad2',role:'schooladministrator'},{login:'bad3',role:'schoolbinduser'}]:''};};
 const w=render(UserDetails,aj,{id:'p117-user',role:'students'});await flushPromises();await w.find('[data-action=parent-search]').trigger('click');await w.find('dialog input').setValue(' p ');await flushPromises();expect(requests).toEqual([]);await w.find('dialog input').setValue(' par ');await flushPromises();expect(w.findAll('dialog li').map(n=>n.text())).toEqual(['Parent']);await w.find('dialog input').trigger('keydown',{key:'ArrowDown'});await w.find('dialog input').trigger('keydown',{key:'ArrowUp'});await w.find('dialog input').trigger('keydown',{key:'Enter'});await flushPromises();expect(w.text()).toContain('Parent');expect(original.parents).toEqual([]);
 await w.find('[data-action=remove-parent]').trigger('click');await flushPromises();expect(requests.map(r=>[r.url,r.data])).toEqual([['/api/lmn/ldap-search',{role:'',login:'par'}],['/api/lmn/sophomorixUsers/add-parent',{student:'p117-user',parent:'p117-parent'}],['/api/lmn/sophomorixUsers/remove-parent',{student:'p117-user',parent:'p117-parent'}]]);w.unmount();
});
it('parent API error text leaves list intact and failed search reports',async()=>{
 const {aj,notify}=setup();aj.http.post=async(url)=>{if(url.endsWith('ldap-search'))return {data:[{login:'p117-parent',label:'Parent',role:'parent'}]};return {data:'denied'};};const w=render(UserDetails,aj,{id:'p117-user',role:'students'});await flushPromises();await w.find('[data-action=parent-search]').trigger('click');await w.find('dialog input').setValue('par');await flushPromises();await w.find('dialog li a').trigger('click');await flushPromises();expect(notify.mock.calls.some(c=>c[1]==='denied')).toBe(true);expect(w.find('[data-action=remove-parent]').exists()).toBe(false);w.unmount();
});
it('details custom field edits update visible values only after success',async()=>{
 const {aj}=setup();aj.messagebox.prompt=async()=>({value:'new'});const w=render(UserDetails,aj,{id:'p117-user',role:'students'});await flushPromises();await w.find('[data-action=edit-1]').trigger('click');await flushPromises();expect(w.text()).toContain('new');await w.find('[data-action=add-multi-1]').trigger('click');await flushPromises();await w.find('[data-action=remove-multi-1]').trigger('click');await flushPromises();await w.find('[data-action=add-proxy]').trigger('click');await flushPromises();await w.find('[data-action=remove-proxy]').trigger('click');await flushPromises();w.unmount();
});
it('kill confirms result and manual CSV cleanup before reloading; false result never reloads',async()=>{
 for(const deleted of [true,false]){const {aj,requests,notify}=setup();aj.http.post=async(url,data)=>{requests.push({url,data});return {data:deleted};};const reload=vi.fn();const w=render(UserDetails,aj,{id:'p117-user',role:'students',reloadPage:reload});await flushPromises();await w.find('[data-action=kill]').trigger('click');await flushPromises();expect(requests.filter(r=>r.url.endsWith('/killuser'))).toEqual([{url:'/api/lmn/sophomorixUsers/killuser',data:{user:'p117-user'}}]);expect(reload.mock.calls).toEqual(deleted?[[]]:[]);expect(notify.mock.calls.at(-1)[0]).toBe(deleted?'success':'error');w.unmount();}
});

it('shows true first-password status and ignores pending secret responses after unmount',async()=>{
 const {aj}=setup({http:async()=>({data:true})});const w=render(ShowPassword,aj,{username:'p117-user'});await flushPromises();expect(w.find('span').text()).toEqual('Still Set');expect(w.find('span').attributes('style')).toEqual('color: green;');w.unmount();
 let resolve;const notify=vi.fn();const pending=createMockAj({notify,http:()=>new Promise(done=>{resolve=done;})});const closed=render(ShowPassword,pending,{username:'p117-user-exam'});closed.unmount();resolve({data:firstPassword});await flushPromises();expect(notify.mock.calls).toEqual([]);
});
it('preserves old custom HTTP failure effects and leaves multi values on cancellation',async()=>{
 const original=sample();const {aj,notify}=setup();aj.http.get=async url=>({data:url.includes('/config/')?config:url.includes('/quota/')?{}:[original]});aj.http.post=async()=>{throw Error('failed');};aj.messagebox.prompt=async()=>({value:'new'});aj.messagebox.show=async()=>{throw Error('cancel');};const w=render(UserDetails,aj,{id:'p117-user',role:'students'});await flushPromises();await w.find('[data-action=edit-1]').trigger('click');await flushPromises();expect(w.find('[data-action=edit-1]').element.closest('tr').textContent).toEqual('Single');await w.find('[data-action=remove-multi-1]').trigger('click');await flushPromises();expect(w.find('[data-action=remove-multi-1]').exists()).toEqual(true);expect(original.sophomorixCustomMulti1).toEqual(['old']);expect(notify.mock.calls.map(c=>c[0])).toEqual(['error']);w.unmount();
});
