import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';
import { build } from 'vite';
import { settings } from './playwright.config.mjs';
import { result } from './fixtures/users_3.mjs';
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
test.describe.configure({timeout:90_000});
const vue = process.env.P119_UI === 'vue';
const harness = process.env.P119_HARNESS_FILE || '/tmp/p119-users-harness.js';
const roles = [settings.roles[0], {name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw}, settings.roles[1], {name:'student',login:'serdarje',pw:settings.roles[0].pw}];
const modal = p => p.locator('.modal:visible').last();
const title = (p, pattern) => expect.poll(async () => (await modal(p).textContent()).match(pattern)?.[0] || '').not.toBe('');
const visible = (l, value = true) => expect.poll(() => l.isVisible()).toBe(value);
const count = (l, n) => expect.poll(() => l.count()).toBe(n);
const text = (l, value) => expect.poll(() => l.innerText()).toContain(value);
const click = (p, pattern) => modal(p).locator('.modal-footer :is(a,button):visible').filter({hasText:pattern}).click();
const tab = (p, index) => modal(p).locator('.nav-tabs a:visible').nth(index).click();
test.beforeAll(async () => {
    if (vue) await build({build:{lib:{entry:fileURLToPath(new URL('./users_3.harness.mjs',import.meta.url)),name:'LmnUsersCheckTest',formats:['iife'],fileName:()=>basename(harness)},outDir:dirname(harness),emptyOutDir:false,rolldownOptions:{external:['vue'],output:{globals:{vue:'Vue'},codeSplitting:false}}}});
});
async function login(p, r) {
    await p.goto('/'); await p.locator('input[ng\\:model=username]').fill(r.login);
    await p.locator('input[type=password][ng\\:model=password]').fill(r.pw);
    await p.locator('a[ng\\:click^=login]').click();await p.waitForURL('**/view/**');await p.waitForLoadState('networkidle');
}
async function setup(p, context, role = roles[0], fromSettings = false) {
    const s = { data:result(), writes:[], blocked:[], errors:[], checks:0, logs:[], holdCheck:false, holdApply:false, fail:'', releases:[], school:undefined, reloads:0 };
    p.on('pageerror', e=>s.errors.push(e.message));
    p.on('console', m=>{if(m.type()==='error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text()) && !(s.fail && /400/.test(m.text())))s.errors.push(m.text());});
    await context.route('**/api/**', route=>{
        const q=route.request(), path=new URL(q.url()).pathname;
        // Check itself executes Sophomorix, so guard GET as well as every write.
        if(path==='/api/lmn/users/lists/check' || (!['GET','HEAD','OPTIONS'].includes(q.method()) && path.startsWith('/api/lmn/'))) {s.blocked.push([q.method(),path]);return route.abort();}
        return route.continue();
    });
    await p.route('**/api/lmn/**', async route=>{
        const q=route.request(), url=new URL(q.url()), path=url.pathname, method=q.method();let data;
        if(path==='/api/lmn/users/lists/check') {s.checks++;if(s.holdCheck)await new Promise(resolve=>s.releases.push(resolve));data=s.data;}
        else if(path==='/api/lmn/users/lists/apply') {s.writes.push([method,path,q.postDataJSON()]);if(s.holdApply)await new Promise(resolve=>s.releases.push(resolve));data={};}
        else if(path.startsWith('/api/lmn/log/tmp/sophomorix')) {
            s.logs.push([path, Number(url.searchParams.get('offset'))]);
            return route.fulfill({body:Number(url.searchParams.get('offset'))===0?'p119-log\n'+'line\n'.repeat(100):'tail\n'});
        }
        else if(path==='/api/lmn/schoolsettings/determine-encoding') data='UTF8';
        else if(path==='/api/lmn/schoolsettings' && method==='POST') {s.writes.push([method,path,q.postDataJSON()]);data={};}
        else if(path==='/api/lmn/schoolsettings' && method==='GET') {
            const response=await route.fetch();data=await response.json();s.school=data;s.reloads++;return route.fulfill({json:data});
        }
        else return route.fallback();
        if(s.fail && path.endsWith(s.fail))return route.fulfill({status:400,json:{message:'p119 HTTP failure'}});
        // A genuinely empty response; json:null sends untyped text in this Playwright build.
        if(data===null)return route.fulfill({body:'',contentType:'application/json'});
        return route.fulfill({json:data});
    });
    await login(p,role);
    if(['global-admin','school-admin'].includes(role.name)){await p.goto('/view/lmn/schoolsettings');await p.waitForLoadState('networkidle');}
    await p.evaluate(() => {const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('gettextCatalog').setCurrentLanguage('de'));});
    await p.waitForLoadState('networkidle');
    // Settings already runs Vue in production: exercise its deployed bundle directly.
    if(vue && ['global-admin','school-admin'].includes(role.name) && !fromSettings) {
        await p.addScriptTag({path:fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js',import.meta.url))});
        await p.addScriptTag({path:harness});
        await p.evaluate(()=>{
            const i=angular.element(document).injector(), scope=i.get('$route').current.scope;
            const host=document.createElement('div');document.body.append(host);
            const names=['$http','notify','toaster','gettextCatalog','identity','$location','$route','pageTitle','messagebox','$rootScope'];
            LmnVueBridge.mountBridge(scope.$new(),host,{mount(el,aj){window.p119aj=aj;return ()=>host.remove();}},Object.fromEntries(names.map(n=>[n,i.get(n)])));
        });
        await p.waitForLoadState('networkidle');
    }
    return s;
}
async function open(p) {
    await p.evaluate(vue=>{
        if(vue)LmnUsersCheckTest.openUsersCheck(window.p119aj).catch(()=>{});
        else {const i=angular.element(document).injector();i.get('$rootScope').$evalAsync(()=>i.get('$uibModal').open({templateUrl:'/lmn_users:resources/partial/check.modal.html',controller:'LMUsersCheckModalController',backdrop:'static'}).result.catch(()=>{}));}
    },vue);
}
const check = s => {expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
const boxes = p => modal(p).locator(vue?'input[type=checkbox]':'[checkbox]');
for(const [index,mode,params] of [[0,'all',{doAdd:false,doMove:true,doKill:true}],[1,'add',{doAdd:true,doMove:false,doKill:false}],[2,'move',{doAdd:false,doMove:true,doKill:false}],[3,'kill',{doAdd:false,doMove:false,doKill:true}],[4,'error',{doAdd:true,doMove:true,doKill:true}]]) {
    test('summary, '+mode+' payload, working state, log and reload',async({page:p,context})=>{
        const s=await setup(p,context);s.holdApply=true;await open(p);await title(p,/Check result|Prüfergebnis|Ergebnis/);
        await count(boxes(p),3); // Summary has its three checked options, no log checkbox.
        for(const b of await boxes(p).all())expect(vue?await b.isChecked():await b.evaluate(e=>angular.element(e).scope().$eval(e.getAttribute('ng:model')))).toBe(true);
        await text(modal(p),'Synthetic New');await text(modal(p),'Usable (U)');await text(modal(p),'Killable (K)');await text(modal(p),'attic');await text(modal(p),'Synthetic_Kill');
        if(index===0)await boxes(p).first().click();else await tab(p,index);
        const before=s.reloads;await modal(p).locator('.modal-footer :is(a,button):visible').first().click();
        await expect.poll(()=>s.writes.length).toBe(1);expect(s.writes).toEqual([['POST','/api/lmn/users/lists/apply',params]]);
        await title(p,/Applying changes|Änderungen/);await count(modal(p).locator('.modal-footer:visible'),0);
        expect(await modal(p).locator('.modal-dialog').getAttribute('class')).toContain('modal-lg');
        await expect.poll(()=>s.logs.length).toBeGreaterThanOrEqual(2);
        expect(s.logs[0]).toEqual(['/api/lmn/log/tmp/sophomorix.log',0]);expect(s.logs[1][1]).toBeGreaterThan(0);
        const pre=modal(p).locator('pre');await expect.poll(()=>pre.evaluate(e=>e.scrollTop>0)).toBe(true);
        await boxes(p).last().click();await pre.evaluate(e=>{e.scrollTop=0;});
        await expect.poll(()=>s.logs.length).toBeGreaterThanOrEqual(3);expect(await pre.evaluate(e=>e.scrollTop)).toBe(0);
        s.releases.shift()();await expect.poll(()=>s.reloads).toBeGreaterThan(before);
        // Angular modal survives reload; bridge-owned Vue modal is destroyed (F19).
        if(!vue)await click(p,/Close|Schließen/);
        await count(p.locator('.modal:visible'),0);
        const stopped=s.logs.length;await p.waitForTimeout(1200);expect(s.logs.length).toBe(stopped);check(s);
    });
}
test('empty, OUTPUT error, ERRORLIST, HTTP failure and close',async({page:p,context})=>{
    const s=await setup(p,context);
    for(const data of [null,{OUTPUT:[{TYPE:'ERROR',MESSAGE_EN:'p119 OUTPUT failure'}]}]) {
        s.data=data;await open(p);await count(p.locator('.modal:visible'),0);
        await text(p.locator('#toast-container'),data?'p119 OUTPUT failure':'sophomorix-check');
    }
    s.data=result();s.data.CHECK_RESULT.ERRORLIST=['p119-error'];s.holdCheck=true;
    await open(p);await count(modal(p).locator('.modal-footer:visible'),0);
    await modal(p).click({position:{x:1,y:1}});await count(p.locator('.modal:visible'),1);
    await expect.poll(()=>s.logs.filter(l=>l[0].endsWith('-check.log')).length).toBeGreaterThanOrEqual(2);
    s.releases.shift()();await text(modal(p),'Synthetic reason');await click(p,/Close|Schließen/);
    s.holdCheck=false;s.fail='check';await open(p);await text(modal(p),'Prüfung fehlgeschlagen');await text(p.locator('#toast-container'),'p119 HTTP failure');await click(p,/Close|Schließen/);
    check(s);
});
test('summary zero selection, cancel and Escape do not apply',async({page:p,context})=>{
    const s=await setup(p,context);s.data=result({add:0,move:0,kill:0,errors:0});await open(p);
    await title(p,/Check result|Prüfergebnis|Ergebnis/);await count(boxes(p).filter({visible:true}),0);
    await visible(modal(p).locator('.modal-footer :is(a,button)').first());
    expect(await modal(p).locator('.modal-footer :is(a,button)').first().isDisabled()).toBe(true);
    await click(p,/Cancel|Abbrechen/);await count(p.locator('.modal:visible'),0);s.data=result();await open(p);await title(p,/Check result|Prüfergebnis|Ergebnis/);await p.keyboard.press('Escape');await count(p.locator('.modal:visible'),0);expect(s.writes).toEqual([]);check(s);
});
test('apply HTTP failure keeps finished dialog and close stops polling',async({page:p,context})=>{
    const s=await setup(p,context);s.fail='apply';await open(p);await title(p,/Check result|Prüfergebnis|Ergebnis/);
    await modal(p).locator('.modal-footer :is(a,button)').first().click();await text(p.locator('#toast-container'),'p119 HTTP failure');await click(p,/Close|Schließen/);
    const stopped=s.logs.length;await p.waitForTimeout(1200);expect(s.logs.length).toBe(stopped);check(s);
});

for(const role of roles.slice(2))test(role.name+': direct check and apply are forbidden',async({page:p,context})=>{
    const s=await setup(p,context,role);
    expect((await p.request.get('/api/lmn/users/lists/check')).status()).toBe(403);
    expect((await p.request.post('/api/lmn/users/lists/apply',{data:{doAdd:false,doMove:false,doKill:false}})).status()).toBe(403);
    check(s);
});
for(const role of roles.slice(0,2))test(role.name+': Settings Save → Check → Results → Apply',async({page:p,context})=>{
    const s=await setup(p,context,role,true);s.holdCheck=true;s.holdApply=true;
    await p.locator('floating-toolbar :is(a,button):visible').filter({hasText:/^(Save & check|Speichern.*prüfen)$/i}).click();
    await expect.poll(()=>s.checks).toBe(1);expect(s.writes).toEqual([['POST','/api/lmn/schoolsettings',s.school]]);
    await title(p,/Checking users|Überprüfe Benutzer/);s.releases.shift()();await title(p,/Check result|Prüfergebnis/);
    await modal(p).locator('.modal-footer :is(a,button):visible').first().click();await expect.poll(()=>s.writes.length).toBe(2);
    expect(s.writes[1]).toEqual(['POST','/api/lmn/users/lists/apply',{doAdd:true,doMove:true,doKill:true}]);
    const before=s.reloads;s.releases.shift()();await expect.poll(()=>s.reloads).toBeGreaterThan(before);await count(p.locator('.modal:visible'),vue?0:1);if(!vue)await click(p,/Close|Schließen/);await p.waitForLoadState('networkidle');check(s);
});

test('all status labels and unknown status remain untranslated',async({page:p,context})=>{
    const s=await setup(p,context);
    const codes='U A E S P T L D F R K X M ?'.split(' ');
    s.data.CHECK_RESULT.UPDATE=Object.fromEntries(codes.map(code=>['p119-status-'+code,{sophomorixStatus:{OLD:code,NEW:code}}]));
    await open(p);await title(p,/Check result|Prüfergebnis/);await tab(p,2);
    for(const label of ['Usable (U)','Activated (A)','Enabled (E)','Self-activated (S)','Permanent (P)','Tolerated (T)','Locked (L)','Deactivated (D)','Frozen (F)','Removable (R)','Killable (K)','Exam (X)','Managed (M)','? --> ?'])await text(modal(p),label);
    await click(p,/Cancel|Abbrechen/);check(s);
});
test('Escape while working closes Check/Apply and stops log timers, without cancelling the HTTP operation',async({page:p,context})=>{
    const s=await setup(p,context);s.holdCheck=true;s.data=null;await open(p);await title(p,/Checking users|Überprüfe Benutzer/);
    await expect.poll(()=>s.logs.length).toBeGreaterThan(0);await p.keyboard.press('Escape');await count(p.locator('.modal:visible'),0);s.releases.shift()();
    const stopped=s.logs.length;await p.waitForTimeout(1200);expect(s.logs.length).toBe(stopped);
    s.holdCheck=false;s.data=result();s.holdApply=true;await open(p);await title(p,/Check result|Prüfergebnis/);await modal(p).locator('.modal-footer :is(a,button)').first().click();
    await expect.poll(()=>s.writes.length).toBe(1);await p.keyboard.press('Escape');await count(p.locator('.modal:visible'),0);
    const before=s.reloads;s.releases.shift()();await expect.poll(()=>s.reloads).toBeGreaterThan(before);await p.waitForLoadState('networkidle');expect(s.writes).toEqual([['POST','/api/lmn/users/lists/apply',{doAdd:true,doMove:true,doKill:true}]]);check(s);
});
