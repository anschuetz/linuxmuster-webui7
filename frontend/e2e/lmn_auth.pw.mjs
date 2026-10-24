import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// Never record passwords, including in failed assertions and action logs.
// Playwright's automatic failure ARIA snapshot can expose the unmasked field.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const endpoint = '/api/lmn/change-password';
const admin = settings.roles.find((r) => r.name === 'global-admin');
const teacher = settings.roles.find((r) => r.name === 'teacher');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, teacher, { name: 'student', login: 'serdarje', pw: admin.pw }];
const change = (page) => page.getByRole('button', { name: /Passwort ändern/ });
const fields = (page) => page.locator('.form-group:visible > input');
const randomPassword = () => `Aj!7${randomBytes(12).toString('hex')}`;
async function input(locator, value) {
    await locator.evaluate((element, text) => {
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
}
function listen(page) {
    const errors = [];
    page.on('pageerror', () => errors.push('pageerror'));
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const { url } = message.location();
        if (/\/api\/core\//.test(url) && message.text().includes('401')) return;
        if (url.endsWith(endpoint) && message.text().includes('500')) return;
        errors.push('console error');
    });
    return errors;
}
async function login(page, role) {
    await page.goto('/');
    await input(page.locator('input[ng\\:model="username"]'), role.login);
    await input(page.locator('input[type="password"][ng\\:model="password"]'), role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
async function open(page) {
    await page.locator('.profile-button').click();
    await page.locator('a[href="/view/lmn/change-password"]').click();
    await expect(change(page)).toBeVisible();
    await expect(page.locator('.alert-info')).toContainText('Alle Felder sind erforderlich');
}
async function fill(page, current, next, repeat = next) {
    for (const [i, value] of [current, next, repeat].entries()) await input(fields(page).nth(i), value);
}
const written = (page) => page.waitForResponse((r) => new URL(r.url()).pathname === endpoint && r.request().method() === 'POST');
for (const role of roles) {
    test(`${role.name}: profile menu, required fields, mismatch and visibility`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role); await open(page);
        await expect(change(page)).toBeDisabled();
        const value = randomPassword();
        await fill(page, value, value, 'different');
        await expect(change(page)).toBeDisabled();
        await expect(page.getByText('Die beiden eingegebenen Passwörter unterscheiden sich')).toBeVisible();
        await input(fields(page).nth(2), value);
        await expect(change(page)).toBeEnabled();
        await page.locator('.fa-eye:visible').click();
        expect(await fields(page).nth(1).getAttribute('type')).toBe('text');
        expect(await fields(page).nth(1).inputValue() === value).toBe(true);
        await page.locator('.fa-eye-slash:visible').click();
        expect(await fields(page).nth(1).getAttribute('type')).toBe('password');
        expect(await fields(page).nth(1).inputValue() === value).toBe(true);
        expect(errors).toEqual([]);
    });
}

test('synthetic teacher: exact masked whitespace, visible ngTrim and permanent failure', async ({ page }) => {
    const errors = listen(page);
    await login(page, teacher); await open(page);
    let matches = false;
    const old = ` ${randomPassword()} `;
    const next = ` ${randomPassword()} `;
    let expected = { password: old, new_password: next };
    await page.route(`**${endpoint}`, async (route) => {
        const body = route.request().postDataJSON();
        matches = JSON.stringify(body) === JSON.stringify(expected);
        await route.fulfill({ status: 500, json: { exception: 'EndpointError', message: 'P46 synthetic failure' } });
    });
    await fill(page, old, next);
    let result = written(page); await change(page).click(); await result;
    expect(matches).toBe(true);
    await page.locator('.fa-eye:visible').click();
    const visible = ` ${randomPassword()} with space `;
    // Input one character at a time, including an inner space.
    await input(fields(page).nth(1), '');
    for (let i = 1; i <= visible.length; i++) await input(fields(page).nth(1), visible.slice(0, i));
    await page.locator('.fa-eye-slash:visible').click();
    expect(await fields(page).nth(1).inputValue() === visible.trim()).toBe(true);
    await input(fields(page).nth(2), visible.trim());
    expected = { password: old, new_password: visible.trim() };
    matches = false;
    result = written(page); await change(page).click(); await result;
    expect(matches).toBe(true);
    const toast = page.locator('.toast-title').filter({ hasText: 'P46 synthetic failure' }).last();
    await expect(toast).toBeVisible();
    await page.waitForTimeout(6000);
    await expect(toast).toBeVisible();
    expect(errors).toEqual([]);
});

test('synthetic teacher: wrong current password, policy failure, change and SSH authentication', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = listen(page);
    await login(page, teacher); await open(page);
    const next = randomPassword();
    await fill(page, randomPassword(), next);
    let result = written(page); await change(page).click();
    expect((await result).ok()).toBe(false);
    await expect(page.locator('.toast-title').filter({ hasText: /Passwortänderung fehlgeschlagen|Password change failed/ }).last()).toBeVisible();
    await expect(page.locator('.toast-title').filter({ hasText: 'Wrong password' })).toBeVisible();
    await fill(page, teacher.pw, 'x');
    result = written(page); await change(page).click(); expect((await result).ok()).toBe(false);
    await expect(page.locator('.toast-title').filter({ hasText: 'Password does not meet requirements:' })).toBeVisible();
    function authenticates(password) {
        const script = "import json,sys,subprocess,ldap\nu,p=json.load(sys.stdin)\nrealm=subprocess.check_output(['testparm','-s','--parameter-name=realm'],stderr=subprocess.DEVNULL).decode().strip()\ntry:\n c=ldap.initialize('ldap://localhost');c.set_option(ldap.OPT_REFERRALS,0);c.simple_bind_s(u+'@'+realm,p);c.unbind_s();print(True)\nexcept ldap.LDAPError:\n print(False)";
        const encoded = Buffer.from(script).toString('base64');
        return execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', `/opt/linuxmuster/bin/python -c "import base64;exec(base64.b64decode('${encoded}'))"`], { input: JSON.stringify([teacher.login, password]), encoding: 'utf8' }).trim() === 'True';
    }
    expect(authenticates(next)).toBe(false);
    expect(authenticates(teacher.pw)).toBe(true);
    await fill(page, teacher.pw, next);
    result = written(page); await change(page).click();
    expect((await result).ok()).toBe(true);
    await expect(page).toHaveURL(/\/view\/lmn\/landingpage$/);
    expect(authenticates(next)).toBe(true);
    // E also accepts the previous password briefly; prove the new one changed instead.
    expect(errors).toEqual([]);
    // Reset set E immediately afterwards; no other role's password is changed.
});
