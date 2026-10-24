import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
import { groups, parameters } from './fixtures/linboSync.mjs';
test.use({ timezoneId: 'Europe/Berlin' });
const admin = settings.roles.find(r => r.name === 'global-admin');
const schoolAdmin = { name: 'school-admin', login: 'pgmadmin', pw: admin.pw };
const path = '/view/lmn/linbo_sync';
function listen(page) {
    const state = { errors: [], authenticated: false };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text()); });
    return state;
}
async function login(page, role, state) {
    // Safety net in every UI test: no real client command can leave the browser.
    await page.route('**/api/lmn/linbosync/run', route => route.fulfill({ json: { status: 0, msg: 'P52 synthetic' } }));
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    state.authenticated = true;
}
const pane = page => page.locator('.tab-pane.active');
const icons = { New: 'fa-exclamation-triangle', Format: 'fa-eraser', Sync: 'fa-sync-alt', Start: 'fa-play', 'Wake on lan': 'fa-lightbulb', Partition: 'fa-eraser', 'Disable GUI': 'fa-terminal', 'Bypass autostart': 'fa-directions', 'Use Prestart': 'fa-plug', Broadcast: 'fa-terminal', Reboot: 'fa-sync' };
const click = (page, name) => icons[name]
    ? (['Partition', 'Start', 'Broadcast'].includes(name) ? pane(page).locator(`button:has(i.${icons[name]})`).last() : pane(page).locator(`button:has(i.${icons[name]})`).first()).click()
    : pane(page).getByText(name, { exact: true }).last().click();
