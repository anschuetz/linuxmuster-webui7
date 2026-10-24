import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';
import { editorConfig as config, editorVDI } from './fixtures/linbo4-editor.mjs';
const configs = () => [{file:'start.conf.p84',images:[],settings:{}}];
const images = () => [{name:'linux',backups:{}}];
const examples=[];
test.setTimeout(90_000);
const admin = settings.roles.find(r => r.name === 'global-admin');
const allowed = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }];
const denied = [settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const base = '/api/lmn/linbo4', path = '/view/lmn/linbo4';
const fullRoute = process.env.P87_FULL_ROUTE === '1' || Boolean(process.env.P87_UI);
const vue = (process.env.P87_UI ?? process.env.P84_UI) === 'vue';
const viewPath = vue && !fullRoute ? '/view/lmn/landingpage' : path;
const pane = page => vue && !fullRoute ? page.locator('#p84-mount') : fullRoute && vue ? page.locator('lmn-vue-mount') : page.locator('.tab-pane.active');
const box = page => page.locator('.messagebox:visible').last();
async function login(page, role, state) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    state.authenticated = true;
}
function listen(page) {
    const state = { vdi: true, errors: [], blocked: [], writes: [], authenticated: false };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text() + ' [' + m.location().url + ']'); });
    return state;
}
async function guard(context, state, real = false) {
    await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()).pathname;
        if ((fullRoute && state.authenticated && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) || (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (url.startsWith(base) || url.startsWith('/api/filesystem/') || ['/api/lmn/devices/import','/api/lmn/diff','/api/lmn/remove-file'].includes(url))) || url === base + '/restart-services') {
            if(real && req.method() === 'POST' && /^\/api\/lmn\/linbo4\/(config\/start\.conf\.p84-real-(global|school)|vdi\/start\.conf\.p84-real-(global|school)\.vdi)$/.test(url)) return route.continue();
            state.blocked.push([req.method(), url]); return route.abort('blockedbyclient');
        }
        return route.continue();
    });
}
async function fixture(page, state) {
    await page.route('**/api/lmn/linbo4/**', async route => {
        const req = route.request(), url = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
            if (req.method() !== 'POST' || ![base+'/config/start.conf.p84',base+'/vdi/start.conf.p84.vdi'].includes(url)) return route.fallback();
            state.writes.push([req.method(), url, req.postData() ? req.postDataJSON() : null]);
            return route.fulfill({ json: null });
        }
        if (url === base + '/configs') {
            await page.waitForFunction(() => window.angular?.element(document).injector()?.get('identity').profile?.activeSchool);
            return route.fulfill({ json: configs() });
        }
        if (url === base + '/images') return route.fulfill({ json: images() });
        if (url === base + '/examples/config') return route.fulfill({ json: examples });
        if (url === base+'/icons') return route.fulfill({json:['ubuntu.svg','win10.svg','old.png','linbo_hidden.svg']});
        if (url.startsWith(base+'/icons/')) return route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg"/>'});
        if (url.startsWith(base+'/vdi/')) return route.fulfill({json:state.vdi === null ? null : editorVDI()});
        if (url.startsWith(base + '/config/')) return route.fulfill({ json: config() });
        return route.fallback();
    });

}
async function open(page, hash = '') {
    await page.goto(viewPath + hash);
    if (!vue || fullRoute) return;
    await page.waitForFunction(() => window.angular?.element(document).injector()?.get('$route').current?.scope);
    // Local harness on the landing route: no second LINBO controller/data set.
    await page.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/bridge.js', import.meta.url)) });
    await page.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/lmn_linbo4/resources/vue/lmn_linbo4.js', import.meta.url)) });
    await page.evaluate(() => {
        const injector = angular.element(document).injector(), node = document.createElement('div');
        node.id = 'p84-mount';
        const original = document.querySelector('[ng\\:view]');
        const oldScope = injector.get('$route').current.scope;
        original.style.display = 'none'; original.parentElement.append(node);
        const scope = oldScope.$new();
        scope.$on('$destroy', () => node.remove());
        window.p84scope = scope;
        const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
        LmnVueBridge.mountBridge(scope, node, LmnVue_lmn_linbo4, Object.fromEntries(names.map(name => [name, injector.get(name)])));
    });
}

