import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// The same DOM interactions run against the unmodified Angular plugin and Vue.
const admin = settings.roles.find((role) => role.name === 'global-admin');
const schoolAdmin = { name: 'school-admin', login: 'pgmadmin', pw: admin.pw };
const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
const response = (page, path, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === method);
const panel = (page) => page.locator('.tab-pane.active:visible').first();
const tab = (page, index) => page.locator('.nav-tabs > li > a').nth(index).click();
const save = (page) => page.locator('floating-toolbar :is(a,button):visible').filter({ hasText: /^(Save|Speichern)$/ }).click();
function listen(page, restarting = () => false) {
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.log('PAGEERROR', error.message); });
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        if (message.text().includes('401') && /\/api\/core\//.test(message.location().url)) return;
        if (restarting() && (/net::ERR_(CONNECTION_RESET|EMPTY_RESPONSE|SOCKET_NOT_CONNECTED|CONNECTION_REFUSED)/.test(message.text()) || message.text() === 'Socket has disconnected transport error')) return;
        errors.push(message.text());
        console.log('CONSOLEERROR', message.text());
    });
    return errors;
}
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
async function open(page, school = false) {
    const loaded = response(page, school ? '/api/lmn/schoolsettings' : '/api/core/config');
    await page.goto(`/view/lmn/${school ? 'schoolsettings' : 'globalsettings'}`);
    const result = await loaded;
    expect(result.status()).toBe(200);
    await expect(page.locator('.nav-tabs > li > a')).toHaveCount(school ? 7 : 8);
    return result.json();
}

for (const role of [admin, schoolAdmin]) {
    test(`${role.name}: Save & check and quota application open the existing plugin dialogs`, async ({ page }) => {
        test.setTimeout(180000);
        const errors = listen(page);
        await login(page, role);
        // E: users/lists/check returns JSON but never creates this obsolete log
        // (views/listmanagement.py:252); SSH proof: p79-log-capabilities.log.
        await page.route('**/api/lmn/log/tmp/sophomorix-check.log?*', route => route.fulfill({ body: 'P79 check log fixture\n' }));
        await open(page, true);
        for (const [index, path, method] of [[0, '/api/lmn/users/lists/check', 'GET'], [2, '/api/lmn/quota/apply', 'POST']]) {
            console.log('Foreign dialog', role.name, path);
            await tab(page, index);
            let release;
            const waiting = new Promise(resolve => { release = resolve; });
            await page.route(`**${path}`, async route => { await waiting; await route.continue(); });
            const saved = response(page, '/api/lmn/schoolsettings', 'POST');
            const applied = response(page, path, method);
            await page.locator('floating-toolbar').getByText(index === 0 ? /^(Save & check|Speichern.*prüfen)$/i : /^(Save & Apply Quota|Speichern.*Quota.*)$/i, { exact: true }).click();
            expect((await saved).status()).toBe(200);
            await expect(page.locator('.modal:visible')).toBeVisible();
            release();
            expect((await applied).status()).toBe(200);
            // A page reload closes the complete dialog chain without selecting Apply.
            await open(page, true);
        }
        expect(errors).toEqual([]);
    });

    test(`${role.name}: school tabs and real school.conf write with SSH proof`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role);
        const initial = await open(page, true);
        const value = `P79 ${role.name}`;
        await panel(page).locator('input[type=text]').first().fill(` ${value} `);
        const saved = response(page, '/api/lmn/schoolsettings', 'POST');
        await save(page);
        const result = await saved;
        expect(result.status()).toBe(200);
        expect(result.request().postDataJSON()).toEqual({ ...initial, school: { ...initial.school, SCHOOL_LONGNAME: value } });
        expect(ssh("python3 -c \"from configobj import ConfigObj; print(ConfigObj('/etc/linuxmuster/sophomorix/default-school/school.conf')['school']['SCHOOL_LONGNAME'])\"").trim()).toBe(value);
        for (let index = 1; index < 7; index += 1) {
            await tab(page, index);
            await expect(panel(page)).toBeVisible();
        }
        const passwordFields = panel(page).locator('input[type=number]').first();
        if (role.name === 'school-admin') await expect(passwordFields).toBeDisabled();
        else await expect(passwordFields).toBeEnabled();
        expect(errors).toEqual([]);
    });

    test(`${role.name}: password override writes only the permitted configuration`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role);
        const constraintsLoaded = response(page, '/api/lmn/config/passwordconstraints');
        await open(page, true);
        const constraints = await (await constraintsLoaded).json();
        if (role.name === 'school-admin') expect(Object.keys(constraints.schools).every((school) => school === 'default-school')).toBe(true);
        await tab(page, 6);
        const override = panel(page).locator('label.checkbox-inline:has(> span) > input[type=checkbox]');
        if (!(await override.isChecked())) await override.check();
        const schoolRules = panel(page).locator('table:visible').last();
        await schoolRules.locator('input[type=number]').first().fill('13');
        for (const checkbox of await schoolRules.locator('input[type=checkbox]').all()) await checkbox.uncheck();
        await schoolRules.locator('input[type=number]').last().fill('');
        if (role.name === 'global-admin') {
            const defaults = panel(page).locator('table:visible').first();
            await defaults.locator('input[type=number]').first().fill('12');
            for (const checkbox of await defaults.locator('input[type=checkbox]').all()) await checkbox.uncheck();
            await defaults.locator('input[type=number]').last().fill('');
        }
        const saved = response(page, '/api/lmn/config/passwordconstraints', 'POST');
        await save(page);
        const result = await saved;
        expect(result.status()).toBe(200);
        const body = result.request().postDataJSON();
        expect(body.config.schools['default-school'].student).toEqual([{ type: 'min_length', value: 13 }]);
        expect(Object.hasOwn(body.config, 'default')).toBe(role.name === 'global-admin');
        if (role.name === 'global-admin') {
            expect(body.config.default.student).toEqual([{ type: 'min_length', value: 12 }]);
            expect(ssh("python3 -c \"import yaml; c=yaml.safe_load(open('/etc/linuxmuster/tools/password_constraints.yml')); print(c['default']['student'][0]['value'])\"").trim()).toBe('12');
        }
        expect(ssh("python3 -c \"import yaml; c=yaml.safe_load(open('/etc/linuxmuster/tools/password_constraints.yml')); print(c['schools']['default-school']['student'][0]['value'])\"").trim()).toBe('13');
        expect(errors).toEqual([]);
    });
}

