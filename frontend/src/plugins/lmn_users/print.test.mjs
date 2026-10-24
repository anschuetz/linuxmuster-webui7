import { readFileSync } from 'node:fs';
import { createLocale } from '../../shell/locale.mjs';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import { initialPrintOptions, printTitle, printDownload, createPrint } from './print.mjs';
import { mount as mountUsers } from './entry.mjs';
import PrintPasswords from './PrintPasswords.vue';
import PrintOptionsDialog from './PrintOptionsDialog.vue';
import { templates, custom } from '../../../e2e/fixtures/users_5.mjs';
const wrappers=[];
afterEach(()=>wrappers.splice(0).forEach(w=>w.unmount()));
function setup(overrides={}){
 const requests=[],notify=vi.fn(),download=vi.fn(),close=vi.fn(),open=vi.fn().mockResolvedValue();
 const aj=createMockAj({identity:{user:'global-admin',profile:{sophomorixRole:'globaladministrator',sophomorixAdminClass:'admins',activeSchool:'old'}},notify,modal:{open},messagebox:{show:()=>Object.assign(Promise.resolve(),{close})},http:async r=>{requests.push(r);return {data:({'/api/lmn/activeschool':'school','/api/lmn/users/classes':['','5a','10b'],'/api/lmn/schoolsettings/latex-templates':templates,'/api/lmn/config/customfields/':custom})[r.url]??'success'};},...overrides});
 return {aj,requests,notify,download,close,open};
}
function render(Component,s,props={}){const w=mount(Component,{props,global:{provide:{aj:s.aj}}});wrappers.push(w);return w;}
it('options preserve arrays, normalize root only for dialog, and use legacy class title',()=>{
 expect(initialPrintOptions([''],'root','admins')).toEqual({format:'pdf',one_per_page:false,pdflatex:true,schoolclass:[''],user:'global-admin',adminClass:'admins',template_one_per_page:'',template_multiple:''});
 expect(printTitle([''],'school',x=>x)).toEqual('Class: ');expect(printTitle(['5a','10b'],'school',x=>x)).toEqual('Class: 5a,10b');expect(printTitle('','school',x=>x)).toEqual('All users school');
 expect(printDownload(initialPrintOptions([''],'root','admins'))).toEqual('/api/lmn/users/passwords/download/add-global-admin.pdf');expect(printDownload({...initialPrintOptions(['5a','10b'],'u','teachers'),format:'csv'})).toEqual('/api/lmn/users/passwords/download/multiclass-u.csv');
});
it('templates load before custom defaults, matching paths with first template fallback',async()=>{
 const s=setup(),api=createPrint(s.aj);expect(await api.templates(initialPrintOptions(['5a'],'u','admins'))).toEqual({individual:templates[0],multiple:templates[1],template_one_per_page:templates[0][1],template_multiple:templates[1][1]});expect(s.requests.map(r=>r.url)).toEqual(['/api/lmn/schoolsettings/latex-templates','/api/lmn/config/customfields/']);
 const t=setup({http:async r=>({data:r.url.endsWith('latex-templates')?templates:{passwordTemplates:{}}})});expect((await createPrint(t.aj).templates(initialPrintOptions(['5a'],'u','admins'))).template_multiple).toEqual(templates[1][0]);
 const u=setup();expect(await createPrint(u.aj).templates(initialPrintOptions(['5a'],'u','teachers'))).toEqual(undefined);expect(u.requests).toEqual([]);
});
it('PDF forwards every option, success downloads and unsuccessful data closes without download',async()=>{
 const s=setup(),api=createPrint(s.aj,{download:s.download}),options=initialPrintOptions(['5a'],'root','admins');expect(await api.print(options)).toEqual(true);expect(s.requests.at(-1).data).toEqual(options);expect(s.download.mock.calls).toEqual([['/api/lmn/users/passwords/download/5a-global-admin.pdf']]);expect(s.close.mock.calls).toEqual([[]]);
 const f=setup({http:async()=>({data:'failure'})});expect(await createPrint(f.aj,{download:f.download}).print(options)).toEqual(true);expect(f.notify.mock.calls).toEqual([['error','Could not create password pdf: failure',undefined]]);expect(f.download.mock.calls).toEqual([]);
});
it('HTTP print failure closes progress but leaves options open without success/error toast',async()=>{
 const s=setup({http:vi.fn().mockRejectedValue(Error('HTTP'))});expect(await createPrint(s.aj,{download:s.download}).print(initialPrintOptions(['5a'],'u','admins'))).toEqual(false);expect(s.close.mock.calls).toEqual([[]]);expect(s.notify.mock.calls).toEqual([]);
});
it('CSV keeps raw caller/string classes, left empty prefix versus right all-users helper',async()=>{
 const s=setup(),api=createPrint(s.aj,{download:s.download});for(const [c,all]of [['5a',false],['',false],['',true]])await api.csv(c,all);
 expect(s.requests.map(r=>r.data)).toEqual([{user:'global-admin',schoolclass:'5a'},{user:'global-admin',schoolclass:''},{user:'global-admin',schoolclass:''}]);expect(s.download.mock.calls.map(c=>c[0])).toEqual(['/api/lmn/users/passwords/download/5a-global-admin.csv','/api/lmn/users/passwords/download/-global-admin.csv','/api/lmn/users/passwords/download/add-global-admin.csv']);
});
it.each([false,true])('CSV failure text preserves all helper distinction %s',async all=>{
 const s=setup({http:async()=>({data:'bad'})});await createPrint(s.aj).csv('',all);expect(s.notify.mock.calls).toEqual([['error','Could not create password csv'+(all?'':': bad'),undefined]]);expect(s.close.mock.calls).toEqual([[]]);
});
it('load school before classes, split rows in source order, exclude all+class even for direct print',async()=>{
 const s=setup(),w=render(PrintPasswords,s);await flushPromises();expect(s.requests.map(r=>r.url)).toEqual(['/api/lmn/activeschool','/api/lmn/users/classes']);expect(s.aj.identity.profile.activeSchool).toEqual('school');expect(w.findAll('table').map(t=>t.findAll('tr').length)).toEqual([2,1]);
 await w.findAll('input').at(0).setValue(true);await w.findAll('input').at(1).setValue(true);await w.find('[data-action=selected]').trigger('click');await w.find('[data-action=pdf]').trigger('click');expect(s.open.mock.calls).toEqual([]);expect(s.notify.mock.calls.length).toEqual(3);
 await w.findAll('input').at(0).setValue(false);await w.find('[data-action=selected]').trigger('click');expect(s.open.mock.calls).toEqual([[PrintOptionsDialog,{schoolclass:['5a'],user:'global-admin',adminClass:'admins'}]]);
});
it.each(['globaladministrator','teacher'])('empty warnings for %s only after load',async role=>{
 let resolve;const s=setup({identity:{user:'u',profile:{sophomorixRole:role,sophomorixAdminClass:'teachers'}},http:async r=>r.url.endsWith('activeschool')?{data:'school'}:new Promise(r=>resolve=r)}),w=render(PrintPasswords,s);await flushPromises();expect(w.find('[role=status]').exists()).toEqual(true);expect(w.find('.alert').exists()).toEqual(false);resolve({data:[]});await flushPromises();expect(w.text()).toContain(role==='teacher'?'join a class':'importing userlist');expect(w.find('[role=status]').exists()).toEqual(false);
});
it('identity watch skips null/root, reloads only on username change, preserves selection',async()=>{
 const s=setup({identity:{user:null,profile:{sophomorixRole:'teacher',sophomorixAdminClass:'teachers'}}}),w=render(PrintPasswords,s);await flushPromises();expect(s.requests).toEqual([]);s.aj.identity.user='root';await flushPromises();expect(s.requests).toEqual([]);expect(w.find('[role=status]').exists()).toEqual(false);s.aj.identity.user='teacher';await flushPromises();await w.findAll('input').at(1).setValue(true);s.aj.identity.profile.activeSchool='changed';await flushPromises();expect(s.requests.length).toEqual(2);s.aj.identity.user='other';await flushPromises();expect(s.requests.length).toEqual(4);expect(w.findAll('input').at(1).element.checked).toEqual(true);
});
it.each(['/api/lmn/activeschool','/api/lmn/users/classes'])('failed %s retains spinner, no false empty warning',async path=>{
 const s=setup({http:async r=>{if(r.url===path)throw Error('HTTP');return {data:'school'};}}),w=render(PrintPasswords,s);await flushPromises();expect(w.find('[role=status]').exists()).toEqual(true);expect(w.find('.alert').exists()).toEqual(false);
});
it('non samba role sees blocker; options render defaults, switch format/page/templates, cancel and print',async()=>{
 const b=setup({identity:{user:'local',profile:{}}}),blocked=render(PrintPasswords,b);await flushPromises();expect(blocked.text()).toContain('root user');
 const s=setup(),w=render(PrintOptionsDialog,s,{schoolclass:['5a'],user:'global-admin',adminClass:'admins'});await flushPromises();expect(w.find('select').element.value).toEqual('1');await w.findAll('[checkbox]').at(0).trigger('click');await w.findAll('[checkbox]').at(1).trigger('click');await w.find('select').setValue('0');await w.find('[data-format=csv]').trigger('click');expect(w.find('[data-options]').isVisible()).toEqual(false);await w.find('[data-action=print]').trigger('click');await flushPromises();expect(s.requests.at(-1).data).toEqual({...initialPrintOptions(['5a'],'global-admin','admins'),format:'csv',one_per_page:true,pdflatex:false,template_one_per_page:templates[0][0],template_multiple:templates[1][1]});expect(w.emitted('close')).toEqual([[]]);await w.find('[data-action=cancel]').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);
});
it('dialog HTTP failure remains mounted; template rejection retains initial empty choices',async()=>{
 const s=setup({http:vi.fn().mockRejectedValue(Error('HTTP'))}),w=render(PrintOptionsDialog,s,{schoolclass:['5a'],user:'u',adminClass:'admins'});await flushPromises();expect(w.find('select').exists()).toEqual(false);await w.find('[data-action=print]').trigger('click');await flushPromises();expect(w.emitted('close')).toEqual(undefined);
});

