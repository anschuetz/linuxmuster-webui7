import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30_000 });
const admin = settings.roles.find((r) => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }];
const api = '/api/lmn/dns';
const route = '/view/lmn/samba_dns';
const response = (page, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === api && r.request().method() === method);
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
function listen(page) {
    const errors = [];
    page.on('pageerror', (error) => { errors.push(error.message); console.error(error.message); });
    page.on('console', (message) => {
        // Login probes the unauthenticated session; denied API requests are intentional.
        if (message.type() === 'error' && !/^Failed to load resource: the server responded with a status of (401|403) /.test(message.text())) { errors.push(message.text()); console.error(message.text()); }
    });
    return errors;
}
async function open(page) {
    const loaded = response(page);
    await page.goto(route);
    expect((await loaded).status()).toBe(200);
    await expect(page.getByRole('button', { name: /Eintrag hinzufügen$/ })).toBeVisible();
}
const row = (page, host) => page.locator('table tr').filter({ has: page.locator('td:first-child').filter({ hasText: new RegExp(`^${host}( |$)`) }) });
const dialog = (page) => page.locator('.modal:visible').filter({ has: page.locator('form') });
const input = (page, name) => dialog(page).locator(`[name="${name}"], [ng\\:model="new.${name}"], [ng\\:model="sub.${name}"]`);
const action = (page, name) => dialog(page).getByText(name, { exact: true }).click();
async function add(page, host, type, value, priority) {
    await page.getByRole('button', { name: /Eintrag hinzufügen$/ }).click();
    await input(page, 'host').fill(` ${host} `);
    await dialog(page).locator('select').selectOption({ label: type });
    await input(page, 'value').fill(` ${value} `);
    if (priority) await input(page, 'priority').fill(` ${priority} `);
    const saved = response(page, 'PUT');
    await action(page, /^(Save|Speichern)$/);
    expect((await saved).status()).toBe(200);
    await expect(row(page, host)).toBeVisible();
}
async function remove(page, host, confirm) {
    await row(page, host).getByTitle(/^(Delete this entry|Diesen Eintrag löschen)$/).click();
    const box = page.locator('.modal:visible').filter({ hasNot: page.locator('form') });
    const saved = confirm ? response(page, 'PATCH') : null;
    await box.getByText(confirm ? /^(Delete|Löschen)$/ : /^(Cancel|Abbrechen)$/, { exact: true }).click();
    if (saved) expect((await saved).status()).toBe(200);
}

for (const role of roles) {
    test(`${role.name}: real DNS A/MX lifecycle, cancel and persistence`, async ({ page }) => {
        test.setTimeout(120_000);
        const errors = listen(page);
        await login(page, role);
        await expect(page.locator(`a[href^="${route}"]`).filter({ visible: true }).first()).toBeVisible();
        await open(page);
        const data = await (await page.request.get(api)).json();
        const zone = data[1];
        await expect(page.locator('h3').first()).toHaveText(`Zoneninformationen (${zone})`);
        for (const entry of data[0].root) await expect(page.locator('table').first()).toContainText(String(entry.value));
        const host = `p32-${role.name}`;
        const mx = `${host}-mx`;
        const query = (name, type) => ssh(`samba-tool dns query 127.0.0.1 '${zone}' '${name}' ${type} -P 2>&1 || true`);
        const before = query(host, 'A');
        expect(before).not.toContain('192.0.2.32');
        await add(page, host, 'A', '192.0.2.32');
        expect(query(host, 'A')).toContain('192.0.2.32');
        let patches = 0;
        page.on('request', (r) => { if (new URL(r.url()).pathname === api && r.method() === 'PATCH') patches++; });
        await remove(page, host, false);
        expect(patches).toBe(0);
        await expect(row(page, host)).toBeVisible();
        await row(page, host).getByTitle(/^(Modify this entry|Diesen Eintrag bearbeiten)$/).click();
        await input(page, 'value').fill('192.0.2.35');
        await action(page, /^(Close|Schließen)$/);
        await expect(row(page, host)).toContainText('192.0.2.35');
        expect(query(host, 'A')).toContain('192.0.2.32');
        // Close keeps local edits; reloading is needed to recover the persisted old value.
        await open(page);
        await row(page, host).getByTitle(/^(Modify this entry|Diesen Eintrag bearbeiten)$/).click();
        await expect(input(page, 'host')).toBeDisabled();
        await expect(input(page, 'type')).toBeDisabled();
        await input(page, 'value').fill(' 192.0.2.33 ');
        const updated = response(page, 'POST');
        await action(page, /^(Update|Aktualisieren)$/);
        expect((await updated).status()).toBe(200);
        expect(query(host, 'A')).toContain('192.0.2.33');
        await open(page);
        await expect(row(page, host)).toContainText('192.0.2.33');
        await add(page, mx, 'MX', `mail.${zone}`, '17');
        await expect(row(page, mx)).toContainText('(17)');
        expect(query(mx, 'MX')).toContain('17');
        const patched = page.waitForRequest((r) => new URL(r.url()).pathname === api && r.method() === 'PATCH');
        await remove(page, mx, true);
        expect((await patched).postDataJSON()).toEqual({ sub: mx, type: 'MX', value: `mail.${zone}\\ 17` });
        expect(query(mx, 'MX')).toContain('WERR_DNS_ERROR_NAME_DOES_NOT_EXIST');
        await remove(page, host, true);
        expect(query(host, 'A')).toContain('WERR_DNS_ERROR_NAME_DOES_NOT_EXIST');
        await open(page);
        await expect(row(page, host)).toHaveCount(0);
        await expect(row(page, mx)).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}

for (const role of [settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: no sidebar, direct GET/PUT denied without mutation`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role);
        await expect(page.locator(`a[href^="${route}"]`)).toHaveCount(0);
        const loaded = response(page);
        await page.goto(route);
        expect((await loaded).status()).toBe(403);
        const denied = await page.request.put(api, { data: { sub: { host: 'p32-denied', type: 'A', value: '192.0.2.34', ttl: 900 } } });
        expect(denied.status()).toBe(403);
        expect(ssh("samba-tool dns query 127.0.0.1 $(hostname -d) p32-denied A -P 2>&1 || true")).toContain('WERR_DNS_ERROR_NAME_DOES_NOT_EXIST');
        expect(errors).toEqual([]);
    });
}