test('global-admin: global tabs, real config write and SMTP load', async ({ page }) => {
    const errors = listen(page);
    await login(page, admin);
    const initial = await open(page);
    const value = Number(initial.session_max_time) + 79;
    await panel(page).locator('input[type=number]').first().fill(String(value));
    const saved = response(page, '/api/core/config', 'POST');
    await save(page);
    const result = await saved;
    expect(result.status()).toBe(200);
    expect(result.request().postDataJSON()).toEqual({ ...initial, session_max_time: value });
    expect(ssh("python3 -c \"import yaml; print(yaml.safe_load(open('/etc/ajenti/config.yml'))['session_max_time'])\"").trim()).toBe(String(value));
    const smtpLoaded = response(page, '/api/core/smtp-config');
    await tab(page, 2);
    expect((await smtpLoaded).status()).toBe(200);
    for (const index of [1, 3, 4, 5, 6, 7]) {
        await tab(page, index);
        await expect(panel(page)).toBeVisible();
    }
    expect(errors).toEqual([]);
});

test('global-admin: real API key create, IP/scope edit, secret confirmation and deletion', async ({ page }) => {
    test.setTimeout(120000);
    const errors = listen(page);
    await login(page, admin);
    await open(page);
    const loaded = response(page, '/api/lmn/apisettings');
    await tab(page, 4);
    const initial = await (await loaded).json();
    expect(initial).not.toBeNull();
    await panel(page).locator('input[type=checkbox]').check();
    await panel(page).getByRole('button').filter({ hasText: /Add a key|Schlüssel hinzufügen/ }).click();
    const dialog = () => page.locator('.modal:visible').last();
    const dialogSave = () => dialog().getByText(/^(Save|Speichern)$/, { exact: true }).click();
    await dialog().locator('input[type=text]').first().fill(' p79-oracle-key ');
    const search = response(page, '/api/lmn/ldap-search', 'POST');
    await dialog().locator('input[type=text]').last().fill('zem');
    const users = await (await search).json();
    const user = users.find(candidate => candidate.login === 'zem');
    expect(user).toBeDefined();
    await page.getByRole('option').filter({ hasText: user.label }).click();
    await dialog().locator('a:has(.fa-plus)').first().click();
    await dialog().locator('input').fill(' 127.0.0.79 ');
    await dialogSave();
    await expect(page.locator('.modal:visible')).toHaveCount(1);
    await dialog().locator('a:has(.fa-plus)').nth(1).click();
    await dialog().locator('input').fill(' GET /p79/** ');
    await dialogSave();
    await expect(page.locator('.modal:visible')).toHaveCount(1);
    const created = response(page, '/api/lmn/apikeys', 'PUT');
    await dialogSave();
    const creation = await created;
    expect(creation.status()).toBe(200);
    expect(creation.request().postDataJSON()).toEqual({ key: { name: 'p79-oracle-key', ips: ['127.0.0.79'], user: 'zem', scope: ['GET /p79/**'] } });
    const secret = (await creation.json()).secret;
    // Empty host_keys is returned as [] by the original backend. A named array
    // property added by the controller is absent from ngRepeat until reloading.
    const refreshed = response(page, '/api/lmn/apisettings');
    await tab(page, 4);
    expect((await refreshed).status()).toBe(200);
    await panel(page).locator('input[type=checkbox]').check();
    const row = panel(page).locator('tr').filter({ hasText: 'p79-oracle-key' });
    await expect(row).toContainText('127.0.0.79');
    await row.getByRole('button').nth(1).click();
    await dialog().getByText(/^(Show|Zeigen|Anzeigen)$/, { exact: true }).click();
    await expect(dialog().locator('textarea')).toHaveValue(secret);
    await dialog().getByText(/^(Close|Schließen)$/, { exact: true }).click();
    await row.getByRole('button').first().click();
    const vueSettings = await page.locator('.c12-tabs').count();
    await dialog().locator(vueSettings ? '.c12-label.bg-info' : '.label-info').click();
    await dialog().locator(vueSettings ? '.c12-label.bg-warning' : '.label-warning').click();
    const updated = response(page, '/api/lmn/apikeys', 'POST');
    await dialogSave();
    const update = await updated;
    expect(update.status()).toBe(200);
    expect(update.request().postDataJSON()).toEqual({ config: { api_keys: { ...initial.keys, 'p79-oracle-key': { ips: [], scope: [], secret, user: 'zem' } }, enable_host_auth: true } });
    expect(ssh("python3 -c \"import yaml,json; k=yaml.safe_load(open('/etc/linuxmuster/api/config.yml'))['host_keys']['p79-oracle-key']; print(json.dumps({'user':k['user'],'ips':k.get('ips',[]),'scope':k.get('scope',[])}))\"").trim()).toBe('{"user": "zem", "ips": [], "scope": []}');
    await row.getByRole('button').last().click();
    const deleted = response(page, '/api/lmn/apikeys/p79-oracle-key', 'DELETE');
    await dialog().getByText(/^(Delete|Löschen)$/, { exact: true }).click();
    expect((await deleted).status()).toBe(200);
    await expect(row).toHaveCount(0);
    expect(ssh("python3 -c \"import yaml; print('p79-oracle-key' in yaml.safe_load(open('/etc/linuxmuster/api/config.yml'))['host_keys'])\"").trim()).toBe('False');
    expect(errors).toEqual([]);
});

