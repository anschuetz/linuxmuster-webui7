import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';
import { build } from 'vite';
import { settings } from './playwright.config.mjs';
import { rows, row } from './fixtures/users_7.mjs';
import { result } from './fixtures/users_3.mjs';
const vue=process.env.P123_UI==='vue',harness=process.env.P123_HARNESS_FILE||'/tmp/p123-users-harness.js';
const roles=[settings.roles[0],{name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw},settings.roles[1],{name:'student',login:'serdarje',pw:settings.roles[0].pw}];
const labels={students:'Schüler',parents:'Eltern',teachers:'Lehrer',extrastudents:'Extra-Schüler',staff:'Mitarbeitende'};
const modal=p=>p.locator('.modal:visible').last();
const table=p=>p.locator('table:visible').filter({has:p.locator('input')});
const body=p=>table(p).locator('tr:visible').filter({has:p.locator('td')});
const action=(p,name)=>vue?p.locator(`[data-list]:visible [data-action="${name}"]`):name==='add'?p.locator('button:visible').filter({has:p.locator('.fa-plus')}):name==='backups'?p.locator('floating-toolbar:visible button').filter({has:p.locator('.fa-history')}):p.locator('floating-toolbar:visible :is(button,a)').filter({hasText:{save:/^Speichern$/,check:/^Speichern.*Prüfen$/,editor:/^Im Editor öffnen$/}[name]});
const footer=(p,re)=>modal(p).locator('.modal-footer :is(button,a)').filter({hasText:re});
const clean=s=>{expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
test.afterEach(async({page})=>{await page.request.post('/api/core/logout');});
test.beforeAll(async()=>{if(vue&&process.env.P123_PRODUCTION!=='1')await build({build:{lib:{entry:fileURLToPath(new URL('./users_7.harness.mjs',import.meta.url)),name:'LmnUsersListsTest',formats:['iife'],fileName:()=>basename(harness)},outDir:dirname(harness),emptyOutDir:false,rolldownOptions:{external:['vue'],output:{globals:{vue:'Vue'},codeSplitting:false}}}});});
async function setup(p,context,role=roles[0]){
 const checkResult=result();checkResult.CHECK_RESULT.ERRORLIST=['p119-error'];
 const s={writes:[],gets:[],blocked:[],errors:[],fail:'',lists:{},school:'school-x',checks:0,checkResult};
 p.on('pageerror',e=>s.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())&&!(s.hadFailure&&/400|Possibly unhandled rejection/.test(m.text())))s.errors.push(m.text());});
 await context.route('**/api/**',r=>{const q=r.request(),path=new URL(q.url()).pathname;if(path.startsWith('/api/lmn/users/lists/')||path.startsWith('/api/filesystem/')||(!['GET','HEAD','OPTIONS'].includes(q.method())&&path.startsWith('/api/lmn/'))){s.blocked.push([q.method(),path]);return r.abort();}return r.continue();});
 await p.route('**/api/**',async r=>{
  const q=r.request(),url=new URL(q.url()),path=url.pathname,method=q.method();let data;
  if(path==='/api/lmn/activeschool')data=s.school;
  else if(path==='/api/lmn/users/schoolconf')data={'userfile.teachers.csv':{SURNAME_CHARS:0,FIRSTNAME_CHARS:0}};
  else if(/^\/api\/lmn\/users\/lists\/(students|parents|staff|teachers|extrastudents)$/.test(path)){
   const kind=path.split('/').at(-1);if(method==='GET'){s.gets.push(path+url.search);data=s.lists[kind]||rows();}else{s.writes.push([method,path+url.search,q.postDataJSON()]);data={};}
  }else if(path==='/api/lmn/users/lists/check'){s.checks++;data=s.checkResult;}
  else if(path==='/api/lmn/users/lists/apply'){s.writes.push([method,path,q.postDataJSON()]);data={};}
  else if(path.startsWith('/api/lmn/log/tmp/'))return r.fulfill({body:'p123 synthetic log\n'});
  else if(path.startsWith('/api/filesystem/read/')){s.gets.push(path+url.search);return r.fulfill({body:path.includes('.bak.')?'p123-backup':'p123-csv'});}
  else if(path.startsWith('/api/filesystem/write/')){s.writes.push([method,path+url.search,q.postData()]);data={};}
  else if(path.startsWith('/api/filesystem/list/')){s.gets.push(path);data={items:[{name:'.school-x.students.csv.bak.1700000000'},{name:'.school-x.undefined.csv.bak.1700000000'}]};}
  else if(path==='/api/lmn/diff'){s.writes.push([method,path,q.postDataJSON()]);data=['-csv','+backup'];}
  else if(path==='/api/lmn/remove-file'){s.writes.push([method,path,q.postDataJSON()]);data={};}
  else return r.fallback();
  if(s.fail===path){s.hadFailure=true;return r.fulfill({status:400,json:{message:'p123 fixture failure'}});}return r.fulfill({json:data});
 });
 await p.goto('/');await p.locator('input[ng\\:model=username]').fill(role.login);await p.locator('input[type=password][ng\\:model=password]').fill(role.pw);await p.locator('a[ng\\:click^=login]').click();await p.waitForURL('**/view/**');await p.waitForLoadState('networkidle');
 const catalog=await(await p.request.get('/resources/all.locale.js?lang=de')).json();expect(catalog['Save']).toBe('Speichern');s.catalog=catalog;
 await p.evaluate(c=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>{const g=i.get('gettextCatalog');g.setStrings('de',c);g.setCurrentLanguage('de');});},catalog);return s;
}
async function navigate(p){
 await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/users/listmanagement'));});await p.waitForLoadState('networkidle');
 if(vue&&process.env.P123_PRODUCTION!=='1'){await p.addScriptTag({path:fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js',import.meta.url))});await p.addScriptTag({path:harness});await p.evaluate(()=>{
  const i=angular.element(document).injector(),current=i.get('$route').current,el=document.querySelector('[ng-view]')||document.querySelector('[ng\\:view]');current.scope.$destroy();const scope=i.get('$rootScope').$new();current.scope=scope;el.innerHTML='';const host=document.createElement('div');el.append(host);const names=['$http','notify','toaster','gettextCatalog','identity','$location','$route','pageTitle','messagebox','$rootScope'];LmnVueBridge.mountBridge(scope,host,{mount(el,aj){window.p123Aj=aj;return LmnUsersListsTest.mount(el,aj,{view:'listmanagement'});}},Object.fromEntries(names.map(n=>[n,i.get(n)])));
 });await p.waitForLoadState('networkidle');}
}
async function selectTab(p,kind){await p.locator('.nav-tabs:visible a').filter({hasText:new RegExp('^'+labels[kind]+'$')}).click();await p.waitForLoadState('networkidle');}
for(const role of roles)test(role.name+': sidebar and real schoolsettings/schoolconf rights',async({page:p,context})=>{
 const s=await setup(p,context,role);await expect(p.locator('a[href="/view/lmn/users/listmanagement/"]:visible')).toHaveCount(['global-admin','school-admin'].includes(role.name)?1:0);
 for(const path of ['/api/lmn/schoolsettings','/api/lmn/users/schoolconf'])expect((await p.request.get(path)).status()).toBe(['global-admin','school-admin'].includes(role.name)?200:403);clean(s);
});
for(const kind of Object.keys(labels))test(kind+': original columns, custom metadata, blur, save/check, add/remove',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await selectTab(p,kind);await expect(p.locator(vue ? '.nav-tabs:visible .nav-item .nav-link' : '.nav-tabs:visible li')).toHaveCount(5);await expect(body(p)).toHaveCount(2);await expect(action(p,'save')).toHaveText('Speichern');
 expect(s.gets.every(path=>!path.includes('?'))).toBe(true);await action(p,'save').click();await expect.poll(()=>s.writes.length).toBe(1);expect(s.writes[0]).toEqual(['POST',`/api/lmn/users/lists/${kind}?encoding=undefined`,rows()]);
 const input=body(p).first().locator('[placeholder="First name"]');await input.fill(' First Last ');await input.blur();await action(p,'check').click();await expect.poll(()=>s.checks).toBe(1);expect(s.writes[1][2][1].first_name).toBe('First Last');await footer(p,/^Schließen$/).click();
 await action(p,'add').click();await expect(modal(p)).toContainText('Benutzer hinzufügen');await footer(p,/^Hinzufügen$/).click();await expect(body(p)).toHaveCount(3);await action(p,'save').click();await expect.poll(()=>s.writes.length).toBe(2);await expect(p.locator('#error_messages:visible')).toContainText('leere Zellen');
 await body(p).last().locator('button').click();await expect(body(p)).toHaveCount(2);await action(p,'save').click();await expect.poll(()=>s.writes.length).toBe(3);clean(s);
});
test('dynamic ID visibility and immutable teacher login; invalid date/duplicate/block/correction',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);const fields=()=>vue?action(p,'fields-menu'):p.locator('button:visible').filter({hasText:/Felder/});await fields().click();
 if(vue)await p.locator('[data-list=students] [data-field=id]').check();else await p.locator('ul.dropdown-menu:visible li').filter({hasText:'Schüler ID'}).locator('[checkbox]').click();await expect(p.locator('[placeholder="Student ID (optional)"]:visible')).toHaveCount(2);
 await selectTab(p,'teachers');await expect(body(p).first().locator('[placeholder=Login]')).toBeDisabled();const input=body(p).first().locator('[placeholder=Birthday]');await input.fill('bad');await input.blur();await action(p,'check').click();expect(s.writes).toEqual([]);await expect(p.locator('#error_messages:visible')).toContainText('bad');await input.fill('1.1.2010');await input.blur();await action(p,'save').click();await expect.poll(()=>s.writes.length).toBe(1);clean(s);
});
test('editor cancel/save and backups diff/cancel/restore use active-school path',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);const path='/etc/linuxmuster/sophomorix/school-x/school-x.students.csv',backup='/etc/linuxmuster/sophomorix/school-x/.school-x.students.csv.bak.1700000000';
 for(const save of [false,true]){await p.locator('floating-toolbar:visible button').filter({hasText:/^CSV/}).click();await action(p,'editor').click();await expect.poll(()=>s.gets.some(u=>u.includes('/read/'+path))).toBe(true);await footer(p,save?/^Speichern$/:/^Abbrechen$/).click();await expect(p.locator('.modal:visible')).toHaveCount(0);if(save)await expect.poll(()=>s.writes.length).toBe(1);}
 expect(s.writes).toEqual([['POST','/api/filesystem/write/'+path+'?encoding=utf-8','p123-csv']]);if(vue)await navigate(p);
 await action(p,'backups').click();await(vue?modal(p).locator('button').filter({hasText:/Unterschiede/}):modal(p).locator('a[title]').filter({has:p.locator('.fa-exchange-alt')})).click();await expect.poll(()=>s.writes.length).toBe(2);expect(s.writes[1]).toEqual(['POST','/api/lmn/diff',{file1:path,file2:backup}]);await p.locator('.modal:visible').filter({has:p.locator('.modal-header h4').filter({hasText:/Unterschied/})}).locator('.modal-footer button').click();await footer(p,/^Schließen$|^Abbrechen$/).click();
 await action(p,'backups').click();await(vue?modal(p).locator('button').filter({hasText:/Wiederherstellen/}):modal(p).locator('a[title]').filter({has:p.locator('.fa-history')})).click();await expect.poll(()=>s.writes.length).toBe(4);expect(s.writes.slice(2)).toEqual([['POST','/api/filesystem/write/'+path+'?encoding=utf-8','p123-backup'],['POST','/api/lmn/remove-file',{filepath:backup}]]);clean(s);
});
test('Ctrl+S and Ctrl+B retain four-name tab map; Staff backup is undefined.csv',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await p.keyboard.press('Control+s');await expect.poll(()=>s.writes.length).toBe(1);await selectTab(p,'staff');await p.keyboard.press('Control+b');await(vue?modal(p).locator('button').filter({hasText:/Unterschiede/}):modal(p).locator('a[title]').filter({has:p.locator('.fa-exchange-alt')})).click();await expect.poll(()=>s.writes.length).toBe(2);expect(s.writes[1][2].file1).toBe('/etc/linuxmuster/sophomorix/school-x/school-x.undefined.csv');clean(s);
});
test('failed CSV GET retains blank table; failed save/check never opens Check',async({page:p,context})=>{
 const s=await setup(p,context);s.fail='/api/lmn/users/lists/parents';await navigate(p);await selectTab(p,'parents');await expect(body(p)).toHaveCount(0);await expect(p.locator('progress-spinner:visible,[role=status]:visible')).toHaveCount(0);s.fail='';await selectTab(p,'students');s.fail='/api/lmn/users/lists/students';await action(p,'check').click();await expect.poll(()=>s.writes.length).toBe(1);await p.waitForLoadState('networkidle');expect(s.checks).toBe(0);await expect(p.locator('.modal:visible')).toHaveCount(0);clean(s);
});

