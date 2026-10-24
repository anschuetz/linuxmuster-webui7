import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';

const configs = () => [{file:'start.conf.p85',images:[],settings:{}}];
test.setTimeout(90_000);
const admin = settings.roles.find(r => r.name === 'global-admin');
const allowed = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }];
const denied = [settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const base = '/api/lmn/linbo4', path = '/view/lmn/linbo4';
const fullRoute = process.env.P87_FULL_ROUTE === '1' || Boolean(process.env.P87_UI);
const vue = (process.env.P87_UI ?? process.env.P85_UI) === 'vue';
const viewPath = vue && !fullRoute ? '/view/lmn/landingpage' : path;
const pane = page => vue && !fullRoute ? page.locator('#p85-mount') : fullRoute && vue ? page.locator('lmn-vue-mount') : page.locator('.tab-pane.active');
const box = page => page.locator('.messagebox:visible').last();
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
async function fixture(page, context, state) {
    await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (req.method() === 'GET' && url.pathname === '/api/lmn/log/tmp/import_devices.log') {
            state.offsets.push(Number(url.searchParams.get('offset')));
            return route.fulfill({ json: state.offsets.length === 1 ? 'ä log\n' : '' });
        }
        if (req.method() === 'GET' && url.pathname.startsWith(base)) {
            if(url.pathname === base+'/configs') await page.waitForFunction(() => window.angular?.element(document).injector()?.get('identity').profile?.activeSchool);
            const data = url.pathname === base+'/configs' ? configs() : [];
            return route.fulfill({ json: data });
        }
        if (req.method() === 'POST' && url.pathname === base+'/config/start.conf.p85-copy') {
            state.writes.push([req.method(), url.pathname, req.postDataJSON()]);
            return route.fulfill({ json: null });
        }
        if (req.method() === 'POST' && url.pathname === '/api/lmn/devices/import') {
            state.imports.push([req.method(), url.pathname, req.postData()]);
            return new Promise(resolve => {
                state.finish = async (status=200) => {
                    await route.fulfill({ status, json: status === 200 ? null : { message: 'P85 fixture failure', exception: 'EndpointError' } });
                    resolve();
                };
            });
        }
        if ((state.authenticated && !['GET','HEAD','OPTIONS'].includes(req.method())) || url.pathname === base+'/restart-services') {
            state.blocked.push([req.method(), url.pathname]); return route.abort('blockedbyclient');
        }
        return route.continue();
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
        node.id = 'p85-mount';
        const original = document.querySelector('[ng\\:view]');
        const oldScope = injector.get('$route').current.scope;
        original.style.display = 'none'; original.parentElement.append(node);
        const scope = oldScope.$new();
        scope.$on('$destroy', () => node.remove());
        window.p85scope = scope;
        const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
        LmnVueBridge.mountBridge(scope, node, LmnVue_lmn_linbo4, Object.fromEntries(names.map(name => [name, injector.get(name)])));
    });
}

