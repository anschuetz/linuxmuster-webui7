import { test, expect as baseExpect } from '@playwright/test';
import { settings } from './playwright.config.mjs';
const expect = baseExpect.configure({ timeout: 15000 });
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'wait' }); });
const modes = ['angular', 'vue'];
const roles = [settings.roles[0], { name: 'school-admin', login: process.env.E2E_SCHOOL_LOGIN, pw: process.env.E2E_SCHOOL_PASSWORD }, settings.roles[1], { name: 'student', login: process.env.E2E_STUDENT_LOGIN, pw: process.env.E2E_STUDENT_PASSWORD }];
const username = (p, mode) => p.locator(mode === 'vue' ? 'input[name=username]' : 'input[ng\\:model=username]');
const password = (p, mode) => p.locator(mode === 'vue' ? 'input[name=password]' : 'input[type=password][ng\\:model=password]');
async function login(p, mode, role) {
    await username(p, mode).fill(role.login); await password(p, mode).fill(role.pw);
    await p.locator(mode === 'vue' ? 'button[type=submit]' : 'a[ng\\:click="login()"]:visible').click();
}
for (const mode of modes) for (const role of roles) test(`${mode} real session ${role.name}`, async ({ page }) => {
    test.setTimeout(60000);
    const errors = [], scripts = [], updates = [];
    page.on('response', r => { if (new URL(r.url()).pathname === '/api/core/tasks/request-update') updates.push(r.status()); });
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.resourceType() === 'script') scripts.push(new URL(request.url()).pathname); });
    await page.goto(`/view/login/normal?shell=${mode}`);
    await login(page, mode, role);
    await expect(page).toHaveURL(/\/view\/lmn\/landingpage/);
    await expect(page.locator('.profile-button:visible')).toHaveCount(1);
    await page.reload(); await expect(page.locator('.profile-button:visible')).toHaveCount(1);
    if (mode === 'vue') {
        await expect.poll(() => updates.includes(200)).toBe(true);
        expect(await page.evaluate(() => typeof window.angular)).toBe('undefined');
        expect(scripts.filter(s => /\/all\.(vendor|init|partials)?\.?js$/.test(s))).toEqual([]);
        expect(await page.evaluate(() => typeof window.Flow)).toBe('function');
        expect(await page.evaluate(() => typeof window.ace?.edit)).toBe('function');
    }
    await page.locator('.profile-button:visible').click();
    await page.locator(mode === 'vue' ? 'a.logout:visible' : 'a[ng\\:click="identity.logout()"]:visible').click();
    await expect(username(page, mode)).toBeVisible();
    expect(errors).toEqual([]);
});

import { shellFixtures, go, fixturePlugin } from './shell-fixtures.mjs';
for (const mode of modes) for (const role of roles) test(`${mode} same auth and stock fixtures ${role.name}`, async ({ page }) => {
    test.setTimeout(90000);
    const s = await shellFixtures(page, role);
    await page.goto(`/view/login/normal?shell=${mode}`); await login(page, mode, role);
    const code = page.locator(mode === 'vue' ? 'input[name=code]' : 'input[ng\\:model=code]');
    await expect(code).toBeVisible();
    for (let i = 0; i < 3; i++) { await code.fill('654321'); await expect.poll(() => s.attempts).toBe(i + 1); }
    await expect(code).not.toBeVisible();
    await login(page, mode, role); await code.fill('123456');
    await expect(page).toHaveURL(/\/view\/lmn\/landingpage/);
    await go(page, '/view/dashboard'); await expect(page.locator('body')).toContainText('Fixture tab');
    await go(page, '/view/session_list');
    if (['global-admin', 'school-admin'].includes(role.name)) await expect.poll(() => s.requests.some(([m,p]) => p === '/api/session_list/sessions')).toBe(true);
    else await expect(page.locator('body')).toContainText('Superuser access required');
    await go(page, '/view/plugins');
    await expect(page.locator('body')).toContainText(['global-admin', 'school-admin'].includes(role.name) ? 'Installed' : 'Superuser access required');
    await go(page, '/view/settings');
    await expect(page.locator('body')).toContainText(['global-admin', 'school-admin'].includes(role.name) ? 'General' : 'Superuser access required');
    await go(page, '/view/totp'); await expect(page.locator('body')).toContainText('There is currently no TOTP key for this user.');
    await go(page, '/view/lmn/change-school'); await page.locator('.school-item, li.list-group-item').filter({ hasText: 'Other fixture school' }).click();
    await expect.poll(() => s.school).toBe('school-b'); await expect(page.locator('body')).toContainText('school-b');
    await fixturePlugin(page); await go(page, '/view/lmn/links'); await expect(page.locator('body')).toContainText('Route fixture');
    await page.evaluate(() => { window.__p112.dirty = true; }); await go(page, '/view/dashboard');
    await expect(page).toHaveURL(/\/view\/lmn\/links/);
    await page.evaluate(() => { window.__p112.dirty = false; });
    await page.locator('.fixture-modal').click(); await go(page, '/view/dashboard');
    await expect(page.locator('.modal-backdrop')).toHaveCount(0);
    const stopped = await page.evaluate(() => window.__p112.stops); expect(stopped).toBe(1);
    const ticks = await page.evaluate(() => window.__p112.ticks);
    await expect.poll(() => page.evaluate(() => window.__p112.ticks)).toBe(ticks);
    await page.goBack(); await expect(page.locator('body')).toContainText('Route fixture');
    await page.goForward(); await expect(page.locator('body')).toContainText('Fixture tab');
    await page.reload(); await expect(page.locator('body')).toContainText('Fixture tab');
    await go(page, '/view/not-a-route'); await expect(page.locator('body')).toContainText('Page not found');
    await fixturePlugin(page); await go(page, '/view/lmn/links'); await expect(page.locator('body')).toContainText('Route fixture');
    if (mode === 'vue') await page.evaluate(() => { window.__p112.dirty = true; });
    await page.evaluate(async () => { await Promise.allSettled([window.__p112.aj.http.get('/api/p112/expired'), window.__p112.aj.http.get('/api/p112/expired')]); });
    await expect(username(page, mode)).toBeVisible();
    expect(s.unexpected ?? []).toEqual([]);
});

