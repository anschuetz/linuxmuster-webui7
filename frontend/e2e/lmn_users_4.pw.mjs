import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';
import { build } from 'vite';
import { settings } from './playwright.config.mjs';
import { rows as fixture } from './fixtures/users_4.mjs';
process.env.PLAYWRIGHT_NO_COPY_PROMPT='1';
const vue=process.env.P120_UI==='vue',harness=process.env.P120_HARNESS_FILE || '/tmp/p120-users-harness.js';
const roles=[settings.roles[0],{name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw},settings.roles[1],{name:'student',login:'serdarje',pw:settings.roles[0].pw}];
const count=(l,n)=>expect.poll(()=>l.count()).toBe(n);
const rows=p=>p.locator('table:visible tr:visible').filter({has:p.locator('td')});
const modal=p=>p.locator('.modal:visible').last();
const toolbar=p=>p.locator('floating-toolbar:visible');
const button=(p,name)=>toolbar(p).locator(':is(a,button):visible').filter({hasText:name});
const check=s=>{expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
test.beforeAll(async()=>{if(vue)await build({build:{lib:{entry:fileURLToPath(new URL('./users_4.harness.mjs',import.meta.url)),name:'LmnUsersExtrasTest',formats:['iife'],fileName:()=>basename(harness)},outDir:dirname(harness),emptyOutDir:false,rolldownOptions:{external:['vue'],output:{globals:{vue:'Vue'},codeSplitting:false}}}});});
async function setup(p,context,role=roles[0]) {
    const s={writes:[],gets:[],checks:0,blocked:[],errors:[],fail:'',encoding:'utf8',list:undefined,loads:0};
    p.on('pageerror',e=>s.errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())&&!(s.fail&&/400|p120 fixture failure|Possibly unhandled rejection/.test(m.text())))s.errors.push(m.text());});
    await context.route('**/api/**',route=>{const q=route.request(),path=new URL(q.url()).pathname;if(path.startsWith('/api/lmn/users/lists/')||path.startsWith('/api/filesystem/')||(!['GET','HEAD','OPTIONS'].includes(q.method())&&path.startsWith('/api/lmn/'))){s.blocked.push([q.method(),path]);return route.abort();}return route.continue();});
    await p.route('**/api/**',async route=>{
        const q=route.request(),url=new URL(q.url()),path=url.pathname,method=q.method();let data;
        if(path==='/api/lmn/schoolsettings'&&method==='GET')data={encoding_students_extra:s.encoding,encoding_courses_extra:s.encoding};
        else if(/^\/api\/lmn\/users\/lists\/(extrastudents|extraclasses)$/.test(path)){
            if(method==='GET'){s.gets.push(path+url.search);s.loads++;data=s.list||fixture(path.endsWith('extrastudents')?'students':'courses');}
            else{s.writes.push([method,path+url.search,q.postDataJSON()]);data={};}
        }
        else if(path==='/api/lmn/users/lists/check'){s.checks++;data={OUTPUT:[{TYPE:'ERROR',MESSAGE_EN:'p120-fixture-check'}]};}
        else if(path.startsWith('/api/lmn/log/tmp/'))return route.fulfill({body:'p120 synthetic log\n'});
        else if(path.startsWith('/api/filesystem/read/')){s.gets.push(path+url.search);return route.fulfill({body:path.includes('.bak.')?'p120-backup':'p120-csv'});}
        else if(path.startsWith('/api/filesystem/write/')){s.writes.push([method,path+url.search,q.postData()]);data={};}
        else if(path.startsWith('/api/filesystem/list/')){s.gets.push(path);data={items:[{name:'.extrastudents.csv.bak.1700000000'},{name:'.extraclasses.csv.bak.1700000000'}]};}
        else if(path==='/api/lmn/diff'){s.writes.push([method,path,q.postDataJSON()]);data=['-p120-csv','+p120-backup'];}
        else if(path==='/api/lmn/remove-file'){s.writes.push([method,path,q.postDataJSON()]);data={};}
        else return route.fallback();
        if(s.fail&&path.endsWith(s.fail))return route.fulfill({status:400,json:{message:'p120 fixture failure'}});return route.fulfill({json:data});
    });
    await p.goto('/');await p.locator('input[ng\\:model=username]').fill(role.login);await p.locator('input[type=password][ng\\:model=password]').fill(role.pw);await p.locator('a[ng\\:click^=login]').click();await p.waitForURL('**/view/**');await p.waitForLoadState('networkidle');
    await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('gettextCatalog').setCurrentLanguage('de'));});return s;
}
async function navigate(p,kind){
    const view='extra-'+kind;await p.evaluate(view=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/users/'+view));},view);await p.waitForLoadState('networkidle');
    if(vue){await p.addScriptTag({path:fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js',import.meta.url))});await p.addScriptTag({path:harness});await p.evaluate(view=>{
        const i=angular.element(document).injector(),scope=i.get('$route').current.scope,el=document.querySelector('[ng-view]')||document.querySelector('[ng\\:view]');el.innerHTML='';const host=document.createElement('div');el.append(host);
        const names=['$http','notify','toaster','gettextCatalog','identity','$location','$route','pageTitle','messagebox','$rootScope'];LmnVueBridge.mountBridge(scope.$new(),host,{mount(el,aj){return LmnUsersExtrasTest.mount(el,aj,{view});}},Object.fromEntries(names.map(n=>[n,i.get(n)])));
    },view);await p.waitForLoadState('networkidle');}
}
for(const role of roles)test(role.name+': real sidebar rights for extra students/courses',async({page:p,context})=>{const s=await setup(p,context,role);for(const view of ['extra-students','extra-courses'])await count(p.locator(`a[href="/view/lmn/users/${view}/"]:visible`),0);await count(p.locator('a[href="/view/lmn/users/listmanagement/"]:visible'),['global-admin','school-admin'].includes(role.name)?1:0);if(['teacher','student'].includes(role.name)){const response=await p.request.get('/api/lmn/schoolsettings');expect(response.status()).toBe(403);}check(s);});
for(const role of roles.slice(0,2))for(const kind of ['students','courses'])test(role.name+' '+kind+': raw pagination, filter, add/remove, blur, encoding, save→check',async({page:p,context})=>{
    const s=await setup(p,context,role);s.encoding=kind==='students'?'utf8':'win1252';await navigate(p,kind);await count(rows(p),101);const list=kind==='students'?'extrastudents':'extraclasses',encoding=kind==='students'?'utf-8':'cp1252';expect(s.gets.every(u=>u.endsWith('?encoding='+encoding))).toBe(true);
    if(kind==='students'){await p.locator('.pagination:visible a').filter({hasText:/^2$/}).click();await count(rows(p),101);}else await count(p.locator('.pagination:visible'),0);
    const filter=p.locator('input[type=search]:visible');await filter.fill(' Extra 100 ');await filter.blur();await count(rows(p),1);await filter.fill('');await filter.blur();
    await button(p,/^Speichern$|^Save$/).click();await expect.poll(()=>s.writes.length).toBe(1);expect(s.writes[0]).toEqual(['POST',`/api/lmn/users/lists/${list}?encoding=${encoding}`,fixture(kind)]);
    await button(p,/Hinzufügen|Add a/).count(); // add lives outside toolbar
    await p.locator('button:visible').filter({hasText:kind==='students'?/Schüler hinzufügen|Add a student/:/Kurs hinzufügen|Add a course/}).click();await count(rows(p),102);
    // New rows sort last for these fixtures (Angular undefined type sorts before boolean in -_isNew).
    const row=rows(p).last();await button(p,/^Speichern$|^Save$/).click();await expect.poll(()=>s.writes.length).toBe(1);await count(p.locator(vue ? '.c10-invalid:visible' : '.has-error:visible').filter({has:p.locator('input')}),kind==='students'?2:3);
    const fields=kind==='students'?{Birthday:'bad',Login:'not-valid'}:{Count:'bad',Birthday:'bad','Removal date':'bad'};
    for(const [field,val]of Object.entries(fields)){await row.locator(`input[placeholder="${field}"]`).fill(' '+val+' ');await row.locator(`input[placeholder="${field}"]`).blur();}
    if(kind==='students'){await row.locator('input[placeholder="First name"]').fill(' First Last ');await row.locator('input[placeholder="First name"]').blur();}
    await button(p,/Speichern.*prüfen|Save.*check/i).click();await expect.poll(()=>s.checks).toBe(1);expect(s.writes.length).toBe(2);const added=s.writes[1][2].at(-1);expect(added).toEqual(kind==='students'?{_isNew:true,birthday:'bad',login:'not-valid',first_name:'First Last'}:{_isNew:true,count:'bad',birthday:'bad',removal_date:'bad'});
    await row.locator('button').click();await count(rows(p),101);check(s);
});
for(const kind of ['students','courses'])test(kind+': editor cancel/save and backup diff/cancel/restore use fixed default-school path',async({page:p,context})=>{
    const s=await setup(p,context);await navigate(p,kind);const list=kind==='students'?'extrastudents':'extraclasses',path=`/etc/linuxmuster/sophomorix/default-school/${list}.csv`;
    await button(p,/Im Editor öffnen|Edit CSV/).click();await expect.poll(()=>s.gets.some(u=>u.includes('/read/'+path))).toBe(true);await modal(p).locator('.modal-footer :is(a,button)').filter({hasText:/Abbrechen|Cancel/}).click();expect(s.writes).toEqual([]);
    await button(p,/Im Editor öffnen|Edit CSV/).click();await modal(p).locator('.modal-footer :is(a,button)').filter({hasText:/^Speichern$|^Save$/}).click();await expect.poll(()=>s.writes.length).toBe(1);expect(s.writes[0]).toEqual(['POST','/api/filesystem/write/'+path+'?encoding=utf-8','p120-csv']);await count(p.locator('.modal:visible'),0);
    // Reload restores Angular route; re-mount Vue fixture before opening the next common dialog.
    if(vue)await navigate(p,kind);
    await toolbar(p).locator(':is(a,button)').filter({has:p.locator('.fa-history')}).click();await (vue ? modal(p).locator('button').filter({hasText:/Unterschiede|Show differences/}) : modal(p).locator('a[title]').filter({has:p.locator('.fa-exchange-alt')})).click();await expect.poll(()=>s.writes.length).toBe(2);expect(s.writes[1]).toEqual(['POST','/api/lmn/diff',{file1:path,file2:path.replace(list+'.csv','.'+list+'.csv.bak.1700000000')}]);
    await count(p.locator('.modal:visible'),2);await p.locator('.modal:visible').filter({has:p.locator('.modal-header h4').filter({hasText:/Unterschied|Differences/})}).locator('.modal-footer button').click();await count(p.locator('.modal:visible'),1);await modal(p).locator('.modal-footer :is(a,button)').filter({hasText:/Schließen|Close|Abbrechen|Cancel/}).click();await count(p.locator('.modal:visible'),0);expect(s.writes.length).toBe(2);
    await toolbar(p).locator(':is(a,button)').filter({has:p.locator('.fa-history')}).click();await (vue ? modal(p).locator('button').filter({hasText:/Wiederherstellen|Restore/}) : modal(p).locator('a[title]').filter({has:p.locator('.fa-history')})).click();await expect.poll(()=>s.writes.length).toBe(4);expect(s.writes.slice(2)).toEqual([['POST','/api/filesystem/write/'+path+'?encoding=utf-8','p120-backup'],['POST','/api/lmn/remove-file',{filepath:path.replace(list+'.csv','.'+list+'.csv.bak.1700000000')}]]);check(s);
});
test('students duplicate logins block, invalid strings pass, failed POST never starts check',async({page:p,context})=>{
    const s=await setup(p,context);s.list=[fixture('students')[0],{...fixture('students')[0],first_name:'Other'}];await navigate(p,'students');await button(p,/^Speichern$|^Save$/).click();expect(s.writes).toEqual([]);await count(p.locator(vue ? '.c10-invalid:visible' : '.has-error:visible'),2);
    await rows(p).last().locator('[placeholder=Login]').fill('has-hyphen');await rows(p).last().locator('[placeholder=Login]').blur();s.fail='extrastudents';await button(p,/Speichern.*prüfen|Save.*check/i).click();await expect.poll(()=>s.writes.length).toBe(1);await p.waitForLoadState('networkidle');expect(s.checks).toBe(0);check(s);
});