const dialog = page => page.locator('.modal:visible:not([aria-hidden="true"])').last();
const model = (page, name) => dialog(page).locator(`[ng\\:model="${name}"], [data-model="${name}"]`);
const click = (page, expression, translated) => vue ? dialog(page).getByText(translated,{exact:true}).last().click() : dialog(page).locator(`[ng\\:click="${expression}"]`).click();
async function dirty(page) {
    await pane(page).getByText(/^(Create|Erstellen)$/,{exact:true}).click();
    await pane(page).getByText(/^(Empty|Leer)$/,{exact:true}).click();
    await box(page).locator('input').fill('p85-copy');
    await box(page).locator('.positive').click();
    await expect(pane(page).getByText(/^(Import devices|Gerät importieren)$/)).toBeVisible();
}
async function start(page,context,role) {
    const state=listen(page); await fixture(page,context,state); await login(page,role,state); await open(page); await dirty(page);
    await pane(page).getByText(/^(Import devices|Gerät importieren)$/).click();
    await expect.poll(()=>state.imports.length).toBe(1);
    expect(state.imports).toEqual([['POST','/api/lmn/devices/import',null]]);
    return state;
}
const log = page => dialog(page).locator('pre');
const details = page => dialog(page).locator('a:visible').filter({hasText:/^(Details|Hide details|Details ausblenden)$/});
const close = page => dialog(page).getByText(/^(Close|Schließen)$/,{exact:true});
function clean(state) { expect(state.blocked).toEqual([]); expect(state.errors).toEqual([]); }
for (const role of allowed) {
    test(`${role.name}: pending, hidden log offsets, success, close reload and timer cleanup`, async({page,context})=>{
        const state=await start(page,context,role);
        await expect(close(page)).toBeHidden();
        await expect(log(page)).toBeVisible();
        await expect.poll(()=>state.offsets.length).toBeGreaterThanOrEqual(1);
        await expect(log(page)).toHaveText('ä log');
        await details(page).click(); await expect(log(page)).toBeHidden();
        await expect.poll(()=>state.offsets.length).toBeGreaterThanOrEqual(2);
        expect(state.offsets.slice(0,2)).toEqual([0,6]);
        // Static backdrop must not close a running import.
        await dialog(page).click({position:{x:1,y:1}}); await expect(dialog(page)).toBeVisible();
        await state.finish(); await expect(close(page)).toBeVisible();
        await expect(page.locator('.toast-success')).toContainText(/Import complete|Import abgeschlossen/);
        const count=state.offsets.length; await expect.poll(()=>state.offsets.length).toBeGreaterThan(count);
        await details(page).click(); await expect(log(page)).toBeVisible();
        await close(page).click(); await expect(page.locator('.modal:visible')).toHaveCount(0);
        await expect(pane(page).getByText(/^(Import devices|Gerät importieren)$/)).toBeHidden();
        const stopped=state.offsets.length; await page.waitForTimeout(1200); expect(state.offsets.length).toBe(stopped); clean(state);
    });
    for(const hidden of [false,true]) test(`${role.name}: error toggles ${hidden?'hidden':'visible'} log and keeps early clean state`,async({page,context})=>{
        const state=await start(page,context,role);
        if(hidden) await details(page).click();
        await state.finish(500); await expect(close(page)).toBeVisible();
        await expect(page.locator('.toast-error').filter({hasText:/Import failed|Import fehlgeschlagen/})).toContainText('P85 fixture failure');
        if(hidden) await expect(log(page)).toBeVisible(); else await expect(log(page)).toBeHidden();
        // Escape dismisses without close/reload; early config_change=false stays inherited.
        await page.keyboard.press('Escape'); await expect(page.locator('.modal:visible')).toHaveCount(0);
        await expect(pane(page).getByText(/^(Import devices|Gerät importieren)$/)).toBeHidden();
        state.errors=state.errors.filter(e=>!/500 \(Internal Server Error\)/i.test(e)); clean(state);
    });
    test(`${role.name}: dirty navigation cancels, import opening clears early even after Escape`,async({page,context})=>{
        const state=listen(page); await fixture(page,context,state); await login(page,role,state); await open(page); await dirty(page);
        const nav=()=>page.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/links'));});
        page.once('dialog',d=>d.dismiss()); await nav(); await expect(pane(page)).toBeVisible();
        await pane(page).getByText(/^(Import devices|Gerät importieren)$/).click(); await expect.poll(()=>state.imports.length).toBe(1);
        await expect.poll(()=>state.offsets.length).toBeGreaterThanOrEqual(1);
        let prompts=0; page.on('dialog',d=>{prompts++;d.accept();});
        await page.keyboard.press('Escape'); await expect(page.locator('.modal:visible')).toHaveCount(0);
        await nav(); await expect(page).toHaveURL(/\/view\/lmn\/links/); expect(prompts).toBe(0);
        const count=state.offsets.length; await state.finish(); await page.waitForTimeout(1200);expect(state.offsets.length).toBe(count);clean(state);
    });
}
for(const role of denied) test(`${role.name}: sidebar absent and direct LINBO data denied`,async({page})=>{
    const state=listen(page);await login(page,role,state);
    await expect(page.locator('a[href^="/view/lmn/linbo4"]')).toHaveCount(0);
    for(const suffix of ['/configs','/images','/config/start.conf.p85']) {
        const response=await page.request.get(base+suffix);expect(response.status()).toBe(403);
    }
    clean(state);
});