it('users entry mounts the print-passwords view and unmounts it with the route',async()=>{
 const s=setup(),host=document.createElement('div');host.setAttribute('view','print-passwords');document.body.append(host);let unmount;
 try{unmount=mountUsers(host,s.aj);await flushPromises();expect(host.querySelectorAll('table').length).toEqual(2);expect(host.textContent).toContain('5a');}
 finally{unmount?.();host.remove();}
 expect(host.innerHTML).toEqual('');
});
it('completed downloads use the current identity/options after a pending request',async()=>{
 let finish;const s=setup({http:()=>new Promise(resolve=>{finish=resolve;})}),api=createPrint(s.aj,{download:s.download});
 const pending=api.csv('5a');s.aj.identity.user='p121-other';finish({data:'success'});await pending;expect(s.download.mock.calls).toEqual([['/api/lmn/users/passwords/download/5a-p121-other.csv']]);
 const first=initialPrintOptions(['5a'],'u','admins');let current=first;const printing=api.print(first,()=>current);current={...first,format:'csv'};finish({data:'success'});await printing;expect(s.download.mock.calls.at(-1)).toEqual(['/api/lmn/users/passwords/download/5a-u.csv']);
});

it('renders print labels in German with the loaded plugin catalog', async () => {
 const germanPo = readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_users/locale/de/LC_MESSAGES/app.po', 'utf8');
 // These original msgids and translations are single-line PO entries.
 const catalog = Object.fromEntries([...germanPo.matchAll(/^msgid (".*")\nmsgstr (".*")$/gm)]
  .map(([, id, value]) => [JSON.parse(id), JSON.parse(value)]));
 const locale = createLocale({ http: { get: async () => ({ data: catalog }) } });
 await locale.setLanguage('de');
 const s = setup({ gettext: locale.gettext });
 const page = render(PrintPasswords, s);
 const dialog = render(PrintOptionsDialog, s, { schoolclass: ['5a'], user: 'global-admin', adminClass: 'admins' });
 await flushPromises();
 expect.soft(page.find('td span').text()).toBe('Alle Benutzer school');
 expect.soft(page.find('td span .fa-asterisk').exists()).toBe(true);
 expect.soft(dialog.findAll('th').map(th => th.text())).toContain('Sprache:');
 expect.soft(dialog.findAll('th').map(th => th.text())).toContain('Passwörter pro Seite:');
 await dialog.findAll('[checkbox]').at(0).trigger('click');
 expect(dialog.findAll('th').map(th => th.text())).toContain('Passwort pro Seite:');
});
