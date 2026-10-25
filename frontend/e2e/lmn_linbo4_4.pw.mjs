import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { settings } from './playwright.config.mjs';
import { imageList, backupImage, scriptExample } from './fixtures/linbo4-images.mjs';
const base='/api/lmn/linbo4',path='/view/lmn/linbo4';
const fullRoute=process.env.P87_FULL_ROUTE==='1'||Boolean(process.env.P87_UI);
const vue=(process.env.P87_UI??process.env.P86_UI)==='vue',viewPath=vue&&!fullRoute?'/view/lmn/landingpage':path;
const admin=settings.roles.find(r=>r.name==='global-admin');
const allowed=[admin,{name:'school-admin',login:'pgmadmin',pw:admin.pw}];
const denied=[settings.roles.find(r=>r.name==='teacher'),{name:'student',login:'serdarje',pw:admin.pw}];
const pane=page=>vue&&!fullRoute?page.locator('#p86-mount'):fullRoute&&vue?page.locator('lmn-vue-mount'):page.locator('.tab-pane.active');
const dialog=page=>page.locator('.modal:visible:not([aria-hidden="true"])').last();
const box=page=>page.locator('.messagebox:visible').last();
let harnessPath;
test.setTimeout(90_000);
test.beforeAll(async()=>{
    if(!vue||fullRoute)return;
    const outDir=mkdtempSync(join(tmpdir(),'p86-harness-'));harnessPath=join(outDir,'harness.js');
    await build({configFile:fileURLToPath(new URL('../vite.config.mjs',import.meta.url)),build:{outDir,emptyOutDir:false,lib:{entry:fileURLToPath(new URL('./fixtures/linbo4-images-harness.mjs',import.meta.url)),name:'P86Harness',formats:['iife'],fileName:()=> 'harness.js'},rolldownOptions:{external:['vue'],output:{globals:{vue:'Vue'},codeSplitting:false}}}});
});
async function login(page, role, state) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page).toHaveURL(/\/view\//);
    await page.waitForFunction(() => window.angular?.element(document).injector()?.get('identity').profile?.activeSchool);
    state.authenticated = true;
}
function listen(page) {
    const state = { offsets: [], imports: [], errors: [], blocked: [], writes: [], authenticated: false };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text() + ' [' + m.location().url + ']'); });
    return state;
}
async function fixture(page,context,state,options={}) {
    await context.route('**/api/**',async route=>{
        const req=route.request(),u=new URL(req.url()),p=u.pathname;
        if(req.method()==='GET' && p.startsWith(base)) {
            if(p===base+'/restart-services') {state.writes.push(['GET',p,null]);return route.fulfill(state.failRestart?{status:500,json:{message:'P86 restart failure',exception:'EndpointError'}}:{json:null});}
            if(p===base+'/configs') {
                await page.waitForFunction(()=>window.angular?.element(document).injector()?.get('identity').profile?.activeSchool);
                return route.fulfill({json:[{file:'start.conf.one',images:['p86.qcow2'],settings:{}},{file:'start.conf.other',images:['p86.qcow2'],settings:{School:'other-school'}},{file:'start.conf.part.two',images:['p86.qcow2'],settings:{School:'default-school'}}]});
            }
            if(p===base+'/images') return route.fulfill(state.failImages?{status:500,json:{message:'P86 list failure',exception:'EndpointError'}}:{json:imageList()});
            if(p.startsWith(base+'/examples/')) return route.fulfill({json:p.endsWith('/config')?[]:['example '+p.split('/').at(-1)]});
            state.blocked.push(['GET',p]);return route.abort();
        }
        if(req.method()==='GET' && p.startsWith('/api/filesystem/read/')) {
            state.reads??=[];state.reads.push(decodeURIComponent(p));
            return route.fulfill({json:scriptExample(decodeURIComponent(p).split(' ').at(-1))});
        }
        if(req.method()==='POST' && new RegExp('^'+base+'/(images|saveBackupImage|renameImage|duplicateImage)/p86$').test(p)) {
            state.writes.push(['POST',p,req.postDataJSON()]);
            return route.fulfill({json:null});
        }
        if((state.authenticated&&!['GET','HEAD','OPTIONS'].includes(req.method()))||p.endsWith('/restart-services')) {
            state.blocked.push([req.method(),p]);return route.abort('blockedbyclient');
        }
        return route.continue();
    });
}
async function start(page,context,role) {const state=listen(page);await fixture(page,context,state);await login(page,role,state);await open(page,'#images');return state;}
const row=page=>pane(page).locator('tr').filter({has:page.locator('b', {hasText:/^p86$/})}).first();
async function edit(page,kind='main') {
    if(kind==='backup' && fullRoute) {
        await row(page).locator(vue?'[data-action="backups"]':'button[ng\\:click="showBackups(image)"]').click();
        await dialog(page).locator(vue?'[data-action="edit-backup"]':'button:has(.fa-cog)').first().click();
    } else if(kind==='backup') {
        await page.evaluate(isVue=>{
            if(isVue){window.p86editBackup();return;}
            const scope=angular.element(document).injector().get('$route').current.scope;
            scope.$apply(()=>scope.editImage(scope.images[0].backups_list[0]));
        },vue);
    } else await row(page).locator(vue?`[data-action="${kind==='diff'?'edit-diff':'edit'}"]`:`button[ng\\:click="editImage(${kind==='diff'?'image.diff_image':'image'})"]`).click();
    await expect(dialog(page)).toBeVisible();
}
const model=(page,key)=>dialog(page).locator(`[ng\\:model="image.${key}"], [data-model="image.${key}"]`);
async function tab(page,key) {
    const labels={reg:/Registry patch|Registry Patch|Registry-Patch/,postsync:/Postsync/,prestart:/Prestart/};
    await dialog(page).locator('.nav-tabs a').filter({hasText:labels[key]}).click();
}
async function scriptValue(page,key,value) {
    await model(page,key).evaluate((el,value)=>{
        const target=el.matches('.ace_editor')?el:el.querySelector('.ace_editor');
        window.ace.edit(target).setValue(value,-1);
    },value);
}
async function copyScript(page,key,example=false) {
    await tab(page,key);
    const panel=dialog(page).locator(vue?`[data-panel="${key}"]`:'.tab-pane.active');
    await panel.getByRole('button',{name:/Copy from|Kopieren von/}).click();
    await panel.getByText(example?new RegExp('example '+key):'source',{exact:!example}).click();
    const expected=example?scriptExample(key):imageList()[1][key];
    await expect.poll(()=>model(page,key).evaluate(el=>window.ace.edit(el.matches('.ace_editor')?el:el.querySelector('.ace_editor')).getValue())).toBe(expected);
}
const save=page=>dialog(page).getByText(/^(Save|Speichern)$/,{exact:true}).last().click();
const close=page=>dialog(page).getByText(/^(Close|Schließen)$/,{exact:true}).last().click();
function clean(state){expect(state.blocked).toEqual([]);expect(state.errors).toEqual([]);}
async function open(page, hash = '') {
    const target = new URL(viewPath + hash, page.url()).href;
    if (page.url() === target) await page.reload(); else await page.goto(target);
    if (!vue || fullRoute) return;
    await page.waitForFunction(() => window.angular?.element(document).injector()?.get('$route').current?.scope);
    // Local harness on the landing route: no second LINBO controller/data set.
    await page.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js', import.meta.url)) });
    await page.addScriptTag({ path: harnessPath });
    await page.evaluate(() => {
        const injector = angular.element(document).injector(), node = document.createElement('div');
        node.id = 'p86-mount';
        const original = document.querySelector('[ng\\:view]');
        const oldScope = injector.get('$route').current.scope;
        node.className = original.className; // Preserve the shell content inset below its fixed navbar.
        original.style.display = 'none'; original.parentElement.append(node);
        const scope = oldScope.$new();
        scope.$on('$destroy', () => node.remove());
        window.p86scope = scope;
        const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
        LmnVueBridge.mountBridge(scope, node, P86Harness, Object.fromEntries(names.map(name => [name, injector.get(name)])));
    });
}