const dialog = page => page.locator('.modal:visible:not([aria-hidden="true"])').last();
const model = (page, name) => dialog(page).locator(`[ng\\:model="${name}"], [data-model="${name}"]`);
const click = (page, expression, translated) => vue ? dialog(page).getByText(translated,{exact:true}).last().click() : dialog(page).locator(`[ng\\:click="${expression}"]`).click();
async function editor(page, state) {
    await fixture(page,state); await open(page);
    await pane(page).locator('tr').filter({hasText:'p84'}).locator('button:has(.fa-pencil)').click();
    await expect(dialog(page).locator('h4').first()).toHaveText('p84');
}
async function tab(page, text) { await dialog(page).locator('.nav-tabs').getByText(text,{exact:true}).click(); }
function clean(state) { expect(state.blocked).toEqual([]); expect(state.errors).toEqual([]); }
async function backupFixture(page,state) {
    const backup='/srv/linbo/.start.conf.p84.bak.200';
    await page.route('**/api/filesystem/**', route => {
        const req=route.request(), u=new URL(req.url());
        if(req.method()==='GET' && u.pathname.includes('/list/')) return route.fulfill({json:{items:[{name:'.start.conf.p84.bak.100'},{name:'.start.conf.p84.bak.200'},{name:'unrelated'}]}});
        if(req.method()==='GET' && decodeURIComponent(u.pathname).includes('/read/'+backup)) return route.fulfill({json:'P84 backup content\n'});
        if(req.method()==='POST' && decodeURIComponent(u.pathname).includes('/write//srv/linbo/start.conf.p84')) { state.writes.push([req.method(),u.pathname,req.postData()]); return route.fulfill({json:null}); }
        return route.fallback();
    });
    await page.route('**/api/lmn/diff', route => {state.writes.push(['POST','/api/lmn/diff',route.request().postDataJSON()]);return route.fulfill({json:['- old','+ new']});});
    await page.route('**/api/lmn/remove-file', route => {state.writes.push(['POST','/api/lmn/remove-file',route.request().postDataJSON()]);return route.fulfill({json:null});});
}
for(const role of allowed) {
    test(`${role.name}: general fields, ngTrim, background, school toggle, cancel/save`,async({page,context})=>{
        const state=listen(page); await guard(context,state); await login(page,role,state); await editor(page,state);
        await model(page,'config.config.LINBO.RootTimeout').fill('  42  ');
        await click(page,'close()',/^(Close|Schließen)$/); expect(state.writes).toEqual([]);
        await pane(page).locator('button:has(.fa-pencil)').click();
        await expect(model(page,'config.config.LINBO.RootTimeout')).toHaveValue('600');
        await model(page,'config.config.LINBO.RootTimeout').fill('  42  ');
        await model(page,'privateConf').click();
        if(vue) await expect(model(page,'privateConf')).toBeChecked(); else await expect(model(page,'privateConf')).toHaveClass(/active/);
        await model(page,'config.config.LINBO.BackgroundColor').fill('#aabbcc');
        await model(page,'config.config.LINBO.KernelOptions').fill('');
        await model(page,'config.config.LINBO.KernelOptions').pressSequentially(' quiet inner space ');
        await click(page,'save()',/^(Save|Speichern)$/);
        await expect.poll(()=>state.writes.length).toBe(2);
        const expected=config(); expected.config.LINBO={...expected.config.LINBO,RootTimeout:'42',BackgroundColor:'aabbcc',KernelOptions:'quiet inner space'};
        expected.partitions=expected.partitions.map(p=>({...p,_isCache:p.Dev==='/dev/sda3'}));
        expect(state.writes).toEqual([['POST',base+'/config/start.conf.p84',expected],['POST',base+'/vdi/start.conf.p84.vdi',editorVDI()]]); clean(state);
    });
    test(`${role.name}: disk types, partition/OS edits, icon/image choice and removal cancellation`,async({page,context})=>{
        const state=listen(page); await guard(context,state); await login(page,role,state); await editor(page,state);
        await tab(page,/^(Partitions|Partitionen)$/);
        await model(page,'disk.DiskType').selectOption('nvme');
        await dialog(page).locator('button:has(.fa-pencil)').nth(1).click();
        await model(page,'partition.Size').fill('  50G  ');
        await tab(page,'OS');
        await model(page,'os.Name').fill('  Test OS  ');
        await model(page,'os.BaseImage').selectOption({label:'linux.qcow2'});
        if(vue) {await dialog(page).locator('button:has(img)').click();await dialog(page).locator('[data-icon="ubuntu.svg"]').click();}
        else { await dialog(page).locator('button:has(img)').click(); await dialog(page).locator('a[ng\\:click="os.IconName = icon"]').filter({hasText:'ubuntu.svg'}).click(); }
        await click(page,'save()',/^(Save|Speichern)$/);
        await dialog(page).locator('button:has(.fa-trash-o)').first().click();
        await click(page,'close()',/^(Cancel|Abbrechen)$/);
        await click(page,'save()',/^(Save|Speichern)$/);
        await expect.poll(()=>state.writes.length).toBe(2);
        const data=state.writes[0][2];
        expect(data.partitions.map(p=>[p.Dev,p.Size])).toEqual([['/dev/nvme0n1p1',204800],['/dev/nvme0n1p2','50G'],['/dev/nvme0n1p3','']]);
        expect([data.config.LINBO.Cache,data.os[0].Root,data.os[0].Boot,data.os[0].Name,data.os[0].IconName,data.os[0].BaseImage]).toEqual(['/dev/nvme0n1p3','/dev/nvme0n1p2','/dev/nvme0n1p2','Test OS','ubuntu.svg','linux.qcow2']);clean(state);
    });
    test(`${role.name}: VDI only and null VDI, numeric empty retains null`,async({page,context})=>{
        const state=listen(page); await guard(context,state); await login(page,role,state); await editor(page,state);
        await tab(page,/Virtual Desktop|Virtueller Desktop/); await model(page,'vdiconfig.cores').fill('');
        await model(page,'vdiconfig.name').fill('  VDI Name  ');
        await click(page,'save()',/^(Save|Speichern)$/);
        await expect.poll(()=>state.writes.length).toBe(1);
        expect(state.writes).toEqual([['POST',base+'/vdi/start.conf.p84.vdi',{...editorVDI(),cores:null,name:'VDI Name'}]]);
        state.vdi=null; await pane(page).locator('button:has(.fa-pencil)').click();
        await expect(dialog(page).locator('.nav-tabs').getByText(/Virtual Desktop|Virtueller Desktop/)).toBeHidden();
        await click(page,'save()',/^(Save|Speichern)$/);await expect.poll(()=>state.writes.length).toBe(2);
        expect(state.writes[1]).toEqual(['POST',base+'/vdi/start.conf.p84.vdi',null]);clean(state);
    });
    test(`${role.name}: backups diff/restore deletes restored fixture and closes editor`,async({page,context})=>{
        const state=listen(page); await guard(context,state); await login(page,role,state);await backupFixture(page,state);await editor(page,state);
        await dialog(page).locator(':is(a,button):has(.fa-history)').click();
        await expect(dialog(page).locator('.list-group-item')).toHaveCount(2);
        const first=dialog(page).locator('.list-group-item').first();
        await first.locator(vue?'button:has-text("Unterschiede"),button:has-text("Show differences")':'a:has(.fa-exchange-alt)').click();
        await expect(dialog(page)).toContainText('old');await click(page,'cancel()',/^(Close|Schließen)$/);
        await first.locator(vue?'button:has-text("Wiederherstellen"),button:has-text("Restore")':'a:has(.fa-history)').click();
        await expect.poll(()=>state.writes.length).toBe(3);
        expect(state.writes).toEqual([['POST','/api/lmn/diff',{file1:'/srv/linbo/start.conf.p84',file2:'/srv/linbo/.start.conf.p84.bak.200'}],['POST','/api/filesystem/write//srv/linbo/start.conf.p84','P84 backup content\n'],['POST','/api/lmn/remove-file',{filepath:'/srv/linbo/.start.conf.p84.bak.200'}]]);
        await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(0);clean(state);
    });
    test(`${role.name}: backup deletion confirmation and cancellation`,async({page,context})=>{
        const state=listen(page); await guard(context,state); await login(page,role,state);await backupFixture(page,state);await editor(page,state);
        const backups=async()=> {await dialog(page).locator(':is(a,button):has(.fa-history)').click(); await expect(dialog(page).locator('.list-group-item')).toHaveCount(2);};
        await backups();
        const remove=()=>dialog(page).locator('.list-group-item').first().locator(vue?'button:has-text("Löschen"),button:has-text("Delete")':'a:has(.fa-trash-o)').click();
        await remove();await page.locator('.messagebox .negative:visible').last().click();await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(0);expect(state.writes).toEqual([]);
        await pane(page).locator('button:has(.fa-pencil)').click();await backups();
        await remove();await page.locator('.messagebox .positive:visible').last().click();
        await expect.poll(()=>state.writes.length).toBe(1);
        expect(state.writes).toEqual([['POST','/api/lmn/remove-file',{filepath:'/srv/linbo/.start.conf.p84.bak.200'}]]);await expect(dialog(page).locator('.list-group-item')).toHaveCount(2);await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(1);clean(state);
    });
}
for(const role of denied) test(`${role.name}: no sidebar or direct config/VDI/icons/images access`,async({page,context})=>{
    const state=listen(page);await guard(context,state);await login(page,role,state);
    await expect(page.locator(`a[href^="${path}"]`)).toHaveCount(0);
    for(const suffix of ['/configs','/images','/icons','/config/start.conf.p84','/vdi/start.conf.p84.vdi']) expect((await page.request.get(base+suffix)).status()).toBe(403);
    clean(state);
});

