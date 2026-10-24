import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// Set E only. Both original crontabs are restored even if a test fails.
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { input, encoding: 'utf8', timeout: 30_000 });
const readTabs = () => Object.fromEntries(['global-admin', 'root'].map((user) => [user, ssh(`crontab -l -u ${user} 2>/dev/null || true`)]));
const empty = () => ({ normal_tasks: [], special_tasks: [], env_settings: [] });
const admin = settings.roles.find((role) => role.name === 'global-admin');
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
const response = (page) => page.waitForResponse((r) => new URL(r.url()).pathname === '/api/lmn/crontab');
async function open(page) {
    const loaded = response(page);
    await page.goto('/view/lmn/crontab');
    expect((await loaded).status()).toBe(200);
    await expect(page).toHaveTitle(/Cron/);
}
const field = (page, name) => page.locator(`form:visible [name="${name}"], form:visible [ng\\:model="modifyJob.job.${name}"]`);
const tab = (page, name) => page.locator('.nav-tabs').getByText(name, { exact: true });
const addButton = (page) => page.getByRole('button', { name: /^(Add|Hinzufügen)$/ }).filter({ visible: true });
const row = (page, text) => page.locator('table:visible tr').filter({ hasText: text });
async function save(page) {
    const saved = response(page);
    await page.getByRole('button', { name: /^(Save|Speichern)$/ }).click();
    expect((await saved).status()).toBe(200);
}

test('global-admin: both crontabs, forms, holidays, persistence and removal', async ({ page }) => {
    test.setTimeout(120_000);
    const original = readTabs();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
        // An inert annual job, a special job and a variable in each account.
        for (const user of ['global-admin', 'root']) ssh(`crontab -u ${user} -`, `# P28 baseline\n17 3 31 2 * /usr/sbin/linuxmuster-holiday -s default-school && /bin/true P28_BASE_${user}\n`);
        await login(page, admin);
        page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
        await expect(page.locator('a[href^="/view/lmn/crontab"]').filter({ visible: true }).first()).toBeVisible();
        await open(page);
        // E1-bereit uses German; wait for the catalog without user interaction.
        await expect(page.locator('.nav-tabs > li > a')).toHaveText(['Aufträge', 'Speziell', 'Umgebungsvariablen']);
        const userSelect = page.locator('select').first();
        for (const user of ['globaladministrator', 'root']) {
            await userSelect.selectOption(user);
            const base = row(page, `P28_BASE_${user === 'root' ? 'root' : 'global-admin'}`);
            await expect(base).toContainText('default-school');
            for (const value of ['17', '3', '31', '2', '*']) await expect(base).toContainText(value);
            await base.getByTitle('Modify').click();
            await expect(field(page, 'comment')).toHaveValue(' P28 baseline');
            await expect(field(page, 'command')).toHaveValue(/P28_BASE/);
            await page.getByRole('button', { name: /^(Cancel|Abbrechen)$/ }).filter({ visible: true }).click();
            await addButton(page).click();
            await field(page, 'minute').fill('19');
            await field(page, 'day_of_month').fill('31');
            await field(page, 'month').fill('2');
            await field(page, 'command').pressSequentially(`/bin/true P28_JOB_${user}`);
            await expect(field(page, 'command')).toHaveValue(`/bin/true P28_JOB_${user}`);
            await field(page, 'comment').fill('P28 normal');
            await page.locator('form:visible input[type=checkbox]').check();
            await page.getByRole('button', { name: 'OK', exact: true }).filter({ visible: true }).click();
            await tab(page, /^(Special|Speziell)$/).click();
            await addButton(page).click();
            await field(page, 'special').selectOption({ label: '@yearly' });
            await field(page, 'command').fill(`/bin/true P28_SPECIAL_${user}`);
            await field(page, 'comment').fill('P28 special');
            await page.getByRole('button', { name: 'OK', exact: true }).filter({ visible: true }).click();
            await tab(page, /^(Environment variables|Umgebungsvariablen)$/).click();
            await addButton(page).click();
            await field(page, 'name').fill('P28_TEST');
            await field(page, 'value').fill(`synthetic_${user}`);
            await field(page, 'comment').fill('P28 environment');
            await page.getByRole('button', { name: 'OK', exact: true }).filter({ visible: true }).click();
            await tab(page, /^(Jobs|Aufträge)$/).click();
        }
        await save(page);
        const written = readTabs();
        for (const [user, content] of Object.entries(written)) {
            const key = user === 'root' ? 'root' : 'globaladministrator';
            expect(content).toContain(`P28_BASE_${user}`);
            expect(content).toMatch(new RegExp(`19 \\* 31 2 \\* /usr/sbin/linuxmuster-holiday\\s+-s default-school && /bin/true P28_JOB_${key}`));
            expect(content).toContain(`@yearly /bin/true P28_SPECIAL_${key}`);
            expect(content).toContain(`P28_TEST=synthetic_${key}`);
            for (const comment of ['P28 normal', 'P28 special', 'P28 environment']) expect(content).toContain(comment);
        }
        await open(page);
        for (const user of ['globaladministrator', 'root']) {
            await userSelect.selectOption(user);
            const added = row(page, `P28_JOB_${user}`);
            await expect(added).toContainText('default-school');
            await added.getByTitle('Modify').click();
            await expect(page.locator('form:visible input[type=checkbox]')).toBeChecked();
            await expect(field(page, 'comment')).toHaveValue('P28 normal');
            await page.getByRole('button', { name: /^(Cancel|Abbrechen)$/ }).filter({ visible: true }).click();
            await added.getByTitle('Remove').click();
            await tab(page, /^(Special|Speziell)$/).click();
            await row(page, `P28_SPECIAL_${user}`).getByTitle('Remove').click();
            await tab(page, /^(Environment variables|Umgebungsvariablen)$/).click();
            await row(page, 'P28_TEST').getByTitle('Remove').click();
            await tab(page, /^(Jobs|Aufträge)$/).click();
        }
        await save(page);
        const removed = readTabs();
        for (const [user, content] of Object.entries(removed)) {
            expect(content).toContain(`P28_BASE_${user}`);
            expect(content).toContain('linuxmuster-holiday');
            expect(content).not.toMatch(/P28_JOB|P28_SPECIAL|P28_TEST/);
        }
        expect(errors).toEqual([]);
    } finally {
        for (const [user, content] of Object.entries(original)) {
            if (content) ssh(`crontab -u ${user} -`, content);
            else ssh(`crontab -r -u ${user} 2>/dev/null || true`);
        }
        expect(readTabs()).toEqual(original);
    }
});

for (const role of [
    { name: 'school-admin', login: 'pgmadmin', pw: admin.pw },
    settings.roles.find((r) => r.name === 'teacher'),
    { name: 'student', login: 'serdarje', pw: admin.pw },
]) {
    test(`${role.name}: no sidebar or API access; crontabs unchanged`, async ({ page }) => {
        const original = readTabs();
        await login(page, role);
        await expect(page.locator('a[href^="/view/lmn/crontab"]')).toHaveCount(0);
        const loaded = response(page);
        await page.goto('/view/lmn/crontab');
        expect((await loaded).status()).toBe(403);
        await expect(page.getByRole('button', { name: /^(Save|Speichern)$/ })).toHaveCount(0);
        const result = await page.request.post('/api/lmn/crontab', { data: { globaladministrator: empty(), root: empty() } });
        expect(result.status()).toBe(403);
        expect(readTabs()).toEqual(original);
    });
}
