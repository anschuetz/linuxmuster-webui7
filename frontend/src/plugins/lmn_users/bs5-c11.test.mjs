import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import ListManagement from './ListManagement.vue';
import ListTable from './ListTable.vue';
import AddUserDialog from './AddUserDialog.vue';
import AddAdminDialog from './AddAdminDialog.vue';
import PrintOptionsDialog from './PrintOptionsDialog.vue';
import SortListDialog from './SortListDialog.vue';
import UploadDialog from './UploadDialog.vue';
import ShowBindPasswordDialog from './ShowBindPasswordDialog.vue';
import { rows } from '../../../e2e/fixtures/users_7.mjs';
const wrappers=[];
afterEach(()=>wrappers.splice(0).forEach(w=>w.unmount()));
async function render(component,props={},data=rows()) {
 const requests=[],open=vi.fn().mockRejectedValue('cancel');
 const aj=createMockAj({identity:{user:'global-admin'},modal:{open},http:async r=>{requests.push(r);return {data:r.url.includes('activeschool')?'school-x':r.url.includes('templates')?[]:data};}});
 const w=mount(component,{props,global:{provide:{aj}}});wrappers.push(w);await flushPromises();return {w,requests,open,aj};
}
it('moves active list tabs onto nav-link and preserves lazy loading',async()=>{
 const {w,requests}=await render(ListManagement);
 expect(w.get('.nav-item .nav-link.active').attributes('data-tab')).toBe('students');
 await w.get('[data-tab=parents]').trigger('click');await flushPromises();
 expect(w.get('.nav-link.active').attributes('data-tab')).toBe('parents');
 expect(w.find('.nav-item.active').exists()).toBe(false);
 expect(requests.filter(r=>r.url.endsWith('/parents'))).toHaveLength(1);
});
it('uses Vue show dropdowns and BS5 paging without changing removal payload',async()=>{
 const {w}=await render(ListTable,{kind:'students',rows:rows(),size:1,validate:()=>''});
 expect(w.find('.btn-default,.input-group-btn,.pull-right,.open').exists()).toBe(false);
 for(const action of ['sort','fields','rows','csv']) {
  await w.get(`[data-action=${action}-menu]`).trigger('click');expect(w.find('.dropdown-menu.show').exists()).toBe(true);
  await w.get(`[data-action=${action}-menu]`).trigger('click');expect(w.find('.dropdown-menu.show').exists()).toBe(false);
 }
 expect(w.get('.page-item.active .page-link').text()).toBe('1');
 await w.get('[data-page="2"]').trigger('click');await w.get('[data-action=remove]').trigger('click');
 expect(w.emitted('remove')[0]).toEqual([rows()[1],0,2,1]);
});
it('keeps new errors latent until save and blocks check on invalid inputs',async()=>{
 const {w,requests}=await render(ListManagement,{},[{class:'',last_name:'Fixture',first_name:'Synthetic',birthday:'',login:''}]);
 expect(w.find('.c11-new').exists()).toBe(true);expect(w.find('input.is-invalid').exists()).toBe(false);
 await w.get('[data-list=students] [data-action=check]').trigger('click');await flushPromises();
 expect(w.find('input.is-invalid').exists()).toBe(true);
 expect(w.find('.has-error,.has-error-new,.form-group').exists()).toBe(false);
 expect(requests.every(r=>r.method==='get')).toBe(true);
 const input=w.get('[data-list=students] input[placeholder=Class]');await input.setValue('5a');await input.trigger('blur');await flushPromises();
 expect(w.get('[data-list=students] input[placeholder=Class]').classes()).not.toContain('is-invalid');
});
it.each([[AddUserDialog,{kind:'students'}],[AddAdminDialog,{role:'schooladmin'}],[PrintOptionsDialog,{schoolclass:['5a'],user:'fixture',adminClass:'5a'}],[SortListDialog,{userlist:'students.csv',columns:[]}],[UploadDialog,{role:'students'}],[ShowBindPasswordDialog,{user:{sAMAccountName:'fixture'}}]])('migrates dialog controls and preserves dismissal',async(component,props)=>{
 const {w}=await render(component,props);
 expect(w.find('.btn-default,.form-group').exists()).toBe(false);expect(w.find('.btn-light.c11-button').exists()).toBe(true);
 const cancel=w.find('[data-action=cancel],[data-action=close]');
 if(cancel.exists()){await cancel.trigger('click');expect(w.emitted('cancel')||w.emitted('close')).toBeTruthy();}
});
it('checks focus, form spacing and warning bar against built CSS',()=>{
 const root=postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css','utf8'));
 const declarations=selector=>{const out={};root.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(d=>{out[d.prop]=d.value;});});return out;};
 expect(declarations('.btn.c11-button')['--bs-btn-focus-box-shadow']).toBe('none');
 expect(declarations('.c11-tabs > .nav-item > .nav-link:focus-visible')['box-shadow']).toBe('none');
 expect(declarations('.c11-button.active')['background-color']).toBe('#e6e6e6');
 expect(declarations('.c11-form')['margin-bottom']).toBe('30px');
 expect(declarations('.progress-bar.c11-progress.bg-warning')['background-color']).toBe('#ffc107');
});

it('retains PDF/CSV active state, checkbox Space and cancellation without printing',async()=>{
 const {w,requests}=await render(PrintOptionsDialog,{schoolclass:['5a'],user:'fixture',adminClass:'5a'});
 expect(w.get('[data-format=pdf]').classes()).toContain('active');
 await w.get('[data-format=csv]').trigger('click');expect(w.get('[data-format=csv]').classes()).toContain('active');
 await w.get('[data-format=pdf]').trigger('click');
 await w.get('[role=checkbox]').trigger('keydown',{key:' '});expect(w.get('[role=checkbox]').attributes('aria-checked')).toBe('true');
 await w.get('[data-action=cancel]').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);expect(requests).toEqual([]);
});
it('migrates the actual pending upload bar without completing an import',async()=>{
 const {w,aj}=await render(UploadDialog,{role:'students'});
 const field=w.findAll('input[type=file]')[0];Object.defineProperty(field.element,'files',{value:[new File(['fixture'],'synthetic.csv')]});
 // Keep the local adapter transfer pending; no real upload or import is possible.
 aj.http.get=()=>new Promise(()=>{});
 await field.trigger('change');await flushPromises();
 expect(w.get('[role=progressbar]').classes()).toEqual(expect.arrayContaining(['progress-bar','bg-warning','c11-progress']));
 expect(w.find('.progress-bar-warning').exists()).toBe(false);
});
