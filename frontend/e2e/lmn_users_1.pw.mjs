import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';
import { build } from 'vite';
import { settings } from './playwright.config.mjs';
import { user, config, syntheticPassword, firstPassword } from './fixtures/users_1.mjs';
// Prevent automatic failure DOM snapshots from recording visible secrets.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const vue=process.env.P117_UI==='vue';
const harnessFile=process.env.P117_HARNESS_FILE || '/tmp/p117-users-harness.js';
test.beforeAll(async()=>{
 if(vue)await build({build:{lib:{entry:fileURLToPath(new URL('./users_1.harness.mjs',import.meta.url)),name:'LmnUsersTest',formats:['iife'],fileName:()=>basename(harnessFile)},outDir:dirname(harnessFile),emptyOutDir:false,rolldownOptions:{external:['vue'],output:{globals:{vue:'Vue'},codeSplitting:false}}}});
});
test.use({trace:'off',screenshot:'off',video:'off'});
const roles=[settings.roles[0],{name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw},settings.roles[1],{name:'student',login:'serdarje',pw:settings.roles[0].pw}];
const dialog=p=>p.locator('.modal:visible').last();
const box=p=>p.locator('.messagebox:visible').last();
// Boolean polling avoids matcher-generated DOM snapshots and secret diagnostics.
const visible=(locator,value=true)=>expect.poll(()=>locator.isVisible()).toBe(value);
const count=(locator,value)=>expect.poll(()=>locator.count()).toBe(value);
const hasText=(locator,value,present=true)=>expect.poll(async()=>{const text=await locator.textContent();return value instanceof RegExp?value.test(text):text.includes(value);}).toBe(present);
async function secretInput(input,value,typed=false){try{if(typed)await input.pressSequentially(value);else await input.fill(value);await input.blur();}catch{throw Error('Secret input failed');}}

