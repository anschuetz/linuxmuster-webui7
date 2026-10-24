import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAX+XDSwAAAABJRU5ErkJggg==';
const admin = settings.roles.find((r) => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
const response = (page, path, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === method);
const dialog = (page) => page.locator('.modal:visible').last();
const message = (page) => page.locator('dialog.messagebox:visible').last();
const close = (page) => dialog(page).getByText(/^(Close|Schließen)$/, { exact: true }).click();
function listen(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (m.text().includes('401') && /\/api\/core\//.test(m.location().url)) return;
        errors.push(m.text());
    });
    return errors;
}
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    const authenticated = response(page, '/api/core/auth', 'POST');
    await page.locator('a[ng\\:click^="login"]').click();
    expect((await authenticated).status()).toBe(200);
    await page.waitForURL('**/view/**');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h2:visible').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
async function open(page, role) {
    const fields = response(page, `/api/lmn/users/${role.login}/customfields`).then(async (r) => ({ status: r.status(), data: await r.json() }));
    const quota = response(page, `/api/lmn/quota/user/${role.login}`);
    await page.goto('/view/lmn/landingpage');
    const fieldResponse = await fields;
    expect(fieldResponse.status).toBe(200);
    expect((await quota).status()).toBe(200);
    await expect(page.locator('.info-cards')).toBeVisible();
    return fieldResponse.data;
}
const fields = () => [
    { attr: 'sophomorixCustom1', title: 'P43 Einzel', value: 'Vorher', editable: true },
    { attr: 'sophomorixCustomMulti1', title: 'P43 Mehrfach', value: ['eins'], editable: true },
    { attr: 'proxyAddresses', title: 'P43 Adressen', value: ['smtp:p43@example.invalid'], editable: true },
    { attr: 'sophomorixCustom2', title: 'P43 Gesperrt', value: 'Nur lesen', editable: false },
];
for (const role of roles) {
    test(`${role.name}: actual own profile, quota, groups and password navigation`, async ({ page }) => {
        const errors = listen(page);
        await page.route('**/api/lmn/wireguard', (route) => route.fulfill({ contentType: 'application/json', json: false }));
        await login(page, role);
        const ownFields = await open(page, role);
        console.log(`${role.name}: real visible custom fields = ${ownFields.length}`);
        const { identity } = await (await page.request.get('/api/core/identity')).json();
        expect(identity.user).toBe(role.login);
        await expect(page.getByRole('heading', { name: `Hallo ${identity.profile.givenName} ${identity.profile.sn},`, exact: true })).toBeVisible();
        await expect(page.locator('.info-cards')).toContainText(identity.profile.sophomorixSchoolname);
        await expect(page.locator('.info-cards')).toContainText(/(Konto Informationen|Account Information)/);
        if (role.name === 'teacher') await expect(page.locator('.info-cards')).toContainText('teachers');
        if (role.name.includes('admin')) await expect(page.getByText(/(großer Macht|great power)/)).toBeVisible();
        // Invalid method probes UID authorization without any downstream network call.
        const wg = await page.request.post('/api/lmn/wireguard', { data: { url: `/api/wireguard/peers/lmn-user_${role.login}/status`, method: 'P43_UID_PROBE' } });
        expect(wg.status()).toBe(['teacher', 'student'].includes(role.name) ? 403 : 200);
        await page.locator('.info-cards').getByText(/^(Change password|Passwort ändern)$/, { exact: true }).click();
        await expect(page).toHaveURL(/\/view\/lmn\/change-password/);
        expect(errors).toEqual([]);
    });
    test(`${role.name}: same custom-field, quota and optional-card fixtures`, async ({ page }) => {
        test.setTimeout(120000);
        const errors = listen(page);
        let current = fields();
        let missingWireguard = false;
        await page.route('**/api/lmn/display_options', (route) => route.fulfill({ json: { show_webdav: true, show_wireguard: true } }));
        await page.route(`**/api/lmn/users/${role.login}/customfields`, (route) => route.fulfill({ json: current }));
        await page.route(`**/api/lmn/quota/user/${role.login}`, (route) => route.fulfill({ json: { cloud: 12, mail: 34, home: { used: 85, hard_limit: 100 }, unlimited: { used: 4, hard_limit: 0 }, failure: { ERROR: true } } }));
        await page.route('**/api/webdav/qrcode', (route) => route.fulfill({ json: { displayName: 'P43 Mobile', url: 'https://example.invalid/webdav', username: role.login, qrcode: png } }));
        await page.route('**/api/lmn/wireguard', (route) => {
            const { url, method } = route.request().postDataJSON();
            expect(method).toBe('GET');
            if (!url.endsWith('/status')) expect(url).toContain(`/api/wireguard/peers/lmn-user_${role.login}/`);
            else expect(url).toMatch(/^\/api\/wireguard\/peers\/lmn-user_[^/]+\/status$/); // Original polls before identity loads.
            return route.fulfill({ contentType: 'application/json', json: url.endsWith('/status') ? { status: 'connected', endpoint: '192.0.2.1', latest_handshake_difference: 5, transfer: { received: 1.25, send: 2.5 } } : missingWireguard ? false : url.endsWith('/config') ? { data: '[Interface]\nP43 config' } : png });
        });
        await login(page, role);
        await open(page, role);
        await expect(page.locator('.info-cards')).toContainText('P43 Einzel');
        await expect(page.locator('.info-cards')).toContainText('85 MiB');
        await expect(page.locator('.info-cards')).toContainText('192.0.2.1');
        await page.locator('a:has(.fa-apple)').first().click();
        await expect(dialog(page)).toContainText('P43 Mobile');
        await expect(dialog(page).locator('img').last()).toHaveJSProperty('naturalWidth', 1);
        await close(page);
        await page.locator('a:has(.fa-download)').click();
        await expect(dialog(page)).toContainText('[Interface]');
        await page.keyboard.press('Escape');
        await page.locator('a:has(.fa-qrcode)').click();
        await expect(dialog(page).locator('img')).toHaveJSProperty('naturalWidth', 1);
        await page.keyboard.press('Escape');
        missingWireguard = true;
        await page.locator('a:has(.fa-download)').click();
        await expect(dialog(page)).toContainText('No configuration is available for this user.');
        await page.keyboard.press('Escape');
        await page.context().route('https://www.wireguard.com/install/', (route) => route.fulfill({ body: 'P43 external window fixture' }));
        const popup = page.waitForEvent('popup');
        await page.locator('a[title=Linux]').click();
        const external = await popup;
        await expect(external).toHaveURL('https://www.wireguard.com/install/');
        await external.close();
        const edit = page.getByText(/^(Change my data|Meine Daten ändern)$/, { exact: true });
        if (role.name === 'student') {
            await expect(edit).toBeHidden();
        } else {
            await edit.click();
            await expect(dialog(page).locator('tr').filter({ hasText: 'P43 Gesperrt' }).locator('a')).toHaveCount(0);
            await dialog(page).locator('tr').filter({ hasText: 'P43 Einzel' }).locator('a').click();
            await expect(message(page).locator('input')).toHaveValue('Vorher');
            await message(page).locator('input').fill('');
            await message(page).locator('input').pressSequentially('  P43 neuer Wert  ');
            const saved = response(page, `/api/lmn/users/${role.login}/custom/1`, 'POST');
            await page.route(`**/api/lmn/users/${role.login}/custom/1`, (route) => {
                expect(route.request().postDataJSON()).toEqual({ value: 'P43 neuer Wert' });
                current = current.map((c) => c.attr === 'sophomorixCustom1' ? { ...c, value: 'P43 neuer Wert' } : c);
                return route.fulfill({ contentType: 'application/json', json: null });
            });
            await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click();
            await saved;
            await expect(dialog(page)).toContainText('P43 neuer Wert');
            for (const [title, attr, path, key] of [ ['P43 Mehrfach', 'sophomorixCustomMulti1', 'custommulti/1', 'value'], ['P43 Adressen', 'proxyAddresses', 'proxyaddresses', 'address'] ]) {
                await page.route(`**/api/lmn/users/${role.login}/${path}`, (route) => {
                    expect(route.request().postDataJSON()).toEqual({ [key]: 'p43-added' });
                    const adding = route.request().method() === 'POST';
                    current = current.map((c) => c.attr === attr ? { ...c, value: adding ? [...c.value, 'p43-added'] : c.value.filter((v) => v !== 'p43-added') } : c);
                    return route.fulfill({ contentType: 'application/json', json: null });
                });
                const row = () => dialog(page).locator('tr').filter({ hasText: title });
                await row().locator('a').click();
                await message(page).locator('input').fill('p43-added');
                let sent = response(page, `/api/lmn/users/${role.login}/${path}`, 'POST');
                await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click(); await sent;
                await row().getByText('p43-added', { exact: true }).click();
                await message(page).locator('.negative').click();
                await expect(row()).toContainText('p43-added');
                await row().getByText('p43-added', { exact: true }).click();
                sent = response(page, `/api/lmn/users/${role.login}/${path}`, 'PATCH');
                await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click(); await sent;
                await expect(row()).not.toContainText('p43-added');
            }
            const reloaded = response(page, `/api/lmn/users/${role.login}/customfields`);
            await close(page);
            await reloaded;
            await expect(page.locator('.info-cards')).toContainText('P43 neuer Wert');
        }
        // Options disabled after a fresh route load.
        await page.route('**/api/lmn/display_options', (route) => route.fulfill({ json: { show_webdav: false, show_wireguard: false } }));
        await open(page, role);
        await expect(page.locator('a:has(.fa-download)')).toHaveCount(0);
        await expect(page.locator('a:has(.fa-apple)')).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}
// Default E has no visible/editable custom fields: expose only display metadata;
// write endpoints remain real, checked against Samba after editing one's own data.
test('teacher: real single/multi values with SSH proof, reload and restoration', async ({ page }) => {
    test.setTimeout(180000);
    const errors = listen(page);
    await page.route('**/api/lmn/wireguard', (route) => route.fulfill({ contentType: 'application/json', json: false }));
    const role = roles.find((r) => r.name === 'teacher');
    await page.route(`**/api/lmn/users/${role.login}/customfields`, async (route) => {
        const raw = ssh(`ldbsearch -H /var/lib/samba/private/sam.ldb '(sAMAccountName=${role.login})' sophomorixCustom1 sophomorixCustomMulti1`);
        const single = raw.match(/^sophomorixCustom1: (.*)$/m)?.[1] || '';
        const multi = [...raw.matchAll(/^sophomorixCustomMulti1: (.*)$/gm)].map((m) => m[1]);
        return route.fulfill({ json: [ { attr: 'sophomorixCustom1', title: 'P43 Einzel', editable: true, value: single }, { attr: 'sophomorixCustomMulti1', title: 'P43 Mehrfach', editable: true, value: multi } ] });
    });
    await login(page, role); await open(page, role);
    await page.getByText(/^(Change my data|Meine Daten ändern)$/, { exact: true }).click();
    const single = () => dialog(page).locator('tr').filter({ hasText: 'P43 Einzel' });
    await single().locator('a').click();
    const previous = await message(page).locator('input').inputValue();
    await message(page).locator('input').fill('P43 echter Wert');
    let saved = response(page, `/api/lmn/users/${role.login}/custom/1`, 'POST');
    await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click();
    expect((await saved).status()).toBe(200);
    expect(ssh(`ldbsearch -H /var/lib/samba/private/sam.ldb '(sAMAccountName=${role.login})' sophomorixCustom1`)).toContain('sophomorixCustom1: P43 echter Wert');
    await single().locator('a').click(); await message(page).locator('input').fill(previous);
    saved = response(page, `/api/lmn/users/${role.login}/custom/1`, 'POST');
    await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click(); await saved;
    const multi = () => dialog(page).locator('tr').filter({ hasText: 'P43 Mehrfach' });
    await multi().locator('a').click(); await message(page).locator('input').fill('p43-multi');
    saved = response(page, `/api/lmn/users/${role.login}/custommulti/1`, 'POST');
    await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click(); expect((await saved).status()).toBe(200);
    expect(ssh(`ldbsearch -H /var/lib/samba/private/sam.ldb '(sAMAccountName=${role.login})' sophomorixCustomMulti1`)).toContain('sophomorixCustomMulti1: p43-multi');
    await multi().getByText('p43-multi', { exact: true }).click();
    saved = response(page, `/api/lmn/users/${role.login}/custommulti/1`, 'PATCH');
    await message(page).getByText(/^(OK|Ok)$/, { exact: true }).click(); expect((await saved).status()).toBe(200);
    expect(ssh(`ldbsearch -H /var/lib/samba/private/sam.ldb '(sAMAccountName=${role.login})' sophomorixCustomMulti1`)).not.toContain('p43-multi');
    const reloaded = response(page, `/api/lmn/users/${role.login}/customfields`);
    await close(page); await reloaded;
    expect(errors).toEqual([]);
});
