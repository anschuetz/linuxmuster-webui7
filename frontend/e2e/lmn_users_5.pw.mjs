import { test, expect } from '@playwright/test';
import { settings } from './playwright.config.mjs';
import { templates, custom } from './fixtures/users_5.mjs';
const roles=[settings.roles[0],{name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw},settings.roles[1],{name:'student',login:'serdarje',pw:settings.roles[0].pw}];
const modal=p=>p.locator('.modal:visible').last();
const footer=p=>modal(p).locator('.modal-footer :is(a,button)').filter({hasText:/^Ausdrucken$|^Print$/});
const rows=p=>p.locator('table:visible tr:visible').filter({has:p.locator('input[type=checkbox]')});
const row=(p,name)=>rows(p).filter({hasText:name});
const clickPrint=(p,name)=>row(p,name).locator('.fa-print').click();
const clean=s=>{expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
async function setup(p,context,role=roles[0]){
 const s={blocked:[],errors:[],writes:[],downloads:[],classes:['','5a','10b','teachers'],fail:'',result:'success',school:'p121-school',gets:[]};
 p.on('pageerror',e=>s.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())&&!(s.fail&&/400|Possibly unhandled rejection/.test(m.text())))s.errors.push(m.text());});
 await context.route('**/api/**',r=>{const q=r.request(),path=new URL(q.url()).pathname;if(path.startsWith('/api/lmn/users/passwords/download/')||(!['GET','HEAD','OPTIONS'].includes(q.method())&&path.startsWith('/api/lmn/'))){s.blocked.push([q.method(),path]);return r.abort();}return r.continue();});
 await p.route('**/api/**',r=>{
  const q=r.request(),path=new URL(q.url()).pathname;let data;
  if(path==='/api/lmn/users/classes')data=s.classes;
  else if(path==='/api/lmn/activeschool')data=s.school;
  else if(path==='/api/lmn/schoolsettings/latex-templates')data=templates;
  else if(path==='/api/lmn/config/customfields/')data=custom;
  else if(['/api/lmn/users/print','/api/lmn/users/print_csv','/api/lmn/users/passwords/print'].includes(path)){s.writes.push([path,q.postDataJSON()]);data=path.endsWith('passwords/print')?'user-global-admin.pdf':s.result;}
  else if(path.startsWith('/api/lmn/users/passwords/download/')){s.downloads.push(path);return r.fulfill({contentType:path.endsWith('.csv')?'text/csv':'application/pdf',headers:{'Content-Disposition':'attachment; filename="p121-synthetic.'+(path.endsWith('.csv')?'csv':'pdf')+'"'},body:path.endsWith('.csv')?'login,password\np121,Synthetic42!\n':'%PDF-1.4\n% p121 synthetic fixture\n%%EOF'});}
  else return r.fallback();
  s.gets.push(path);if(s.fail===path)return r.fulfill({status:400,json:{message:'p121 fixture failure'}});return r.fulfill({json:data});
 });
 await p.goto('/');await p.locator('input[ng\\:model=username]').fill(role.login);await p.locator('input[type=password][ng\\:model=password]').fill(role.pw);await p.locator('a[ng\\:click^=login]').click();await p.waitForURL('**/view/**');await p.waitForLoadState('networkidle');
 await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('gettextCatalog').setCurrentLanguage('de'));});return s;
}
async function navigate(p){await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/users/print-passwords'));});await p.waitForLoadState('networkidle');}
for(const role of roles)test(role.name+': sidebar and real read authorization',async({page:p,context})=>{const s=await setup(p,context,role);await expect(p.locator('a[href="/view/lmn/users/print-passwords/"]:visible')).toHaveCount(role.name==='student'?0:1);const response=await p.request.get('/api/lmn/users/classes');expect(response.status()).toBe(role.name==='student'?403:200);const latex=await p.request.get('/api/lmn/schoolsettings/latex-templates');expect(latex.status()).toBe(['teacher','student'].includes(role.name)?403:200);clean(s);});
for(const role of roles.slice(0,3))test(role.name+': PDF/CSV templates and download contract',async({page:p,context})=>{
 const s=await setup(p,context,role);await navigate(p);await expect(rows(p)).toHaveCount(4);await expect(rows(p).first()).toContainText('All users p121-school');await clickPrint(p,'5a');await expect(modal(p)).toBeVisible();
 const admin=role.name!=='teacher';await expect(modal(p).locator('select:visible')).toHaveCount(admin?1:0);
 if(admin){await expect(modal(p).locator('select:visible')).toContainText('multiple-school.tex');await expect(modal(p)).toContainText('4');}
 await footer(p).click();await expect.poll(()=>s.downloads.length).toBe(1);
 expect(s.writes[0]).toEqual(['/api/lmn/users/print',{format:'pdf',one_per_page:false,pdflatex:true,schoolclass:['5a'],user:role.login,adminClass:admin?(role.name==='global-admin'?'global-admins':'admins'):'teachers',template_one_per_page:admin?templates[0][1]:'',template_multiple:admin?templates[1][1]:''}]);
 expect(s.downloads[0]).toBe('/api/lmn/users/passwords/download/5a-'+role.login+'.pdf');
 await clickPrint(p,'10b');await modal(p).locator('button').filter({hasText:/CSV/}).click();await footer(p).click();await expect.poll(()=>s.downloads.length).toBe(2);expect(s.writes[1][1].format).toBe('csv');expect(s.downloads[1]).toBe('/api/lmn/users/passwords/download/10b-'+role.login+'.csv');clean(s);
});
test('selection excludes all+class, multi PDF, individual template and cancellation',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await rows(p).first().locator('input').check();await row(p,'5a').locator('input').check();await p.locator('floating-toolbar button:visible').click();await expect(p.locator('.modal:visible')).toHaveCount(0);expect(s.writes).toEqual([]);
 await rows(p).first().locator('input').uncheck();await row(p,'10b').locator('input').check();await p.locator('floating-toolbar button:visible').click();
 // Original checkbox directive wraps the hidden input; Vue exposes the same native checkbox.
 const boxes=modal(p).locator('input[type=checkbox]');if(await boxes.count())await boxes.first().check({force:true});else await modal(p).locator('[checkbox]').first().click();
 await expect(modal(p).locator('select:visible')).toContainText('individual-school.tex');await modal(p).locator('select:visible').selectOption({label:'individual-default.tex'});
 if(await boxes.count())await boxes.nth(1).uncheck({force:true});else await modal(p).locator('[checkbox]').nth(1).click();
 await footer(p).click();await expect.poll(()=>s.downloads.length).toBe(1);expect(s.writes[0][1]).toMatchObject({schoolclass:['5a','10b'],one_per_page:true,pdflatex:false,template_one_per_page:templates[0][0]});expect(s.downloads[0]).toBe('/api/lmn/users/passwords/download/multiclass-global-admin.pdf');
 await clickPrint(p,'5a');await modal(p).locator('.modal-footer :is(a,button)').filter({hasText:/Abbrechen|Cancel/}).click();expect(s.writes.length).toBe(1);clean(s);
});
test('all-users left CSV keeps empty prefix; PDF uses add; right CSV special case',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await rows(p).first().locator('.fa-file-csv').click();await expect.poll(()=>s.downloads.length).toBe(1);expect(s.writes[0]).toEqual(['/api/lmn/users/print_csv',{user:'global-admin',schoolclass:''}]);expect(s.downloads[0]).toBe('/api/lmn/users/passwords/download/-global-admin.csv');
 await rows(p).first().locator('.fa-print').click();await footer(p).click();await expect.poll(()=>s.downloads.length).toBe(2);expect(s.downloads[1]).toBe('/api/lmn/users/passwords/download/add-global-admin.pdf');clean(s);
});
for(const role of [roles[0],roles[2]])test(role.name+': empty admin warning and failed classes spinner',async({page:p,context})=>{const s=await setup(p,context,role);s.classes=[];await navigate(p);await expect(p.locator('[samba-access], [data-users-print]').first()).toContainText(role.name==='teacher'?/beitreten|join/:/importieren|importing/);s.fail='/api/lmn/users/classes';await p.reload();await p.waitForLoadState('networkidle');await expect(rows(p)).toHaveCount(0);await expect(p.locator('progress-spinner:visible,[role=status]:visible')).toHaveCount(1);clean(s);});
test('application failure closes options, HTTP failure keeps options and closes progress',async({page:p,context})=>{const s=await setup(p,context);await navigate(p);s.result='p121 application failure';await clickPrint(p,'5a');await footer(p).click();await expect(p.locator('.modal:visible')).toHaveCount(0);expect(s.downloads).toEqual([]);s.fail='/api/lmn/users/print';await clickPrint(p,'5a');await footer(p).click();await p.waitForLoadState('networkidle');await expect(p.locator('.modal:visible')).toHaveCount(1);expect(s.downloads).toEqual([]);clean(s);});