for (const mode of modes) test(`${mode} prefixed deep links, fragments, reload and History`, async ({ page }) => {
    test.setTimeout(90000);
    const prefix = '/panel', role = roles[0];
    const s = await shellFixtures(page, role, { authenticated: true, prefix });
    await page.goto(`${prefix}/view/dashboard?shell=${mode}`); await expect(page.locator('body')).toContainText('Fixture tab');
    await fixturePlugin(page); await go(page, `${prefix}/view/lmn/links?filter=one#first`);
    await expect(page.locator('body')).toContainText('Route fixture');
    const before = await page.evaluate(() => window.__p112.mounts);
    await page.evaluate(() => { window.__p112.aj.reload(); });
    await expect.poll(() => page.evaluate(() => window.__p112.mounts)).toBe(before + 1);
    await page.evaluate(() => { window.location.hash = 'second'; });
    await expect(page).toHaveURL(/\/panel\/view\/lmn\/links\?filter=one#second/);
    await go(page, `${prefix}/view/dashboard`); await expect(page.locator('body')).toContainText('Fixture tab');
    await page.goBack(); await expect(page.locator('body')).toContainText('Route fixture');
    await page.goForward(); await expect(page.locator('body')).toContainText('Fixture tab');
    await page.reload(); await expect(page.locator('body')).toContainText('Fixture tab');
    await go(page, `${prefix}/view/ui-test`); await expect(page.locator('body')).toContainText('Index');
    await go(page, `${prefix}/view/reset_password/expired`); await expect(page.locator('body')).toContainText('The used link is not valid or expired.');
    expect(s.unexpected ?? []).toEqual([]);
});

for (const mode of modes) test(`${mode} sudo changes an authenticated identity and returns to LM home (fixture)`, async ({ page }) => {
    const s = await shellFixtures(page, roles[2], { authenticated: true });
    await page.goto(`/view/login/sudo:fixture-other/ignored/next?shell=${mode}`);
    await password(page, mode).fill('fixture');
    await page.locator(mode === 'vue' ? 'button[type=submit]' : 'a[ng\\:click="login()"]:visible').click();
    await expect(page).toHaveURL(/\/view\/lmn\/landingpage/);
    expect(s.sudo).toBe(true); expect(s.user).toBe('fixture-other');
    expect(s.unexpected ?? []).toEqual([]);
});

test('the entry defaults to Vue after the green parity oracle without a query selection', async ({ page }) => {
    await shellFixtures(page, roles[0]);
    await page.goto('/view/login/normal');
    await expect(username(page, 'vue')).toBeVisible();
    expect(await page.evaluate(() => typeof window.angular)).toBe('undefined');
});

test('Vue mounts Device Manager using its dotted bootstrap ID and the common resource alias', async ({ page }) => {
    const s = await shellFixtures(page, roles[0], { authenticated: true });
    const calls = [];
    await page.route('**/api/lmn/device-manager/*', route => {
        calls.push(new URL(route.request().url()).pathname);
        return route.fulfill({ json: [] });
    });
    await page.goto('/view/lmn/device-manager?shell=vue');
    await expect(page.locator('body')).toContainText('This plugin is deprecated');
    await expect.poll(() => calls.some(path => path.endsWith('/getdevices'))).toBe(true);
    expect(await page.evaluate(() => typeof window.LmnVue_lmn_device_manager.mount)).toBe('function');
    expect(s.unexpected ?? []).toEqual([]);
});

for (const mode of modes) test(`${mode} wizard preserves config saved in stock settings (fixture)`, async ({ page }) => {
    const s = await shellFixtures(page, roles[0], { authenticated: true });
    await page.goto(`/view/settings?shell=${mode}`);
    await page.locator(mode === 'vue' ? 'input[aria-label="Machine name"]' : 'input[ng\\:model="config.data.name"]').fill('saved in settings');
    await page.locator(mode === 'vue' ? 'button[data-action=save]' : 'a[ng\\:click="save()"]:visible').click();
    await expect.poll(() => s.coreWrites.length).toBe(1);
    expect(s.coreWrites[0].name).toBe('saved in settings');
    await go(page, '/view/lmn/init/welcome');
    await page.getByText('I accept the license terms', { exact: false }).locator('input[type=checkbox]').check();
    await page.locator('.modal-footer a').filter({ hasText: /^Next$/ }).click();
    await expect.poll(() => s.coreWrites.length).toBe(2);
    expect(s.coreWrites[1]).toMatchObject({ name: 'saved in settings', auth: { provider: 'fixture' }, ssl: { certificate: '/tmp/fixture.pem' }, trusted_proxies: ['192.0.2.1'] });
    expect(s.unexpected ?? []).toEqual([]);
});