const preview = page => pane(page).locator('pre:visible');
async function fixture(page) {
    const calls = [], checks = [];
    await page.route('**/api/lmn/activeschool', route => route.fulfill({ json: 'default-school' }));
    await page.route('**/api/lmn/linbosync/last_syncs', route => route.fulfill({ json: groups() }));
    await page.route('**/api/lmn/linbosync/isOnline/*', route => { checks.push(route.request().url().split('/').at(-1)); return route.fulfill({ json: checks.length === 1 ? 'OS Linux' : 'Off' }); });
    await page.route('**/api/lmn/linbosync/run', route => {
        calls.push(route.request().postDataJSON());
        return route.fulfill({ json: calls.length === 1 ? { status: 0, msg: 'P52 synthetic' } : { status: 1, msg: 'P52 failure' } });
    });
    return { calls, checks };
}
for (const role of [admin, schoolAdmin]) {
    test(`${role.name}: real list permission and backend data (read only)`, async ({ page }) => {
        const state = listen(page); await login(page, role, state);
        await expect(page.locator(`a[href^="${path}"]`).first()).toBeVisible();
        const response = await page.request.get('/api/lmn/linbosync/last_syncs');
        expect(response.status()).toBe(200);
        const data = await response.json();
        expect(typeof data).toBe('object');
        console.log('P52 real groups:', JSON.stringify(Object.keys(data)));
        await page.goto(path);
        await expect(page.locator('.tab-pane.active')).toBeVisible();
        const [name, details] = Object.entries(data)[0];
        await expect(pane(page).locator('h1')).toHaveText(name);
        for (const host of details.hosts ?? []) await expect(pane(page)).toContainText(host.hostname);
        for (const image of details.os ?? []) await expect(pane(page)).toContainText(image.baseimage);
        expect(state.errors).toEqual([]);
    });
    test(`${role.name}: identical host/group preview, toggles and intercepted run payloads`, async ({ page }) => {
        const state = listen(page); await login(page, role, state); const { calls, checks } = await fixture(page);
        await page.goto(path);
        await expect(pane(page).locator('h1')).toHaveText('p52group');
        expect((await pane(page).locator('button').allTextContents()).map(s => s.trim())).toEqual(['Format', 'Sync', 'Start', 'New', 'Format', 'Sync', 'Start', 'New', 'Halt', 'Reboot', 'Wake on lan', 'Boot timeout (in seconds):', 'Partition', 'Disable GUI', 'Bypass autostart', 'Use Prestart', 'Broadcast']);
        await expect(pane(page).locator('td.success').first().locator('span:visible')).toHaveText('01 Jan 2024 01:00:00');
        await expect(pane(page)).toContainText(/Kein Datum|No date/);
        await expect(pane(page).locator('th').filter({ hasText: /Letzte Synchronisierung|Last sync/ }).first()).toBeVisible();
        // No host: command remains local and Apply stays hidden.
        await click(page, 'New'); await expect(preview(page)).toHaveCount(0);
        await pane(page).locator('input[type="checkbox"]').nth(1).click();
        await expect(preview(page)).toHaveText('/usr/sbin/linbo-remote -i 192.0.2.1 -c new:1');
        await click(page, /^(Apply|Anwenden|Übernehmen)$/);
        await expect.poll(() => calls.length).toBe(1);
        expect(calls).toEqual([{ cmd_parameters: parameters() }]); // new is parametrized as sync in the original
        await expect(page.getByText('Command successfully sent: P52 synthetic', { exact: true })).toBeVisible();
        await click(page, 'Format'); // cancels new
        await click(page, 'Sync');
        await click(page, 'Start'); // first visible OS start
        await click(page, 'Wake on lan');
        await pane(page).locator('input[type="number"]').fill('42');
        for (const text of ['Partition', 'Disable GUI', 'Bypass autostart', 'Use Prestart', 'Broadcast', 'Reboot']) await click(page, text);
        await pane(page).locator('input[type="checkbox"]').first().click();
        await expect(preview(page)).toHaveText('/usr/sbin/linbo-remote -g p52group -w 42 -d  -u  -n  -p  partition,format,format:1,sync:1,start:2,reboot');
        await click(page, /^(Apply|Anwenden|Übernehmen)$/); await expect.poll(() => calls.length).toBe(2);
        expect(calls[1]).toEqual({ cmd_parameters: parameters('p52group', { target: { type: 'group', host: 'p52group' }, timeout: 42, prestart: true, disable_gui: true, broadcast: true, bypass: true, partition: true, actions: { format: [1], sync: [1], start: [2] }, acpi: 'reboot' }) });
        await expect(page.getByText('P52 failure', { exact: true })).toBeVisible();
        await click(page, /^(Check online|Online.*prüfen|Online überprüfen)$/); await expect.poll(() => checks.length).toBe(3);
        expect(checks).toEqual(['p52client1', 'p52client2', 'p52client3']);
        await expect(pane(page).locator('a.btn-success')).toContainText('OS Linux');
        await page.locator('.nav-tabs').getByText('second', { exact: true }).click(); await expect(pane(page).locator('h1')).toHaveText('second');
        expect(state.errors).toEqual([]);
    });
}
for (const role of [settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: hidden sidebar and all action rights denied by backend`, async ({ page }) => {
        const state = listen(page); await login(page, role, state);
        await expect(page.locator(`a[href^="${path}"]`)).toHaveCount(0);
        for (const url of ['last_syncs', 'isOnline/p52-does-not-exist']) expect((await page.request.get('/api/lmn/linbosync/' + url)).status()).toBe(403);
        // Authorization runs before body handling; no permitted call is made.
        expect((await page.request.post('/api/lmn/linbosync/run', { data: {} })).status()).toBe(403);
        expect(state.errors).toEqual([]);
    });
}
test('loading remains blank; none sentinel retains original tab and command hint', async ({ page }) => {
    const state = listen(page); await login(page, admin, state);
    let pending;
    await page.route('**/api/lmn/linbosync/last_syncs', route => { pending = route; });
    await page.goto(path); await expect.poll(() => Boolean(pending)).toBe(true);
    await expect(page.locator('.nav-tabs li')).toHaveCount(0);
    await pending.fulfill({ json: ['none'] });
    await expect(pane(page).locator('h1')).toHaveText('0');
    await expect(preview(page)).toHaveCount(0);
    expect(state.errors).toEqual([]);
});
test('school-specific multiple-host previews and every online classification', async ({ page }) => {
    const state = listen(page); await login(page, admin, state); const { calls } = await fixture(page);
    await page.route('**/api/lmn/activeschool', route => route.fulfill({ json: 'p52-school' }));
    let status = 'Off';
    await page.route('**/api/lmn/linbosync/isOnline/*', route => route.fulfill({ json: status }));
    await page.goto(path); await click(page, 'Sync');
    await pane(page).locator('input[type="checkbox"]').nth(1).click();
    await pane(page).locator('input[type="checkbox"]').nth(2).click();
    await expect(preview(page)).toHaveText(['/usr/sbin/linbo-remote -s p52-school -i 192.0.2.1 -c sync:1', '/usr/sbin/linbo-remote -s p52-school -i 192.0.2.2 -c sync:1']);
    await click(page, /^(Apply|Anwenden|Übernehmen)$/); await expect.poll(() => calls.length).toBe(2);
    expect(calls).toEqual([{ cmd_parameters: parameters() }, { cmd_parameters: parameters('192.0.2.2') }]);
    await click(page, 'Wake on lan');
    await pane(page).locator('input[type="number"]').fill('0');
    await expect(pane(page).locator('input[type="number"]')).toHaveValue('0');
    await expect(preview(page)).toHaveText(['/usr/sbin/linbo-remote -s p52-school -i 192.0.2.1 -w undefined -c sync:1', '/usr/sbin/linbo-remote -s p52-school -i 192.0.2.2 -w undefined -c sync:1']);
    await click(page, /^(Apply|Anwenden|Übernehmen)$/); await expect.poll(() => calls.length).toBe(4);
    const { timeout, ...withoutTimeout } = parameters();
    expect(calls.slice(2)).toEqual([{ cmd_parameters: withoutTimeout }, { cmd_parameters: { ...withoutTimeout, target: { type: 'host', host: '192.0.2.2' } } }]);
    const check = pane(page).locator('a.btn-default').first();
    for (const [value, icon] of [['Off', 'fa-power-off'], ['No response', 'fa-power-off'], ['OS Linux', 'fa-linux'], ['OS Windows', 'fa-windows'], ['Linbo', 'fa-laptop-medical']]) {
        status = value; await check.click(); await expect(check).toContainText(value); await expect(check.locator(`i.${icon}`)).toBeVisible();
    }
    expect(state.errors).toEqual([]);
});
