import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// Caller reserves set E and resets E1-bereit before/after old and new runs.
const csv = '/etc/linuxmuster/sophomorix/default-school/devices.csv';
const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
const roles = [settings.roles[0], { name: 'school-admin', login: 'pgmadmin', pw: settings.roles[0].pw }];
const lease = { mac: '02:36:00:00:00:01', ip: '10.0.0.236', starts: 'P36 start', ends: 'P36 end' };
const registered = { mac: '02:36:00:00:00:AA', ip: '10.0.0.235', hostname: 'ajp36known' };
const fixture = [[{ ...lease, mac: registered.mac.toLowerCase() }, lease], [registered]];
const names = { save: /^(Save|Speichern)$/, cancel: /^(Cancel|Abbrechen)$/, apply: /^(Save & import|Speichern & importieren)$/, close: /^(Close|Schließen)$/ };
const action = (page, name) => page.getByText(names[name], { exact: true });
function errorsOn(page) {
    const errors = [];
    let loggedIn = false;
    page.on('pageerror', (error) => { errors.push(error.message); console.log('DHCP pageerror:', error.message); });
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const path = new URL(message.location().url || '/', settings.baseURL).pathname;
        if (!loggedIn && ['/api/core/sidebar', '/api/core/tasks/request-update'].includes(path)
            && message.text() === 'Failed to load resource: the server responded with a status of 401 (Unauthenticated)') return;
        errors.push(message.text());
        console.log('DHCP console:', path, message.text());
    });
    return { errors, markLoggedIn: () => { loggedIn = true; } };
}
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
async function visit(page) {
    const response = page.waitForResponse('**/api/lmn/dhcp/leases');
    await page.goto('/view/lmn/dhcp');
    expect((await response).status()).toBe(200);
    await expect(page.locator('h2').filter({ hasText: /DHCP/ })).toHaveText('DHCP-Leases');
}
const dialog = (page) => page.locator('.modal:visible').last();
async function add(page) {
    await page.locator('button:visible:has(.fa-plus)').last().click();
    await expect(dialog(page)).toBeVisible();
}
async function fill(page, values) {
    for (const [i, value] of values.entries()) {
        const field = dialog(page).locator('input[type="text"]').nth(i);
        if (i === 4) { await field.fill(''); await field.pressSequentially(value); }
        else await field.fill(value);
    }
}
for (const role of roles) {
    test(`${role.name}: leases, duplicate hints, validation, cancel and import dialog`, async ({ page }) => {
        const { errors, markLoggedIn } = errorsOn(page);
        await page.route('**/api/lmn/dhcp/leases', (route) => route.fulfill({ json: fixture }));
        await login(page, role); markLoggedIn(); await visit(page);
        await expect(page.locator('table tr')).toHaveCount(3);
        await expect(page.locator('span:visible').filter({ hasText: /Already registered!|Bereits registriert!/ })).toBeVisible();
        await expect(page.locator('button:visible:has(.fa-plus)')).toHaveCount(1);
        await add(page);
        await expect(dialog(page).locator('h1')).toHaveText('Gerät hinzufügen');
        await expect(action(dialog(page), 'save')).toHaveText('Speichern');
        await expect(dialog(page).locator('input').nth(1)).toHaveValue(lease.mac);
        await expect(dialog(page).locator('select').nth(0)).toHaveValue('0');
        await expect(dialog(page).locator('select').nth(1)).toHaveValue('staffcomputer');
        await fill(page, ['r36', lease.mac, registered.ip, registered.hostname, 'p36group']);
        await expect(dialog(page).locator('td.has-error')).toHaveCount(2);
        await fill(page, ['r36', lease.mac, 'bad-ip', 'bad host', 'p36group']);
        let posts = 0;
        await page.route('**/api/lmn/dhcp/register', (route) => { posts++; return route.fulfill({ json: true }); });
        await action(dialog(page), 'save').click();
        await expect(page.getByText(/bad-ip/).first()).toBeVisible();
        await expect(page.getByText(/bad host/).first()).toBeVisible();
        expect(posts).toBe(0);
        // Original opens devices Apply even when validation rejects the form.
        await page.route('**/api/lmn/devices/import', (route) => route.fulfill({ json: null }));
        await page.route('**/api/lmn/log/tmp/import_devices.log?*', (route) => route.fulfill({ json: 'P36 import oracle\n' }));
        await action(dialog(page), 'apply').click();
        const apply = page.locator('.modal:visible').filter({ has: page.locator('h4').filter({ hasText: /Importing device|Importiere Gerät/i }) });
        await expect(apply).toBeVisible();
        await expect(apply.locator('pre')).toContainText('P36 import oracle');
        expect(posts).toBe(0);
        await action(apply, 'close').click();
        await action(dialog(page), 'cancel').click();
        await expect(page.locator('.modal:visible')).toHaveCount(0);
        expect(errors).toEqual([]);
    });
    test(`${role.name}: real register CSV and reload known MAC`, async ({ page }) => {
        const { errors, markLoggedIn } = errorsOn(page);
        await login(page, role); markLoggedIn();
        const response = page.waitForResponse('**/api/lmn/dhcp/leases');
        await page.goto('/view/lmn/dhcp');
        const real = await response;
        expect(real.status()).toBe(200);
        const data = await real.json();
        // E has no DHCP client for this synthetic MAC. Keep its real registered CSV list.
        await page.route('**/api/lmn/dhcp/leases', (route) => route.fulfill({ json: [[lease], data[1]] }));
        await visit(page); await add(page);
        const hostname = role.name === 'global-admin' ? 'ajp36ga' : 'ajp36sa';
        await fill(page, [' r36 ', ` ${lease.mac} `, ` ${lease.ip} `, ` ${hostname} `, ' p36 group ']);
        await expect(dialog(page).locator('input').nth(4)).toHaveValue(' p36 group ');
        const saved = page.waitForResponse('**/api/lmn/dhcp/register');
        await action(dialog(page), 'save').click();
        const result = await saved;
        expect(result.status()).toBe(200);
        expect(result.request().postDataJSON()).toEqual({ device: {
            room: 'r36', hostname, group: 'p36 group', mac: lease.mac, ip: lease.ip,
            pxeFlag: '0', officeKey: '', windowsKey: '', dhcpOptions: '', sophomorixRole: 'staffcomputer',
            lmnReserved10: '', lmnReserved12: '', lmnReserved13: '', lmnReserved14: '', sophomorixComment: '',
        } });
        await expect(page.locator('.modal:visible')).toHaveCount(0);
        await expect(page.locator('button:visible:has(.fa-plus)')).toHaveCount(1); // Legacy updates the wrong used row.
        expect(ssh(`cat ${csv}`)).toContain(`r36;${hostname};p36 group;${lease.mac};${lease.ip};`);
        await page.unroute('**/api/lmn/dhcp/leases');
        const reloaded = page.waitForResponse('**/api/lmn/dhcp/leases');
        await page.goto('/view/lmn/dhcp');
        const updated = await (await reloaded).json();
        expect(updated[1].some((d) => d.mac === lease.mac && d.hostname === hostname)).toBe(true);
        await page.route('**/api/lmn/dhcp/leases', (route) => route.fulfill({ json: [[lease], updated[1]] }));
        await visit(page);
        await expect(page.locator('button:visible:has(.fa-plus)')).toHaveCount(0);
        expect(errors).toEqual([]);
        // Remove only the synthetic row, to isolate the next role without an import.
        ssh(`sed -i '/^r36;${hostname};/d' ${csv}`);
    });
}
for (const role of [settings.roles[1], { name: 'student', login: 'serdarje', pw: settings.roles[0].pw }]) {
    test(`${role.name}: sidebar hidden and API denied`, async ({ page }) => {
        const { errors, markLoggedIn } = errorsOn(page);
        await login(page, role); markLoggedIn();
        await expect(page.locator('a[href="/view/lmn/dhcp"]')).toHaveCount(0);
        expect((await page.request.get('/api/lmn/dhcp/leases')).status()).toBe(403);
        expect((await page.request.post('/api/lmn/dhcp/register', { data: { device: {} } })).status()).toBe(403);
        expect(errors).toEqual([]);
    });
}