for(const role of allowed) {
    test(`${role.name}: server order, used_in, bytes, prose rows, cancel and ISO destination`,async({page,context})=>{
        const state=await start(page,context,role);
        const rows=pane(page).locator('tr:visible').filter({has:page.locator('td')});
        await expect(rows).toHaveCount(3);
        expect(await rows.evaluateAll(rows=>rows.map(r=>r.querySelector('b')?.textContent.trim()))).toEqual(['p86','source','broken']);
        await expect(row(page).locator(vue ? 'td:nth-child(4) > span' : '.label-success')).toHaveText(['one','two']);
        await expect(row(page)).toContainText('1.5 KB');
        await edit(page);expect(await model(page,'desc').getAttribute('rows')).toBe('3');expect(await model(page,'info').getAttribute('rows')).toBe('2');
        await model(page,'desc').fill('cancel draft');await close(page);expect(state.writes).toEqual([]);
        await page.locator('.nav-tabs a').filter({hasText:/^(Groups|Gruppen)$/}).click();
        let download;
        await context.route('**/lmn/download/linbo.iso',route=>{download=new URL(route.request().url()).pathname;return route.fulfill({status:204});});
        await pane(page).getByText(/^(Download Linbo Boot|LINBO Boot.*|Linbo Boot.*)$/,{exact:true}).click({noWaitAfter:true});
        await expect.poll(()=>download).toBe('/lmn/download/linbo.iso');clean(state);
    });
    for(const kind of ['main','diff','backup']) test(`${role.name}: ${kind} exact scripts and save/restart payload`,async({page,context})=>{
        const state=await start(page,context,role);await edit(page,kind);
        const original=kind==='main'?{...imageList()[0],backups:{'20261001':{...backupImage(),date:'20261001'}},backups_list:[{...backupImage(),date:'20261001'}],used_in:['one','two']}:kind==='diff'?imageList()[0].diff_image:{...backupImage(),date:'20261001'};
        await model(page,'desc').fill('  P86 description\nline two  ');await model(page,'info').fill('  P86 info  ');
        await copyScript(page,'reg');await copyScript(page,'reg',true);
        await expect.poll(()=>state.reads?.length).toBe(1);
        await scriptValue(page,'reg','  edited reg\n');
        if(kind!=='diff') {await copyScript(page,'postsync',true);await expect.poll(()=>state.reads?.length).toBe(2);}
        await copyScript(page,'prestart',true);await expect.poll(()=>state.reads?.length).toBe(kind==='diff'?2:3);
        await save(page);await expect.poll(()=>state.writes.length).toBe(2);
        const data={...original,desc:'P86 description\nline two',info:'P86 info',reg:'  edited reg\n',prestart:scriptExample('prestart'),...(kind!=='diff'?{postsync:scriptExample('postsync')}:{})};
        expect(state.writes).toEqual([['POST',base+(kind==='backup'?'/saveBackupImage/p86':'/images/p86'),kind==='backup'?{data,timestamp:123}:{data,...(kind==='diff'?{diff:true}:{})}],['GET',base+'/restart-services',null]]);
        expect(state.reads).toEqual((kind==='diff'?['reg','prestart']:['reg','postsync','prestart']).map(k=>'/api/filesystem/read//srv/linbo/examples/example '+k));
        await expect(page.locator('.toast-success').filter({hasText:/Multicast|Multicast-/})).toBeVisible();clean(state);
    });
    test(`${role.name}: failed image list stays unset and failed restart reports without reload`,async({page,context})=>{
        const state=listen(page);state.failImages=true;await fixture(page,context,state);await login(page,role,state);await open(page,'#images');
        await expect.poll(()=>state.errors.filter(e=>/500/.test(e)).length).toBeGreaterThan(0);
        await expect(pane(page).getByText(/There's no image|noch kein Image/)).toHaveCount(0);
        state.failImages=false;state.errors=[];await open(page,'#images');await edit(page);state.failRestart=true;
        await save(page);await expect.poll(()=>state.writes.length).toBe(2);
        await expect(page.locator('.toast-error').last()).toContainText(/Failed to restart|Multicast und Torrent-Dienste konnten nicht neu gestartet werden/);
        state.errors=state.errors.filter(e=>!/500 \(Internal Server Error\)/i.test(e));clean(state);
    });
    test(`${role.name}: duplicate and rename cancel, invalid names and exact requests`,async({page,context})=>{
        const state=await start(page,context,role);
        for(const action of ['duplicateImage','renameImage']) {
            const trigger=async()=>{
                if(action==='duplicateImage')await row(page).locator(vue?'[data-action="duplicate"]':'button[ng\\:click="duplicateImage(image)"]').click();
                else {await edit(page);await dialog(page).locator(vue?'[data-action="rename"]':'button:has(.fa-pencil)').click();}
            };
            await trigger();await box(page).locator('.negative').click();if(action==='renameImage')await close(page);
            expect(state.writes).toEqual([]);
            await trigger();await box(page).locator('input').fill('invalid.name');await box(page).locator('.positive').click();
            await expect(page.locator('.toast-error').last()).toContainText('invalid.name');if(action==='renameImage')await close(page);
            expect(state.writes).toEqual([]);
        }
        for(const action of ['duplicateImage','renameImage']) {
            if(action==='duplicateImage')await row(page).locator(vue?'[data-action="duplicate"]':'button[ng\\:click="duplicateImage(image)"]').click();
            else {await edit(page);await dialog(page).locator(vue?'[data-action="rename"]':'button:has(.fa-pencil)').click();}
            await box(page).locator('input').fill('p86-copy');await box(page).locator('.positive').click();
            await expect.poll(()=>state.writes.length).toBe(2);
            expect(state.writes).toEqual([['POST',base+'/'+action+'/p86',{new_name:'p86-copy'}],['GET',base+'/restart-services',null]]);
            // Reload the harness after the successful request/service sequence.
            state.writes=[];await open(page,'#images');
        }
        clean(state);
    });
}
for(const role of denied) test(`${role.name}: sidebar absent and direct image/template data denied`,async({page})=>{
    const state=listen(page);await login(page,role,state);
    await expect(page.locator('a[href^="/view/lmn/linbo4"]')).toHaveCount(0);
    for(const suffix of ['/images','/examples/reg','/examples/postsync','/examples/prestart'])expect((await page.request.get(base+suffix)).status()).toBe(403);
    clean(state);
});
