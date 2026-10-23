import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// Only set E. The caller reserves/resets E1-bereit before and after each old/new run.
const csv = '/etc/linuxmuster/sophomorix/default-school/devices.csv';
const roles = [settings.roles[0], { name: 'school-admin', login: 'pgmadmin', pw: settings.roles[0].pw }];
const host = 'ajp17pc';
const synthetic = { room: 'ajp17', hostname: host, group: 'p17group', mac: '02:17:00:00:00:01', ip: '10.0.0.217' };
const translate = {
    add: /^(Add a device|Gerät hinzufügen)$/, accept: /^(Add|Hinzufügen)$/,
    save: /^(Save|Speichern)$/, apply: /^(Save & import|Speichern & importieren)$/,
    edit: /^(Edit CSV|CSV bearbeiten|Im Editor öffnen)$/, close: /^(Close|Schließen)$/, cancel: /^(Cancel|Abbrechen)$/,
};
const action = (page, name) => page.getByText(translate[name]);
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    const school = page.waitForResponse('**/api/lmn/activeschool');
    const devices = page.waitForResponse('**/api/lmn/devices');
    const groups = page.waitForResponse('**/api/lmn/linbo4/groups');
    await page.goto('/view/lmn/devices');
    expect((await school).status()).toBe(200);
    expect(await (await school).json()).toBe('default-school');
    expect((await groups).status()).toBe(200);
    const response = await devices;
    expect(response.status()).toBe(200);
    await expect(page).toHaveTitle(/Devices|Geräte/);
    await expect(page.locator('table.lm-table')).toBeVisible();
    // E1-bereit uses German. These were translate directives and must update when
    // the asynchronously loaded catalog becomes available, without user interaction.
    await expect(page.locator('button:has(.fa-plus)')).toContainText('Gerät hinzufügen');
    await expect(page.locator('button').filter({ hasText: /Fields|Felder/ })).toContainText('Felder');
    await expect(action(page, 'save')).toHaveText('Speichern');
    return response.json();
}
async function dialogAdd(page, values) {
    const dialog = page.locator('.modal:visible').last();
    await expect(dialog).toBeVisible();
    for (const [i, value] of Object.values(values).entries()) await dialog.locator('input[type="text"]').nth(i).fill(value);
    await action(dialog, 'accept').click();
    await expect(dialog).toBeHidden();
}
for (const role of roles) {
    test(`${role.name}: real devices list, add/duplicate/remove, validation, CSV, dialogs`, async ({ page }) => {
        test.setTimeout(90_000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const original = await login(page, role);
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        expect(original.every((d) => d.room !== undefined)).toBe(true);
        // Filter away existing rows while adding, so validation only sees the synthetic device.
        await page.locator('input[type="search"]').fill(host);
        await expect(page.locator('table.lm-table input[placeholder="Hostname"]')).toHaveCount(0);
        await action(page, 'add').click();
        await dialogAdd(page, { ...synthetic, mac: 'invalid' });
        const row = page.locator('table.lm-table tr').filter({ has: page.locator('input[placeholder="Hostname"]') });
        await expect(row).toHaveCount(1);
        await action(page, 'save').click();
        await expect(page.locator('#error_messages')).toContainText(/invalid/);
        await expect(row.locator('.has-error-new')).not.toHaveCount(0);
        await row.locator('input[placeholder="MAC"]').fill(synthetic.mac);
        await row.locator('input[placeholder="IP"]').click();
        // Duplicate and remove the synthetic row without changing original entries.
        await row.locator('button:has(.fa-copy)').click();
        const dialog = page.locator('.modal:visible').last();
        await expect(dialog.locator('input[type="text"]').nth(1)).toHaveValue(host);
        await action(dialog, 'accept').click();
        await expect(row).toHaveCount(2);
        await row.last().locator('button:has(.fa-trash-o)').click();
        await expect(row).toHaveCount(1);
        const saved = page.waitForResponse((r) => r.url().endsWith('/api/lmn/devices') && r.request().method() === 'POST');
        await action(page, 'save').click();
        expect((await saved).status()).toBe(200);
        const content = execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', `cat ${csv}`], { encoding: 'utf8', timeout: 30_000 });
        expect(content).toContain(`ajp17;${host};p17group;02:17:00:00:00:01;10.0.0.217;`);
        // The legacy dialog immediately starts import. Intercept ONLY import/log to open it safely;
        // no linuxmuster-import-devices process or generated system configuration is changed.
        await page.route('**/api/lmn/devices/import', (route) => route.fulfill({ json: null }));
        await page.route('**/api/lmn/log/tmp/import_devices.log?*', (route) => route.fulfill({ json: 'P17 import dialog oracle\n' }));
        await action(page, 'apply').click();
        const apply = page.locator('.modal:visible').last();
        await expect(apply).toContainText(/Importing device|Importiere Gerät/i);
        await expect(apply.locator('pre')).toContainText('P17 import dialog oracle');
        await action(apply, 'close').click();
        await action(page, 'edit').click();
        const editor = page.locator('.modal:visible').last();
        await expect(editor).toContainText('devices.csv');
        await action(editor, 'cancel').click();
        await page.locator('.fa-history').locator('..').click();
        const backups = page.locator('.modal:visible').last();
        await expect(backups).toContainText(/Backup|Sicherung/);
        await action(backups, 'close').click();
        expect(errors).toEqual([]);
        // Remove the synthetic CSV row through the actual UI, leaving original entries intact.
        await row.locator('button:has(.fa-trash-o)').click();
        const cleanup = page.waitForResponse((r) => r.url().endsWith('/api/lmn/devices') && r.request().method() === 'POST');
        await action(page, 'save').click(); expect((await cleanup).status()).toBe(200);
    });

    test(`${role.name}: comment filter, numeric IP sort, field selection and pagination`, async ({ page }) => {
        test.setTimeout(90_000);
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        const fixture = [ { room: '# P17 comment' }, ...Array.from({ length: 105 }, (_, i) => ({
            ...synthetic, hostname: `p17pc${i}`, group: i === 0 ? '-g' : i === 1 ? '_g' : synthetic.group, ip: `10.0.0.${105 - i}`, _isNew: false,
            sophomorixRole: 'classroom-studentcomputer', pxeFlag: '0',
        })) ];
        await page.route('**/api/lmn/devices', (route) => route.fulfill({ json: fixture }));
        await login(page, role);
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        await expect(page.locator('table.lm-table input[placeholder="Hostname"]')).toHaveCount(100);
        await page.locator('button').filter({ hasText: /Room|Raum/ }).click();
        await page.locator('ul.dropdown-menu a').filter({ hasText: /Group|Gruppe/ }).click();
        await expect(page.locator('table.lm-table input[placeholder="Group"]').first()).toHaveValue('-g');
        await page.locator('button').filter({ hasText: /Group|Gruppe/ }).click();
        await page.locator('ul.dropdown-menu a').filter({ hasText: /IP/ }).click();
        await expect(page.locator('table.lm-table input[placeholder="IP"]').first()).toHaveValue('10.0.0.1');
        await page.locator('button').filter({ hasText: /Rows|Zeilen/ }).click();
        await page.locator('ul.dropdown-menu a').filter({ hasText: /\b10\s*$/ }).click();
        await expect(page.locator('table.lm-table input[placeholder="Hostname"]')).toHaveCount(10);
        await page.locator('ul.pagination a').filter({ hasText: /^2$/ }).click();
        await expect(page.locator('table.lm-table input[placeholder="IP"]').first()).toHaveValue('10.0.0.11');
        if (process.env.P17_SCREENSHOT_PREFIX) await page.screenshot({ path: resolve(process.env.P17_SCREENSHOT_PREFIX + '-' + role.name + '.png'), fullPage: true });
        await page.locator('button').filter({ hasText: /Fields|Felder/ }).click();
        // Both legacy custom-checkbox and Vue native-checkbox expose a clickable label/text.
        await page.locator('ul.dropdown-menu').getByText('Office Key', { exact: true }).click();
        await expect(page.locator('table.lm-table th').filter({ hasText: /^Office Key$/ })).toBeVisible();
        expect(errors).toEqual([]);
    });
}
