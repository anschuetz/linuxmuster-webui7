import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
// Never forward admin Docker requests: original backend hardcodes 10.0.0.3,
// outside set E. Identical isolated synthetic fixtures for old and new UI.
const admin = settings.roles.find((r) => r.name === 'global-admin');
const container = { Container: 'p34abc', Name: 'P34_synthetic', PIDs: '1', MemUsage: '2MiB', CPUPerc: '0.1%', NetIO: '1kB' };
const image = { hash: 'p34image', Repository: 'P34_image', CreatedSince: '2 days', Tag: 'test', Size: '3MB' };
const listeners = new WeakMap();
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    listeners.get(page).authenticated = true;
}
function listen(page) {
    const errors = []; const state = { authenticated: false }; listeners.set(page, state);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !(!state.authenticated && /401 \((?:Unauthorized|Unauthenticated)\)/.test(m.text()))) errors.push(m.text()); });
    return errors;
}
const tab = (page, name) => page.locator('.nav-tabs').getByText(name, { exact: true });
const row = (page, name) => page.locator('table:visible tr').filter({ hasText: name });
const action = (r, icon) => r.locator(`button:has(.fa-${icon})`);
const confirm = (page, yes) => page.locator('.modal:visible').getByText(yes ? /^(Remove|Entfernen)$/ : /^(Cancel|Abbrechen)$/, { exact: true }).click();
for (const role of [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }]) {
    test(`${role.name}: stats, details, commands, confirmations, images and polling`, async ({ page }) => {
        test.setTimeout(90_000);
        const errors = listen(page);
        let containers = [{ ...container }], images = [{ ...image }], stats = 0;
        const commands = [];
        await page.route('**/api/lmn/docker/**', async (route) => {
            const request = route.request(), path = new URL(request.url()).pathname;
            let data = null;
            if (path.endsWith('/containers')) { stats++; data = containers; }
            else if (path.endsWith('/images')) data = images;
            else if (path.endsWith('/container/p34abc')) data = { Name: 'P34_details', Config: { Hostname: 'synthetic-host' }, Id: 'full-p34-id', Created: '2026-10-24', NetworkSettings: { Networks: { test: { IPAddress: '192.0.2.34' } }, Ports: { '80/tcp': [{ HostPort: '8080' }] } }, Mounts: [{ Source: '/synthetic', Type: 'bind', Destination: '/test' }] };
            else if (path.endsWith('/container_command')) {
                const payload = request.postDataJSON(); commands.push(payload);
                containers = payload.control === 'rm' ? [] : [{ ...container, PIDs: payload.control === 'stop' ? '0' : '1' }];
            } else if (request.method() === 'DELETE') { commands.push({ image: path.split('/').at(-1) }); images = []; }
            await route.fulfill({ json: data });
        });
        await login(page, role);
        await expect(page.locator('a[href^="/view/lmn/docker"]').filter({ visible: true }).first()).toBeVisible();
        await page.goto('/view/lmn/docker');
        const c = row(page, 'P34_synthetic'); await expect(c).toContainText('2MiB');
        await expect(page.locator('th').filter({ hasText: /speicherauslastung/i })).toBeVisible();
        await c.locator('td').first().click();
        const dialog = page.locator('.modal:visible');
        for (const text of ['P34_details', 'synthetic-host', 'full-p34-id', '192.0.2.34', '80/tcp -> 8080', '/synthetic (bind) -> /test']) await expect(dialog).toContainText(text);
        await dialog.getByText(/^(Close|Schließen)$/, { exact: true }).click();
        await action(c, 'stop').click();
        await expect.poll(() => commands).toEqual([{ container_id: 'p34abc', control: 'stop' }]);
        await expect(action(c, 'play')).toBeVisible({ timeout: 12_000 }); await action(c, 'play').click();
        await expect.poll(() => commands.length).toBe(2);
        await expect(action(c, 'stop')).toBeVisible({ timeout: 12_000 });
        await action(c, 'trash').click(); await confirm(page, false); expect(commands.length).toBe(2);
        await action(c, 'trash').click(); await confirm(page, true); await expect.poll(() => commands.length).toBe(3);
        await expect(c).toHaveCount(0, { timeout: 12_000 });
        await tab(page, 'Images').click(); const i = row(page, 'P34_image'); await expect(i).toContainText('3MB');
        const count = stats; await page.waitForTimeout(5500); expect(stats).toBe(count);
        await action(i, 'trash').click(); await confirm(page, false); expect(commands.length).toBe(3);
        await action(i, 'trash').click(); await confirm(page, true); await expect(i).toHaveCount(0);
        expect(commands).toEqual([{ container_id: 'p34abc', control: 'stop' }, { container_id: 'p34abc', control: 'start' }, { container_id: 'p34abc', control: 'rm' }, { image: 'p34image' }]);
        await tab(page, 'Container').click(); await expect.poll(() => stats, { timeout: 12_000 }).toBeGreaterThan(count);
        await page.goto('/view/lmn/landingpage'); const stopped = stats; await page.waitForTimeout(5500); expect(stats).toBe(stopped);
        expect(errors).toEqual([]);
    });
}
test('which failure and empty lists', async ({ page }) => {
    const errors = listen(page); let fail = true;
    await page.route('**/api/lmn/docker/**', (route) => route.fulfill({ status: fail ? 500 : 200, json: fail ? { message: 'synthetic unavailable' } : route.request().url().endsWith('/which') ? null : [] }));
    await login(page, admin); await page.goto('/view/lmn/docker');
    await expect(page.getByText(/Docker is not installed|Docker ist.*nicht/)).toBeVisible();
    fail = false; await page.reload(); await expect(page.getByText(/No container on this host|Kein Container/)).toBeVisible();
    await tab(page, 'Images').click(); await expect(page.getByText(/No docker images|Keine Docker/)).toBeVisible();
    expect(errors.filter((e) => !/500 \(INTERNAL SERVER ERROR\)|500 \(Internal Server Error\)/i.test(e))).toEqual([]);
});
for (const role of [settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: real backend rejects list and command before Docker access`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role); await expect(page.locator('a[href^="/view/lmn/docker"]')).toHaveCount(0);
        for (const url of ['/which', '/containers']) expect((await page.request.get('/api/lmn/docker' + url)).status()).toBe(403);
        expect((await page.request.post('/api/lmn/docker/container_command', { data: { container_id: 'p34abc', control: 'start' } })).status()).toBe(403);
        expect(errors).toEqual([]);
    });
}