test('school-admin Save→Check→Results→Apply uses fixture payloads and leaves the final log open',async({page:p,context})=>{
 const s=await setup(p,context,roles[1]);s.checkResult=result({errors:0});await navigate(p);await action(p,'check').click();await footer(p,/^Übernehmen$/).click();await expect.poll(()=>s.writes.length).toBe(2);expect(s.writes[1]).toEqual(['POST','/api/lmn/users/lists/apply',{doAdd:true,doMove:true,doKill:true}]);await expect(modal(p).locator('pre')).toContainText('p123 synthetic log');await footer(p,/^Schließen$/).click();await expect(p.locator('.modal:visible')).toHaveCount(0);clean(s);
});
test('duplicate teacher and extra login/class conflict block saves until corrected',async({page:p,context})=>{
 const s=await setup(p,context);s.lists.teachers=[row(),{...row(),_isNew:true,first_name:'Duplicate'}];s.lists.extrastudents=[{...row(2),login:'5a'}];await navigate(p);await selectTab(p,'teachers');await action(p,'check').click();expect(s.writes).toEqual([]);await expect(p.locator('#error_messages:visible')).toContainText(s.catalog['Duplicate teachers login']);const login=body(p).last().locator('[placeholder=Login]');await login.fill('fresh-login');await login.blur();await action(p,'save').click();await expect.poll(()=>s.writes.length).toBe(1);
 await selectTab(p,'extrastudents');await action(p,'save').click();expect(s.writes.length).toBe(1);await expect(p.locator('#error_messages:visible')).toContainText(s.catalog['Conflict between login and class']);const extra=body(p).first().locator('[placeholder=Login]');await extra.fill('extra-fresh');await extra.blur();await action(p,'save').click();await expect.poll(()=>s.writes.length).toBe(2);clean(s);
});
test('raw paging slices before comment suppression, filter retains page, Rows shares page size',async({page:p,context})=>{
 const s=await setup(p,context);s.lists.students=Array.from({length:53},(_,i)=>({...row(i),class:i===0?'#comment':'5a'}));await navigate(p);await expect(body(p)).toHaveCount(49);await p.locator('.pagination:visible a').filter({hasText:/^2$/}).click();await expect(body(p)).toHaveCount(3);const query=p.locator('input[type=search]:visible');await query.fill('Fixture 50');await query.blur();await expect(body(p)).toHaveCount(0);await p.locator('.pagination:visible a').filter({hasText:/^1$/}).click();await expect(body(p)).toHaveCount(1);await query.fill('');await query.blur();
 if(vue)await action(p,'rows-menu').click();else await p.locator('button:visible').filter({hasText:/Zeilen/}).click();await p.locator('ul.dropdown-menu:visible a').filter({hasText:/^.*10 students$/}).click();await expect(body(p)).toHaveCount(9);clean(s);
});
