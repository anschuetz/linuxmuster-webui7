import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
test.setTimeout(90000);
const base = '/api/lmn/device-manager/', admin = settings.roles[0];
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles[1], { name: 'student', login: 'serdarje', pw: admin.pw }];
const ssh = (cmd, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', cmd], { input, encoding: 'utf8', timeout: 30000 });
const file = '/srv/linbo/linbocmd/p128-client.cmd';
const device = { room: 'p128-room', hostname: 'p128-client', group: 'p128-group', mac: '02:00:00:00:01:28', ip: '192.0.2.128', type: 'classroom-studentcomputer', os: 'Linbo', online: 'down', checked: false, remoteBlock: false, school: 'default-school' };
const modal = p => p.locator('.modal:visible').last();
async function login(p, role) {
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text()); });
    await p.goto('/');
    await p.locator('input[ng\\:model=username]').fill(role.login);
    await p.locator('input[type=password][ng\\:model=password]').fill(role.pw);
    await p.locator('a[ng\\:click^="login"]').click();
    await expect(p.locator('input[ng\\:model=username]')).toBeHidden();
    await p.waitForLoadState('networkidle');
    return errors;
}
async function open(p) {
    await p.evaluate(() => { const i = angular.element(document.body).injector(); i.get('$rootScope').$apply(() => i.get('$location').path('/view/lmn/device-manager')); });
    await p.waitForURL('**/view/lmn/device-manager');
}
async function option(p, name) {
    if (!await p.locator('.lmp_deviceBoxSM .dropdown-menu:visible').count()) await p.locator('.lmp_deviceBoxSM button:has(.fa-bars)').click();
    await p.locator('.lmp_deviceBoxSM .dropdown-item:not(.disabled):visible').getByText(name, { exact: true }).click();
}
for (const role of roles) {
    const allowed = ['global-admin', 'school-admin'].includes(role.name);
    test(`${role.name}: actual permissions and devices contract`, async ({ page }) => {
        const errors = await login(page, role);
        const res = await page.request.post(base + 'getdevices', { data: { filepath: '/etc/linuxmuster/sophomorix/default-school/devices.csv', school: 'default-school' } });
        expect(res.status()).toBe(allowed ? 200 : 403);
        console.log(role.name, 'getdevices', res.status(), allowed ? (await res.json()).length : 'denied');
        if (!allowed) {
            await expect(page.locator('a[href="/view/lmn/device-manager"]:visible')).toHaveCount(0);
            for (const action of ['start', 'shutdown', 'reboot', 'removePrestartCommands', 'editPrestartCommands']) {
                expect((await page.request.post(base + action, { data: { device, preStartCommand: { name: 'p128-client', path: file, content: 'sync:1' }, newCommand: 'start:1' } })).status()).toBe(403);
            }
        } else {
            expect((await page.request.post(base + 'run', { data: { command: '' } })).status()).toBe(404);
            for (const action of ['getlinboconfig', 'getlinboremotelog']) {
                const missing = await page.request.post(base + action, { data: { device } });
                expect(missing.status()).toBe(200); expect(await missing.json()).toBe(null);
            }
            await open(page);
            await expect(page.locator('#sideBar')).toContainText('default-school');
            await expect(page.locator('#siteContent .alert-info:visible')).toContainText(/Please select|Bitte/);
        }
        expect(errors).toEqual([]);
    });
    if (!allowed) continue;
    test(`${role.name}: room/status, dialogs, actions and actual prestart edit/delete`, async ({ page }) => {
        const errors = await login(page, role), actions = [];
        ssh('mkdir -p /srv/linbo/linbocmd; cat > ' + file, 'sync:1');
        await page.route('**' + base + '*', async r => {
            const action = new URL(r.request().url()).pathname.slice(base.length);
            if (['start', 'shutdown', 'reboot'].includes(action)) {
                actions.push({ action, data: r.request().postDataJSON() });
                return r.fulfill({ json: { status: action !== 'reboot', message: 'P128 synthetic target: no physical client on E', exitcode: 0 } });
            }
            const values = { getdevices: [device], checkOnline: 'down', checkOS: 'Linbo', getlinboconfig: [{ BaseImage: 'p128.qcow2' }], getlastsync: { date: 'Never', status: 'danger' }, getrunninglinboremotecommands: [{ id: '1', hostname: 'p128-client', startdate: '24.10.2026', starttime: '10:00' }], getlinboremotelog: 'P128 synthetic log' };
            if (action in values) return r.fulfill({ json: values[action] });
            return r.continue();
        });
        try {
            await open(page);
            await page.locator('#sideBar div').filter({ hasText: /p128-room/ }).last().locator('input').check();
            const card = page.locator('.lmp_deviceBoxSM');
            await expect(card).toContainText('p128-client'); await expect(card.locator('#OSArea [title=Linbo]:visible')).toBeVisible();
            for (const name of [/(Start|Beginn)$/, /(Shutdown|Herunterfahren)$/, /(Reboot|Neustarten|Neustart)$/]) await option(page, name);
            await card.locator('input[type=checkbox]').check();
            const selection = page.locator('.floating-toolbar, floating-toolbar').getByRole('button', { name: /0 (devices selected|ausgewählte Geräte)/ });
            await expect(selection).toBeVisible(); await selection.click();
            for (const name of [/(Start|Beginn)$/, /(Shutdown|Herunterfahren)$/, /(Reboot|Neustarten|Neustart)$/]) {
                await page.locator('.floating-toolbar, floating-toolbar').getByRole('button', { name, exact: true }).click();
                await expect(modal(page).getByText(/^(Finished!|Beendet!)$/)).toBeVisible();
                await modal(page).getByRole('button', { name: /Close|Schließen/, exact: true }).click();
            }
            expect(actions.map(x => x.action)).toEqual(['start', 'shutdown', 'reboot', 'start', 'shutdown', 'reboot']);
            expect(actions.map(({ data }, i) => data)).toEqual(actions.map((_, i) => ({ device: { ...device, checked: i >= 3 } })));
            for (const prestart of [false, true]) {
                await option(page, prestart ? /Linbo-Remote \(Prestart\)$/ : /Linbo-Remote$/);
                await expect(modal(page)).toContainText('p128.qcow2'); await expect(modal(page)).toContainText('Never');
                await modal(page).getByText('Format', { exact: true }).click();
                await expect(modal(page)).toContainText(`linbo-remote -s default-school -i p128-client ${prestart ? '-p' : '-c'} format`);
                await modal(page).getByText(/Cancel|Abbrechen/, { exact: true }).click();
            }
            await page.getByText(/^(LR-Processes|LR-Prozesse)$/, { exact: true }).click();
            await modal(page).getByText('Show', { exact: true }).click();
            await expect(modal(page).locator('textarea')).toHaveValue('P128 synthetic log');
            await modal(page).getByRole('button', { name: /Close|Schließen/, exact: true }).click();
            await page.getByText(/^(LR-Prestart's|LR-Prestarts)$/, { exact: true }).click();
            const row = modal(page).locator('tr').filter({ hasText: 'p128-client' });
            await row.getByText('Edit', { exact: true }).click();
            const prompt = page.locator('dialog.messagebox:visible'); await prompt.locator('input').fill('  sync:1,start:1  ');
            const edited = page.waitForResponse(r => r.url().endsWith('/editPrestartCommands'));
            await prompt.locator('.positive').click(); expect((await edited).status()).toBe(200);
            expect(ssh('cat ' + file)).toBe('sync:1,start:1'); await expect(row).toContainText('sync:1,start:1');
            const deleted = page.waitForResponse(r => r.url().endsWith('/removePrestartCommands'));
            await row.getByText('Delete', { exact: true }).click(); expect((await deleted).status()).toBe(200);
            expect(ssh('test ! -e ' + file + ' && echo absent').trim()).toBe('absent');
            await modal(page).getByRole('button', { name: /Close|Schließen/, exact: true }).click(); expect(errors).toEqual([]);
        } finally { ssh('rm -f ' + file); }
    });
}
