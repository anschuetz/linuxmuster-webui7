import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, basename } from 'node:path';
import { build } from 'vite';
import { settings } from './playwright.config.mjs';
import { users, config } from './fixtures/users_2.mjs';
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const vue = process.env.P118_UI === 'vue';
const harness = process.env.P118_HARNESS_FILE || '/tmp/p118-users-harness.js';
const roles = [settings.roles[0], {name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw}, settings.roles[1], {name:'student',login:'serdarje',pw:settings.roles[0].pw}];
test.use({trace:'off',screenshot:'off',video:'off'});
test.beforeAll(async () => {
    if (vue) await build({build:{lib:{entry:fileURLToPath(new URL('./users_2.harness.mjs',import.meta.url)),name:'LmnUsersTest',formats:['iife'],fileName:()=>basename(harness)},outDir:dirname(harness),emptyOutDir:false,rolldownOptions:{external:['vue'],output:{globals:{vue:'Vue'},codeSplitting:false}}}});
});
const visible = (l, value=true) => expect.poll(() => l.isVisible()).toBe(value);
const count = (l, n) => expect.poll(() => l.count()).toBe(n);
const text = (l, value, present=true) => expect.poll(async () => (await l.textContent()).includes(value)).toBe(present);
const rows = p => p.locator('table:visible tr:visible').filter({has:p.locator('td')});
const search = p => p.locator('input[type=search]:visible').first();
const box = p => p.locator('.messagebox:visible').last();
const dialog = p => p.locator('.modal:visible').last();
async function login(p, r) {
    await p.goto('/'); await p.locator('input[ng\\:model=username]').fill(r.login);
    try { await p.locator('input[type=password][ng\\:model=password]').fill(r.pw); } catch { throw Error('Login input failed'); }
    await p.locator('a[ng\\:click^=login]').click(); await p.waitForURL('**/view/**'); await p.waitForLoadState('networkidle');
    await p.evaluate(() => { const i=angular.element(document).injector(); i.get('$rootScope').$apply(()=>i.get('gettextCatalog').setCurrentLanguage('de')); });
}
async function setup(p, context, role=roles[0]) {
    const s={writes:[],blocked:[],errors:[],lists:[],quota:[],fail:'',none:false,empty:false,kill:true,release:undefined};
    p.on('pageerror', e => s.errors.push(e.message));
    p.on('console', m => {if(m.type()==='error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text()) && !(s.fail && /400/.test(m.text()))) s.errors.push(m.text());});
    await context.route('**/api/**', route => {
        const q=route.request(), path=new URL(q.url()).pathname;
        if(!['GET','HEAD','OPTIONS'].includes(q.method()) && path.startsWith('/api/lmn/')) {s.blocked.push(path); return route.abort();}
        return route.continue();
    });
    await p.route('**/api/lmn/**', async route => {
        const q=route.request(), path=new URL(q.url()).pathname, method=q.method(); let data;
        const list=path.match(/^\/api\/lmn\/sophomorixUsers\/(students|teachers|staff|parents)$/);
        if(list) {s.lists.push(list[1]); data=s.none?['none']:s.empty?[]:users(list[1]);}
        else if(path.startsWith('/api/lmn/config/customfields/')) data=config();
        else if(path.startsWith('/api/lmn/quota/usermap/')) {s.quota.push(path);if(s.release) await s.release;data={[path.split('/').at(-1)]:{USED:75,TYPE:'warning'}};}
        else if(/^\/api\/lmn\/sophomorixUsers\/[^/]+\/p118-\d+$/.test(path)) data=[users(path.split('/')[4])[Number(path.split('-').at(-1))]];
        else if(path.startsWith('/api/lmn/quota/user/p118-')) data={home:{used:75,hard_limit:100}};
        else if(path==='/api/lmn/sophomorixUsers/killuser') {s.writes.push([method,path,q.postDataJSON()]);data=s.kill;}
        else if(path.startsWith('/api/lmn/users/passwords/') && method==='POST') {s.writes.push([method,path,{users:q.postDataJSON().users}]);data={};}
        else return route.fallback();
        if(s.fail && path.includes(s.fail)) return route.fulfill({status:400,json:{message:'fixture failure'}});
        return route.fulfill({json:data});
    });
    await login(p,role); return s;
}
async function navigate(p, role) {
    await p.evaluate(role => {const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/users/'+role));}, role);
    await p.waitForLoadState('networkidle');
    if(vue) {
        await p.addScriptTag({path:fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js',import.meta.url))});
        await p.addScriptTag({path:harness});
        await p.evaluate(role => {
            const i=angular.element(document).injector(), scope=i.get('$route').current.scope;
            // Replace only this route's contents; shell/identity/HTTP/modal remain real.
            const el=document.querySelector('[ng-view]') || document.querySelector('[ng\\:view]');
            el.innerHTML='';const mount=document.createElement('div');el.append(mount);
            const names=['$http','notify','toaster','gettextCatalog','identity','$location','$route','pageTitle','messagebox','$rootScope'];
            LmnVueBridge.mountBridge(scope.$new(),mount,{mount(el,aj){window.p118aj=aj;return LmnUsersTest.mount(el,aj,{view:role});}},Object.fromEntries(names.map(n=>[n,i.get(n)])));
        }, role);
        await p.waitForLoadState('networkidle');
    }
}
const check = s => {expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
const header = p => p.locator('table:visible tr:visible').first().locator(vue?'input[type=checkbox]':'[checkbox]');
async function batch(p, action) {
    // Keep selector independent of the catalog's exact translation.
    if(vue) await p.locator('[data-action=batch-menu]:visible').click();
    else await p.locator('floating-toolbar [uib-dropdown-toggle]:visible').first().click();
    await p.locator(vue?`[data-action="batch-${action}"]:visible`:`a[ng\\:click="${action==='reset'?'batchResetFirstPassword()':action==='random'?'batchSetRandomFirstPassword()':'batchSetCustomFirstPassword()'}"]:visible`).click();
}
for(const r of roles) test(r.name+': real sidebar and direct API rights', async({page:p,context}) => {
    const s=await setup(p,context,r);
    for(const role of ['students','teachers','staff','parents']) {
        const response=await p.request.get('/api/lmn/sophomorixUsers/'+role);
        expect(response.status()).toBe(r.name==='student' || (r.name==='teacher' && role!=='students')?403:200);
        await count(p.locator(`a[href="/view/lmn/users/${role}/"]:visible`), ['global-admin','school-admin'].includes(r.name)?1:0);
    }
    check(s);
});
test('students: 50 rows, broad search, tied order, filtered selection, raw pagination, attic', async({page:p,context}) => {
    const s=await setup(p,context);await navigate(p,'students');await count(rows(p),50);
    expect(await rows(p).locator('td:nth-child(2) i').allTextContents()).toEqual(users().slice(0,50).map(u=>u.sAMAccountName));
    await search(p).fill(' custom-only ');await search(p).blur();await count(rows(p),50);await header(p).click();
    await count(p.locator(vue?'[data-action=batch-menu]:visible':'floating-toolbar [uib-dropdown-toggle]:visible'),0);
    await search(p).fill('!custom-only');await search(p).blur();await count(rows(p),0);
    await search(p).fill(' p118-5 ');await search(p).blur();await count(rows(p),4);await header(p).click();await header(p).click();
    await batch(p,'reset');await expect.poll(()=>s.writes.length).toBe(1);
    expect(s.writes).toEqual([['POST','/api/lmn/users/passwords/reset-first',{users:'p118-5,p118-50,p118-51,p118-52'}]]);
    await search(p).fill('');await search(p).blur();await p.locator('.pagination:visible a').filter({hasText:/^2$/}).click();await count(rows(p),3);
    await p.locator('.nav-tabs a').filter({hasText:/Attic|Dachboden/}).click();await count(rows(p),0);
    await p.locator('.nav-tabs a').filter({hasText:/Students|Schüler/}).first().click();
    await p.locator('.pagination:visible a').filter({hasText:/^1$/}).click();
    await p.locator('.nav-tabs a').filter({hasText:/Attic|Dachboden/}).click();await count(rows(p),1);await text(rows(p),'old-class');
    check(s);
});
for(const role of ['teachers','staff','parents']) test(role+': restricted search, custom columns, selected batch and detail closing', async({page:p,context}) => {
    const s=await setup(p,context,roles[1]);await navigate(p,role);await count(rows(p),50);await text(rows(p).first(),'custom-only');
    await text(rows(p).first(),'multi-a');await text(rows(p).first(),'hidden',false);
    await search(p).pressSequentially('  Synthetic 02  ');await search(p).blur();await count(rows(p),1);
    await search(p).fill('custom-only');await search(p).blur();await count(rows(p),0);
    await search(p).fill('p118-0');await search(p).blur();await header(p).click();await batch(p,'random');
    await expect.poll(()=>s.writes.length).toBe(1);expect(s.writes).toEqual([['POST','/api/lmn/users/passwords/set-random',{users:'p118-0'}]]);
    const before=s.lists.length;
    await rows(p).first().locator(vue?'[data-action=details]':'button[ng\\:click^="userInfo"]').click();await visible(dialog(p));
    await text(dialog(p),'Geburtstag:',false);await dialog(p).locator('.modal-footer a:visible').last().click();await count(p.locator('.modal:visible'),0);
    await expect.poll(()=>s.lists.length).toBe(before+(role==='teachers'?1:0));check(s);
});
test('teachers: quota requests run in parallel and publish together', async({page:p,context}) => {
    const s=await setup(p,context);await navigate(p,'teachers');let release;s.release=new Promise(resolve=>{release=resolve;});
    await p.getByText(/Show quota|Quota anzeigen|Kontingente anzeigen|Quoten anzeigen|Quota anzeigen lassen/,{exact:true}).click();
    await expect.poll(()=>s.quota.length).toBe(54);await text(rows(p).first(),'75 %',false);release();
    await text(rows(p).first(),'75 %');check(s);
});
for(const role of ['students','teachers','staff','parents']) test(role+': none sentinel and failed list retain old states', async({page:p,context}) => {
    const s=await setup(p,context);s.none=true;await navigate(p,role);
    await count(rows(p),role==='students'?1:0);
    await count(p.locator('.alert-info:visible'),role==='students'?0:1);
    s.none=false;s.fail='/sophomorixUsers/'+role;
    await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/landingpage'));});
    await navigate(p,role);await count(p.locator(vue?'[role=status]:visible':'progress-spinner:visible'),1);await count(p.locator('.alert-info:visible'),0);check(s);
});
test('parents: legacy controller delete success, false, cancel, HTTP failure', async({page:p,context}) => {
    const s=await setup(p,context);await navigate(p,'parents');
    const kill=async()=>p.evaluate(vue=>{const i=angular.element(document).injector();i.get('$rootScope').$evalAsync(()=>{
        // killparent has no button in the old template; exercise its public action.
        if(vue)LmnUsersTest.createUsers(window.p118aj).killParent('p118-0').catch(()=>{});
        else i.get('$route').current.scope.killparent('p118-0');
    });},vue);
    await kill();await box(p).locator('.negative').click();expect(s.writes).toEqual([]);
    await kill();await box(p).locator('.positive').click();await text(box(p),'parents.csv');await box(p).locator('.positive').click();
    s.kill=false;await kill();await box(p).locator('.positive').click();await text(p.locator('#toast-container'),'sophomorix-kill --kill p118-0');
    s.fail='killuser';await kill();await box(p).locator('.positive').click();await expect.poll(()=>s.writes.length).toBe(3);
    expect(s.writes).toEqual(Array(3).fill(['POST','/api/lmn/sophomorixUsers/killuser',{user:'p118-0'}]));await count(rows(p),50);check(s);
});
