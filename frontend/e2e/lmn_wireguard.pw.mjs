import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
// All Wireguard service traffic stays synthetic. Real UID authorization is
// checked separately; no keys, interfaces or routes are created on E.
const admin = settings.roles.find(r => r.name === 'global-admin');
const peer = name => ({ name, public_key: 'P41_SYNTHETIC_KEY', ip: '192.0.2.41', routes: ['192.0.2.0/24'] });
const payload = (url, method = 'GET', data) => ({ url: '/api/wireguard/' + url, method, ...(data === undefined ? {} : { data }) });
async function login(page, role, state) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    state.authenticated = true;
}
function listen(page) {
    const state = { errors: [], authenticated: false };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text()); });
    return state;
}
const modal = page => page.locator('.modal:visible');
const button = (page, name) => page.getByRole('button', { name, exact: true });
const cancel = page => page.getByRole('dialog').filter({ visible: true }).getByText(/^(Cancel|Abbrechen)$/, { exact: true }).last().click();
const confirm = page => page.getByRole('dialog').filter({ visible: true }).getByText(/^(Restart|Neustart|Neu starten|Delete|Löschen|OK)$/, { exact: true }).last().click();
async function fixture(page) {
    let peers = [peer('P41_synthetic'), peer('lmn-user_existing'), peer('lmn-user_orphan')];
    const calls = [];
    await page.route('**/api/lmn/sophomorixUsers/*', route => route.fulfill({ json: route.request().url().endsWith('/students') ? [{ sAMAccountName: 'new', givenName: 'Synthetic', sn: 'P41' }] : [{ sAMAccountName: 'existing', givenName: 'Existing', sn: 'P41' }] }));
    await page.route('**/api/lmn/wireguard', async route => {
        const p = route.request().postDataJSON(); calls.push(p);
        let data = true;
        if (p.method === 'POST') peers = [...peers, peer(p.data.name)];
        else if (p.method === 'DELETE') peers = peers.filter(x => x.name !== p.url.split('/').at(-1));
        else if (p.url.endsWith('/status')) data = { P41_synthetic: { status: 'connected', endpoint: '192.0.2.1:1234', latest_handshake_difference: 12, transfer: { received: 1.25, send: 2.5 } } };
        else if (p.url.endsWith('/config')) data = { data: '[Interface]\n# P41 synthetic configuration' };
        else if (p.url.endsWith('/qr/b64')) data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5WQAAAAASUVORK5CYII=';
        else if (p.url.endsWith('/peers')) data = peers;
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
    });
    return calls;
}
for (const role of [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }]) {
    test(`${role.name}: cards, config, QR, create/delete, restart and import`, async ({ page }) => {
        test.setTimeout(120_000);
        const state = listen(page), calls = await fixture(page);
        await login(page, role, state);
        await expect(page.locator('a[href^="/view/lmn/wireguard"]').filter({ visible: true }).first()).toBeVisible();
        await page.goto('/view/lmn/wireguard');
        const card = page.locator('.list-group-item').filter({ has: page.getByText('P41_synthetic', { exact: true }) });
        await expect(card).toContainText('P41_SYNTHETIC_KEY'); await expect(card).toContainText('192.0.2.1:1234');
        const statusCalls = calls.filter(p => p.url.endsWith('/status')).length;
        await page.locator('button:has(.fa-refresh)').click();
        await expect.poll(() => calls.filter(p => p.url.endsWith('/status')).length).toBe(statusCalls + 1);
        await expect(card.getByRole('button').first()).toContainText(/Konfiguration|Configuration/);
        await card.getByRole('button').nth(0).click(); await expect(modal(page)).toContainText('[Interface]'); await page.keyboard.press('Escape');
        await card.getByRole('button').nth(1).click(); await expect(modal(page).locator('img')).toHaveAttribute('src', /^data:image\/png;base64,/); await page.keyboard.press('Escape');
        await page.locator('button:has(.fa-plus)').click(); await cancel(page);
        expect(calls.filter(p => p.method === 'POST')).toEqual([]);
        await page.locator('button:has(.fa-plus)').click();
        await page.locator('input:visible').last().pressSequentially(' P41 new peer '); await confirm(page); await cancel(page);
        await expect(page.locator('.list-group-item').filter({ has: page.getByText('P41 new peer', { exact: true }) })).toBeVisible();
        await card.getByRole('button').nth(2).click(); await cancel(page);
        expect(calls.filter(p => p.method === 'DELETE')).toEqual([]);
        await card.getByRole('button').nth(2).click(); await confirm(page); await cancel(page);
        await expect(card).toHaveCount(0);
        await page.locator('button:has(.fa-power-off)').click(); await cancel(page);
        expect(calls.filter(p => p.url.endsWith('/restart'))).toEqual([]);
        await page.locator('button:has(.fa-power-off)').click(); await confirm(page);
        await expect.poll(() => calls.filter(p => p.url.endsWith('/restart')).length).toBe(1);
        await page.locator('button:has(.fa-upload)').click();
        await button(page, 'Check users').click(); await expect(modal(page)).toContainText('lmn-user_orphan');
        await button(page, /^(Close|Schließen)$/).click(); await cancel(page); // original asks restart even without a run
        await page.locator('button:has(.fa-upload)').click(); await button(page, 'Check users').click();
        await button(page, /^(Import \+ Delete|Importieren \+ Löschen)$/).click();
        await expect(modal(page).locator('.progress-bar')).toContainText('2 / 2');
        await button(page, /^(Close|Schließen)$/).click();
        await expect(modal(page)).toHaveCount(0); // original suppresses restart after a successful run
        expect(calls.filter(p => p.method !== 'GET')).toEqual([
            payload('peers', 'POST', { name: 'P41 new peer' }), payload('peers/P41_synthetic', 'DELETE'),
            payload('peers', 'POST', { name: 'lmn-user_new' }), payload('peers/lmn-user_orphan', 'DELETE'),
        ]);
        expect(state.errors).toEqual([]);
    });
}
test('unavailable service warning and empty peer list', async ({ page }) => {
    const state = listen(page); let data = false;
    await page.route('**/api/lmn/wireguard', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) }));
    await login(page, admin, state); await page.goto('/view/lmn/wireguard');
    await expect(page.locator('.alert-warning').filter({ hasText: 'Connection to wireguard server' })).toContainText('Connection to wireguard server is not possible');
    data = []; await page.reload(); await expect(page.locator('button:has(.fa-plus)')).toBeVisible();
    await expect(page.locator('.alert-warning').filter({ hasText: 'Connection to wireguard server' })).toHaveCount(0); expect(state.errors).toEqual([]);
});
for (const role of [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: real UID proxy contract, hidden sidebar for non-admin`, async ({ page }) => {
        const state = listen(page); await login(page, role, state);
        if (['teacher', 'student'].includes(role.name)) await expect(page.locator('a[href^="/view/lmn/wireguard"]')).toHaveCount(0);
        // An unsupported inner method exercises UID authorization without contacting
        // a configured downstream host, even if the VM setup changes.
        const response = await page.request.post('/api/lmn/wireguard', { data: payload('peers', 'P41_NO_NETWORK') });
        expect(response.status()).toBe(['global-admin', 'school-admin'].includes(role.name) ? 200 : 403);
        if (['global-admin', 'school-admin'].includes(role.name)) expect(await response.json()).toEqual(false);
        expect(state.errors).toEqual([]);
    });
}