async function login(p,r){await p.goto('/');await p.locator('input[ng\\:model=username]').fill(r.login);await secretInput(p.locator('input[type=password][ng\\:model=password]'),r.pw);await p.locator('a[ng\\:click^=login]').click();await p.waitForURL('**/view/**');await p.waitForLoadState('networkidle');await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('gettextCatalog').setCurrentLanguage('de'));});}
async function setup(p,context,r=roles[0]){
 const s={requests:[],reads:[],blocked:[],errors:[],value:user(),fail:false};
 p.on('pageerror',e=>s.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())&&!(s.fail&&/400/.test(m.text())&&m.location().url.includes('/api/lmn/users/passwords/')))s.errors.push(m.text());});
 await context.route('**/api/**',route=>{const q=route.request(),path=new URL(q.url()).pathname;if(!['GET','HEAD','OPTIONS'].includes(q.method())&&path.startsWith('/api/lmn/')){s.blocked.push(path);return route.abort();}return route.continue();});
 await p.route('**/api/lmn/**',route=>{
  const q=route.request(),path=new URL(q.url()).pathname,method=q.method();let data;const b=q.postData()?q.postDataJSON():undefined;if(method==='GET'&&(path.startsWith('/api/lmn/users/passwords/')||path.endsWith('/first-password-set')))s.reads.push(path);
  if(path.startsWith('/api/lmn/users/passwords/')){
   // Never retain passwords in request logs, including synthetic values.
   if(method==='POST'){s.requests.push([method,path,{users:b.users,...(Object.hasOwn(b,'password')?{validPassword:b.password===syntheticPassword}:{})}]);if(s.fail)return route.fulfill({status:400,json:{message:'fixture failure'}});data=path.endsWith('/print')?'user-p117.pdf':{};}
   else data=firstPassword;
  } else if(path.endsWith('/first-password-set'))data=true;
  else if(/^\/api\/lmn\/sophomorixUsers\/[^/]+\/p117-user$/.test(path))data=[s.value];
  else if(path==='/api/lmn/quota/user/p117-user')data={home:{used:75,hard_limit:100},cloud:{used:2,hard_limit:10},bad:{ERROR:true}};
  else if(path.startsWith('/api/lmn/config/customfields/'))data=config();
  else if(path==='/api/lmn/ldap-search')data=[{login:'p117-parent',label:'Synthetic Parent',displayName:'Synthetic Parent',role:'parent'},{login:'skip',label:'Skip',role:'student'},{login:'skip2',label:'Skip2',role:'globaladministrator'}];
  else if(path.startsWith('/api/lmn/users/p117-user/')){data={};s.requests.push([method,path,b]);}
  else if(['/api/lmn/sophomorixUsers/add-parent','/api/lmn/sophomorixUsers/remove-parent'].includes(path)){data='';s.requests.push([method,path,b]);}
  else if(path==='/api/lmn/sophomorixUsers/killuser'){data=false;s.requests.push([method,path,b]);}
  else return route.fallback();
  return route.fulfill({json:data,contentType:'application/json'});
 });
 await login(p,r);
 if(vue){await p.addScriptTag({path:fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js',import.meta.url))});await p.addScriptTag({path:harnessFile});await p.evaluate(()=>{const i=angular.element(document).injector(),el=document.createElement('div');document.body.append(el);const names=['$http','notify','toaster','gettextCatalog','identity','$location','$route','pageTitle','messagebox','$rootScope'];LmnVueBridge.mountBridge(i.get('$route').current.scope.$new(),el,{mount(el,aj){window.p117aj=aj;return ()=>{};}},Object.fromEntries(names.map(n=>[n,i.get(n)])));});}
 return s;
}
async function open(p,kind,args={}){await p.evaluate(({vue,kind,args})=>{const i=angular.element(document).injector();i.get('$rootScope').$evalAsync(()=>{
 if(vue){const pw=LmnUsersTest.createPasswords(window.p117aj);const result=kind==='details'?window.p117aj.modal.open(LmnUsersTest.UserDetails,{id:'p117-user',role:args.role||'students'}):kind==='show'?pw.showFirstPassword(args.username||'p117-user'):pw.setCustomPassword(args.users||[{sAMAccountName:'p117-user'}],args.type||'first');result?.catch(()=>{});}
 else if(kind==='details')i.get('$uibModal').open({templateUrl:'/lmn_users:resources/partial/userDetails.modal.html',controller:'LMNUserDetailsController',resolve:{id:()=> 'p117-user',role:()=>args.role||'students'}}).result.catch(()=>{});
 else if(kind==='show')i.get('userPassword').showFirstPassword(args.username||'p117-user').catch(()=>{});
 else i.get('userPassword').setCustomPassword(args.users||[{sAMAccountName:'p117-user'}],args.type||'first');
 });},{vue,kind,args});await visible(dialog(p));}
const check=s=>{expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
for(const r of roles)test(r.name+': real API authorization and denied higher target',async({page:p,context})=>{
 const s=await setup(p,context,r);expect((await p.request.get('/api/lmn/sophomorixUsers/students')).status()).toBe(r.name==='student'?403:200);
 if(r.name==='student'||r.name==='teacher')expect((await p.request.get('/api/lmn/users/passwords/pgmadmin')).status()).toBe(403);
 if(r.name==='teacher')expect((await p.request.get('/api/lmn/users/passwords/'+(r.login==='ba'?'zem':'ba'))).status()).toBe(403);
 if(r.name==='school-admin')expect((await p.request.get('/api/lmn/users/passwords/global-admin')).status()).toBe(403);check(s);
});
for(const r of roles.slice(0,2))test(r.name+': detail properties/groups/quotas, custom edits, parent add/remove, delete cancel',async({page:p,context})=>{
 const s=await setup(p,context,r);await open(p,'details');const d=p.locator('.modal:visible').first();await hasText(d,'Synthetic User');await hasText(d,'p117-class');await hasText(d,'75 MiB / 100 MiB - 75%');await hasText(d,/Birthday:|Geburtstag:/,false);await hasText(d.locator('h3').first(),'Benutzerdetails');await hasText(d,'Eigenschaften');const group=d.locator('.panel').first();await hasText(group.locator('li'),'schoolclasses');await group.locator('.panel-heading a').click();await visible(group.locator('.panel-body'),false);await group.locator('.panel-heading a').click();
 const click=async old=>{await d.locator(old+':visible').first().click();};
 await click(vue?'[data-action=edit-1]':'a[ng\\:click="editCustom(n)"]');await box(p).locator('input').fill('  inner value  ');await box(p).locator('.positive').click();await hasText(d,'inner value');
 await click(vue?'[data-action=add-multi-1]':'a[ng\\:click="addCustomMulti(n)"]');await box(p).locator('input').fill('multi');await box(p).locator('.positive').click();await hasText(d,'multi');
 await click(vue?'[data-action=remove-multi-1]':'span[ng\\:click="removeCustomMulti(n, value)"]');await box(p).locator('.negative').click();await count(d.locator(vue?'[data-action=remove-multi-1]':'span[ng\\:click="removeCustomMulti(n, value)"]'),2);
 await click(vue?'[data-action=remove-multi-1]':'span[ng\\:click="removeCustomMulti(n, value)"]');await box(p).locator('.positive').click();
 await click(vue?'[data-action=add-proxy]':'a[ng\\:click="addProxyAddresses()"]');await box(p).locator('input').fill('smtp:new@test.invalid');await box(p).locator('.positive').click();
 await d.locator(vue?'[data-action=remove-proxy]':'span[ng\\:click="removeProxyAddresses(value)"]').first().click();await box(p).locator('.positive').click();
 await click(vue?'[data-action=parent-search]':'a[ng\\:click="showParentSearch()"]');await d.locator('dialog input').fill('par');await visible(d.getByText('Synthetic Parent',{exact:true}).last());await d.getByText('Synthetic Parent',{exact:true}).last().click();await hasText(d,'Synthetic Parent');await click(vue?'[data-action=remove-parent]':'a[ng\\:click="removeParent(parent)"]');
 await click(vue?'[data-action=kill]':'a[ng-click="killUser(userDetails)"]');await box(p).locator('.negative').click();expect(s.requests.some(x=>x[1].endsWith('killuser'))).toBe(false);
 expect(s.requests).toEqual([['POST','/api/lmn/users/p117-user/custom/1',{value:'inner value'}],['POST','/api/lmn/users/p117-user/custommulti/1',{value:'multi'}],['PATCH','/api/lmn/users/p117-user/custommulti/1',{value:'old'}],['POST','/api/lmn/users/p117-user/proxyaddresses',{address:'smtp:new@test.invalid'}],['PATCH','/api/lmn/users/p117-user/proxyaddresses',{address:'SMTP:p117@test.invalid'}],['POST','/api/lmn/sophomorixUsers/add-parent',{student:'p117-user',parent:'p117-parent'}],['POST','/api/lmn/sophomorixUsers/remove-parent',{student:'p117-user',parent:'p117-parent'}]]);check(s);
});
for(const type of ['first','current'])test('custom '+type+': preserved whitespace, cancel and HTTP failure',async({page:p,context})=>{
 const s=await setup(p,context);await open(p,'custom',{type});await secretInput(dialog(p).locator('input'),syntheticPassword,true);await dialog(p).locator('.modal-footer a').last().click();await count(p.locator('.modal:visible'),0);expect(s.requests).toEqual([['POST','/api/lmn/users/passwords/set-'+type,{users:'p117-user',validPassword:true}]]);
 await open(p,'custom',{type});await dialog(p).locator('.modal-footer a').first().click();await count(p.locator('.modal:visible'),0);expect(s.requests.length).toBe(1);
 s.fail=true;await open(p,'custom',{type});await secretInput(dialog(p).locator('input'),syntheticPassword);await dialog(p).locator('.modal-footer a').last().click();await hasText(p.locator('#toast-container'),'fixture failure');await visible(dialog(p));check(s);
});
for(const exam of [false,true])test('show first password'+(exam?' exam':'')+': status, blur, close',async({page:p,context})=>{
 const s=await setup(p,context);await open(p,'show',{username:'p117-user'+(exam?'-exam':'')});await expect.poll(async()=>dialog(p).locator('.password').evaluate((el,secret)=>el.textContent.trim()===secret,firstPassword)).toBe(true);if(!exam)await hasText(dialog(p).locator('tr:last-child td:last-child span'),/Noch gesetzt|Still Set/);expect(s.reads).toEqual(exam?['/api/lmn/users/passwords/p117-user']:['/api/lmn/users/passwords/p117-user','/api/lmn/users/p117-user/first-password-set']);await dialog(p).click();await visible(dialog(p));await dialog(p).locator('.modal-footer a').click();await count(p.locator('.modal:visible'),0);check(s);
});
test('batch reset/random/custom and PDF use selected accounts only',async({page:p,context})=>{
 const s=await setup(p,context);await p.route('**/api/lmn/users/passwords/download/user-p117.pdf',route=>route.fulfill({contentType:'application/pdf',headers:{'content-disposition':'attachment; filename=user-p117.pdf'},body:'%PDF-1.4\n% synthetic fixture'}));
 const batch=async cmd=>p.evaluate(({vue,cmd})=>{const i=angular.element(document).injector(),list=[{sAMAccountName:'p117-user',selected:true},{sAMAccountName:'skip'}];i.get('$rootScope').$evalAsync(()=>{const pw=vue?LmnUsersTest.createPasswords(window.p117aj):i.get('userPassword');if(cmd==='print')pw.printSelectedPasswords(list);else pw.batchPasswords(list,cmd);});},{vue,cmd});
 await batch('reset-first');await batch('random-first');await batch('custom-first');await visible(dialog(p));await dialog(p).locator('.modal-footer a').first().click();const downloaded=p.waitForEvent('download');await batch('print');expect((await downloaded).url().endsWith('/api/lmn/users/passwords/download/user-p117.pdf')).toBe(true);await expect.poll(()=>s.requests.length).toBe(3);expect(s.requests).toEqual([['POST','/api/lmn/users/passwords/reset-first',{users:'p117-user'}],['POST','/api/lmn/users/passwords/set-random',{users:'p117-user'}],['POST','/api/lmn/users/passwords/print',{users:'p117-user'}]]);check(s);
});
