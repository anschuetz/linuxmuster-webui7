import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';
import { configs, images, config, examples } from './fixtures/linbo4.mjs';
test.setTimeout(90_000);
const admin = settings.roles.find(r => r.name === 'global-admin');
const allowed = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }];
const denied = [settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const base = '/api/lmn/linbo4', path = '/view/lmn/linbo4';
const fullRoute = process.env.P87_FULL_ROUTE === '1' || Boolean(process.env.P87_UI);
const vue = (process.env.P87_UI ?? process.env.P83_UI) === 'vue';
const viewPath = vue && !fullRoute ? '/view/lmn/landingpage' : path;
const pane = page => vue && !fullRoute ? page.locator('#p83-mount') : fullRoute && vue ? page.locator('lmn-vue-mount') : page.locator('.tab-pane.active');
const box = page => page.locator('.messagebox:visible').last();
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', process.env.P87_SSH_HOST ?? 'lmn-server-e', command], { encoding: 'utf8' }).trim();
async function login(page, role, state) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    state.authenticated = true;
}
function listen(page) {
    const state = { errors: [], blocked: [], writes: [], authenticated: false };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text() + ' [' + m.location().url + ']'); });
    return state;
}
async function guard(context, state, real = false) {
    await context.route('**/api/**', async route => {
        const req = route.request(), url = new URL(req.url()).pathname;
        if ((fullRoute && state.authenticated && !['GET', 'HEAD', 'OPTIONS'].includes(req.method())) || (!['GET', 'HEAD', 'OPTIONS'].includes(req.method()) && (url.startsWith(base) || url === '/api/lmn/devices/import')) || url === base + '/restart-services') {
            if (real && /^\/api\/lmn\/linbo4\/config\/start\.conf\.p83-(empty|example|copy)$/.test(url) && ['POST', 'DELETE'].includes(req.method())) return route.continue();
            state.blocked.push([req.method(), url]); return route.abort('blockedbyclient');
        }
        return route.continue();
    });
}
async function fixture(page, state) {
    await page.route('**/api/core/identity', async route => {
        const response = await route.fetch(), data = await response.json();
        data.identity.profile = { ...data.identity.profile, activeSchool: 'p83-school' };
        await route.fulfill({ response, json: data });
    });
    await page.route('**/api/lmn/activeschool', route => route.fulfill({ json: 'p83-school' }));
    await page.route('**/api/lmn/linbo4/**', async route => {
        const req = route.request(), url = new URL(req.url()).pathname;
        if (req.method() !== 'GET') {
            if (!['POST', 'DELETE'].includes(req.method()) || !/^\/api\/lmn\/linbo4\/config\/start\.conf\.(p83-empty|p83-example|p83-copy|alpha)$/.test(url)) return route.fallback();
            state.writes.push([req.method(), url, req.postData() ? req.postDataJSON() : null]);
            return route.fulfill({ json: null });
        }
        if (url === base + '/configs') {
            // Original controller requires identity.profile before its fast config response.
            await page.waitForFunction(() => window.angular?.element(document).injector()?.get('identity').profile?.activeSchool === 'p83-school');
            return route.fulfill({ json: configs() });
        }
        if (url === base + '/images') return route.fulfill({ json: images() });
        if (url === base + '/examples/config') return route.fulfill({ json: examples });
        if (url.startsWith(base + '/config/')) return route.fulfill({ json: config() });
        return route.fallback();
    });
    await page.route('**/api/lmn/read-config-setup', route => route.fulfill({ json: { setup: { serverip: '192.0.2.83' } } }));
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
        node.id = 'p83-mount';
        const original = document.querySelector('[ng\\:view]');
        const oldScope = injector.get('$route').current.scope;
        original.style.display = 'none'; original.parentElement.append(node);
        const scope = oldScope.$new();
        scope.$on('$destroy', () => node.remove());
        window.p83scope = scope;
        const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
        LmnVueBridge.mountBridge(scope, node, LmnVue_lmn_linbo4, Object.fromEntries(names.map(name => [name, injector.get(name)])));
    });
}
async function prompt(page, value, cancel = false) {
    const input = page.locator('.messagebox input:visible');
    await expect(input).toBeVisible(); await input.fill(value);
    await page.locator(cancel ? '.messagebox .negative:visible' : '.messagebox .positive:visible').last().click();
}
async function create(page, example, name, cancel = false) {
    await pane(page).getByText(/^(Create|Erstellen)$/, { exact: true }).click();
    await pane(page).getByText(example ?? /^(Empty|Leer)$/, { exact: true }).click();
    await prompt(page, name, cancel);
}
function clean(state) { expect(state.blocked).toEqual([]); expect(state.errors).toEqual([]); }
for (const role of allowed) {
    test(`${role.name}: permissions, school filter, file order, hash and image linkage`, async ({ page, context }) => {
        const state = listen(page); await guard(context, state); await login(page, role, state);
        await expect(page.locator(`a[href^="${path}"]`).first()).toBeVisible();
        for (const suffix of ['/configs', '/images', '/examples/config']) expect((await page.request.get(base + suffix)).status()).toBe(200);
        await fixture(page, state); await open(page);
        await expect(pane(page).locator('tr td:first-child b')).toHaveText(['alpha', 'local', 'zulu']);
        await expect(pane(page)).toContainText('legacy.cloop');
        await open(page, '#images');
        await expect((vue ? pane(page) : page).locator('.nav-tabs li.active')).toContainText(/Images|Abbilder/);
        if (!vue) await expect(pane(page)).toContainText('zulu');
        clean(state);
    });
    test(`${role.name}: empty/template/copy payloads, invalid/duplicate names, cancel, delete, leave guard`, async ({ page, context }) => {
        const state = listen(page); await guard(context, state); await login(page, role, state); await fixture(page, state); await open(page);
        await create(page, null, 'p83-cancel', true); expect(state.writes).toEqual([]);
        await create(page, null, 'bad/name'); await expect(page.locator('.toast-title').last()).toContainText(/alphanumeric|alphanumer/i); expect(state.writes).toEqual([]);
        await create(page, null, 'alpha'); await expect(page.locator('.toast-title').last()).toContainText(/existiert|already exists/); expect(state.writes).toEqual([]);
        await create(page, null, '  p83-empty  ');
        await expect(pane(page).locator('tr td:first-child b')).toContainText(['alpha', 'local', 'p83-empty', 'zulu']);
        await create(page, examples[0], 'p83-example');
        const row = pane(page).locator('tr').filter({ has: page.locator('b', { hasText: /^alpha$/ }) });
        await row.locator('button:has(.fa-copy)').click(); await prompt(page, 'p83-copy');
        await expect.poll(() => state.writes.length).toBe(3);
        expect(state.writes).toEqual([
            ['POST', base + '/config/start.conf.p83-empty', { config: { LINBO: { Group: 'p83-empty' } }, os: [], partitions: [] }],
            ['POST', base + '/config/start.conf.p83-example', { ...config(), config: { LINBO: { ...config().config.LINBO, Group: 'p83-example', Server: '192.0.2.83' } } }],
            ['POST', base + '/config/start.conf.p83-copy', { ...config(), config: { LINBO: { ...config().config.LINBO, Group: 'p83-copy' } } }],
        ]);
        await row.locator('button:has(.fa-trash-o)').click();
        await expect(page.locator('.messagebox:visible')).toContainText('/srv/linbo/boot/grub');
        await page.locator('.messagebox .negative:visible').last().click(); expect(state.writes.length).toBe(3);
        await row.locator('button:has(.fa-trash-o)').click(); await page.locator('.messagebox .positive:visible').last().click();
        await expect.poll(() => state.writes.length).toBe(4); expect(state.writes[3]).toEqual(['DELETE', base + '/config/start.conf.alpha', null]);
        const leave = async accept => {
            const handled = new Promise(resolve => page.once('dialog', async dialog => {
                if (accept) await dialog.accept(); else await dialog.dismiss();
                resolve();
            }));
            await page.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path('/view/lmn/links')); });
            await handled;
        };
        await leave(false); await expect(page).toHaveURL(new RegExp(viewPath + '$'));
        await leave(true);
        await expect(page).toHaveURL(/\/view\/lmn\/links$/);
        if (vue) await expect(page.locator('#p83-mount')).toHaveCount(0);
        clean(state);
    });
    test(`${role.name}: real synthetic config create, template, copy, delete and GRUB side effect`, async ({ page, context }) => {
        const state = listen(page); await guard(context, state, true); await login(page, role, state); await open(page);
        await create(page, null, 'p83-empty');
        await expect(pane(page)).toContainText('p83-empty');
        expect(ssh("test -f /srv/linbo/start.conf.p83-empty && grep -E '^Group' /srv/linbo/start.conf.p83-empty")).toMatch(/p83-empty/);
        const examplesResponse = await page.request.get(base + '/examples/config'); const names = await examplesResponse.json();
        expect(names.length).toBeGreaterThan(0);
        await create(page, names[0], 'p83-example'); await expect(pane(page)).toContainText('p83-example');
        expect(ssh("grep -E '^(Group|Server)' /srv/linbo/start.conf.p83-example")).toContain('p83-example');
        const row = pane(page).locator('tr').filter({ has: page.locator('b', { hasText: /^p83-example$/ }) });
        await row.locator('button:has(.fa-copy)').click(); await prompt(page, 'p83-copy'); await expect(pane(page)).toContainText('p83-copy');
        expect(ssh("grep -E '^Group' /srv/linbo/start.conf.p83-copy")).toContain('p83-copy');
        ssh("printf 'P83 synthetic grub fixture\\n' > /srv/linbo/boot/grub/p83-copy.cfg");
        for (const name of ['copy', 'empty', 'example']) {
            const target = pane(page).locator('tr').filter({ has: page.locator('b', { hasText: new RegExp('^p83-' + name + '$') }) });
            await target.locator('button:has(.fa-trash-o)').click(); await page.locator('.messagebox .positive:visible').last().click();
            await expect(target).toHaveCount(0);
        }
        expect(ssh('for f in /srv/linbo/start.conf.p83-empty /srv/linbo/start.conf.p83-example /srv/linbo/start.conf.p83-copy /srv/linbo/boot/grub/p83-copy.cfg; do test ! -e "$f" || exit 1; done; echo removed')).toBe('removed');
        clean(state);
    });
}
for (const role of denied) test(`${role.name}: sidebar absent, lists and direct dialog data forbidden`, async ({ page, context }) => {
    const state = listen(page); await guard(context, state); await login(page, role, state);
    await expect(page.locator(`a[href^="${path}"]`)).toHaveCount(0);
    for (const suffix of ['/configs', '/images', '/examples/config', '/config/start.conf.p83-empty', '/vdi/p83-empty.vdi']) expect((await page.request.get(base + suffix)).status()).toBe(403);
    clean(state);
});
test('loading and rejected config list never show an empty list', async ({ page, context }) => {
    const state = listen(page); await guard(context, state); await login(page, admin, state);
    let pending;
    await page.route('**/api/lmn/linbo4/configs', route => { pending = route; });
    await open(page); await expect.poll(() => Boolean(pending)).toBe(true);
    await expect(pane(page).locator('table')).toBeHidden();
    const failed = page.waitForResponse(response => new URL(response.url()).pathname === base + '/configs' && response.status() === 500);
    await pending.fulfill({ status: 500, json: { message: 'P83 list rejected', exception: 'EndpointError' } });
    await failed;
    await page.evaluate(() => new Promise(resolve => angular.element(document).injector().get('$rootScope').$evalAsync(resolve)));
    // Core intentionally leaves EndpointError silent; the original controller adds no error UI.
    await expect(page.locator('.toast-title:visible')).toHaveCount(0);
    await expect(pane(page).locator('table')).toBeHidden();
    expect(state.blocked).toEqual([]);
    expect(state.errors.filter(e => !/500 \(INTERNAL SERVER ERROR\)|500 \(Internal Server Error\)/i.test(e))).toEqual([]);
});