test('global-admin: missing TFA enrollment uses identical display/delete fixture', async ({ page }) => {
    const errors = listen(page);
    await login(page, admin);
    expect(await (await page.request.get('/api/core/tfa-config')).json()).toEqual({});
    await page.route('**/api/core/tfa-config', route => route.fulfill({ json: route.request().method() === 'GET' ? { 'p79@ldap': { totp: [{ created: 1700000000, description: 'P79 device' }] } } : null }));
    await open(page);
    const loaded = response(page, '/api/core/tfa-config');
    await tab(page, 5); await loaded;
    const expected = await page.evaluate(() => window.angular.element(document.documentElement).injector().get('$filter')('date')(1700000000000, 'dd MMMM yyyy HH:mm:ss'));
    console.log('TFA date reference', expected);
    const row = panel(page).locator('tr').filter({ hasText: 'P79 device' });
    await expect(row).toContainText(expected);
    const deleted = response(page, '/api/core/tfa-config', 'POST');
    await row.locator('.btn').click();
    expect((await deleted).request().postDataJSON()).toEqual({ type: 'delete', userid: 'p79@ldap', timestamp: '1700000000' });
    await expect(row).toHaveCount(0);
    expect(errors).toEqual([]);
});

for (const role of [settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: settings links hidden and endpoints denied`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role);
        await expect(page.locator('a[href="/view/lmn/schoolsettings"]:visible')).toHaveCount(0);
        await expect(page.locator('a[href="/view/lmn/globalsettings"]:visible')).toHaveCount(0);
        for (const path of ['/api/lmn/schoolsettings', '/api/lmn/subnets', '/api/lmn/config/passwordconstraints']) {
            expect((await page.request.get(path)).status()).toBe(403);
        }
        expect(errors).toEqual([]);
    });
}

test('school-admin: global route hidden and global password defaults denied', async ({ page }) => {
    const errors = listen(page);
    await login(page, schoolAdmin);
    await expect(page.locator('a[href="/view/lmn/globalsettings"]:visible')).toHaveCount(0);
    const current = await page.request.get('/api/lmn/config/passwordconstraints');
    expect(current.status()).toBe(200);
    const config = await current.json();
    const attempt = { ...config, default: { ...config.default, student: [{ type: 'min_length', value: 79 }] } };
    expect((await page.request.post('/api/lmn/config/passwordconstraints', { data: { config: attempt } })).status()).toBe(403);
    expect(errors).toEqual([]);
});

test('global-admin: confirmed WebUI restart reaches the real Core endpoint', async ({ page }) => {
    test.setTimeout(90000);
    let restarting = false;
    const errors = listen(page, () => restarting);
    await login(page, admin);
    await open(page);
    await page.locator('floating-toolbar :is(a,button):visible').filter({ hasText: /^(Restart WebUI|Schulkonsole neu starten)$/ }).click();
    await expect(page.locator('.modal:visible')).toBeVisible();
    const restarted = response(page, '/api/core/restart-master', 'POST');
    const reloaded = page.waitForEvent('load');
    restarting = true;
    await page.locator('.modal:visible').getByText(/^(Yes|Ja)$/, { exact: true }).click();
    expect((await restarted).status()).toBe(200);
    await reloaded;
    await expect.poll(() => ssh('systemctl is-active linuxmuster-webui').trim(), { timeout: 60000 }).toBe('active');
    expect(errors).toEqual([]);
});