test('pending and failed config/VDI requests never open a partial editor',async({page,context})=>{
 const state=listen(page);await guard(context,state);await login(page,admin,state);await fixture(page,state);await open(page);
 let pending;
 await page.route('**/api/lmn/linbo4/config/start.conf.p84',route=>{pending=route;});
 await pane(page).locator('button:has(.fa-pencil)').click();await expect.poll(()=>Boolean(pending)).toBe(true);await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(0);
 await pending.fulfill({status:500,json:{message:'P84 config failure',exception:'EndpointError'}});
 await page.unroute('**/api/lmn/linbo4/config/start.conf.p84');
 pending=undefined;
 await page.route('**/api/lmn/linbo4/vdi/start.conf.p84.vdi',route=>{pending=route;});
 await pane(page).locator('button:has(.fa-pencil)').click();await expect.poll(()=>Boolean(pending)).toBe(true);await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(0);
 await pending.fulfill({status:500,json:{message:'P84 VDI failure',exception:'EndpointError'}});
 await page.evaluate(()=>new Promise(resolve=>angular.element(document).injector().get('$rootScope').$evalAsync(resolve)));
 await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(0);expect(state.blocked).toEqual([]);expect(state.errors.filter(e=>!/500 \(INTERNAL SERVER ERROR\)|500 \(Internal Server Error\)/i.test(e))).toEqual([]);
});