test('identity switch reloads school and classes, keeps selection; root skips reload',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await row(p,'5a').locator('input').check();const before=s.gets.filter(x=>x==='/api/lmn/activeschool').length;s.school='p121-second-school';
 await p.evaluate(async()=>{const i=angular.element(document).injector(),identity=i.get('identity');const change=()=>{identity.user='p121-other';identity.profile={...identity.profile,sophomorixRole:'teacher',sophomorixAdminClass:'teachers'};};const app=document.querySelector('lmn-vue-mount')?.__vue_app__;if(app){identity.init=()=>{change();return Promise.resolve();};await app._context.provides.aj.identity.refresh();}else i.get('$rootScope').$apply(change);});
 await expect.poll(()=>s.gets.filter(x=>x==='/api/lmn/activeschool').length).toBe(before+1);await expect(rows(p).first()).toContainText('p121-second-school');await expect(row(p,'5a').locator('input')).toBeChecked();await clickPrint(p,'5a');await expect(modal(p).locator('select:visible')).toHaveCount(0);await footer(p).click();await expect.poll(()=>s.downloads.length).toBe(1);expect(s.writes[0][1]).toMatchObject({user:'p121-other',adminClass:'teachers'});await p.evaluate(async()=>{const i=angular.element(document).injector(),identity=i.get('identity'),app=document.querySelector('lmn-vue-mount')?.__vue_app__;if(app){identity.init=()=>{identity.user='root';return Promise.resolve();};await app._context.provides.aj.identity.refresh();}else i.get('$rootScope').$apply(()=>{identity.user='root';});});await p.waitForLoadState('networkidle');expect(s.gets.filter(x=>x==='/api/lmn/activeschool').length).toBe(before+1);clean(s);
});
test('CSV on right all-users uses add helper, CSV error and rejection close progress',async({page:p,context})=>{
 const s=await setup(p,context);s.classes=['5a',''];await navigate(p);const csv=()=>rows(p).last().locator('.fa-file-csv').click();await csv();await expect.poll(()=>s.downloads.length).toBe(1);expect(s.downloads[0]).toBe('/api/lmn/users/passwords/download/add-global-admin.csv');s.result='p121 failure';await csv();await expect.poll(()=>s.writes.length).toBe(2);await p.waitForLoadState('networkidle');expect(s.downloads.length).toBe(1);s.fail='/api/lmn/users/print_csv';await csv();await p.waitForLoadState('networkidle');await expect(p.locator('.modal:visible')).toHaveCount(0);expect(s.downloads.length).toBe(1);clean(s);
});