for(const role of allowed) test(`${role.name}: real synthetic config edit saved on E with SSH proof`,async({page,context})=>{
 const state=listen(page);await guard(context,state,true);await login(page,role,state);await open(page);
 const name=role.name==='global-admin'?'p84-real-global':'p84-real-school';
 await pane(page).getByText(/^(Create|Erstellen)$/,{exact:true}).click();await pane(page).getByText(/^(Empty|Leer)$/,{exact:true}).click();
 await page.locator('.messagebox input:visible').fill(name);await page.locator('.messagebox .positive:visible').last().click();
 const row=pane(page).locator('tr').filter({has:page.locator('b',{hasText:new RegExp('^'+name+'$')})});await expect(row).toBeVisible();await row.locator('button:has(.fa-pencil)').click();
 await model(page,'config.config.LINBO.RootTimeout').fill('  42  ');await click(page,'save()',/^(Save|Speichern)$/);
 await expect(page.locator('.modal:visible:not([aria-hidden="true"])')).toHaveCount(0);
 await expect.poll(()=>execFileSync('ssh',['-o','BatchMode=yes',process.env.P87_SSH_HOST ?? 'lmn-server-e',`grep '^RootTimeout' /srv/linbo/start.conf.${name} || true`],{encoding:'utf8'}).trim()).toMatch(/42/);
 const response=await page.request.get(base+'/config/start.conf.'+name), data=await response.json();expect(String(data.config.LINBO.RootTimeout)).toBe('42');clean(state);
});
