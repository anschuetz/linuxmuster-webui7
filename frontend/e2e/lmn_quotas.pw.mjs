import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
const admin = settings.roles.find((r) => r.name === 'global-admin');
const response = (page, path, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === method);
const tab = (page, name) => page.locator('.nav-tabs').getByText(name, { exact: true });
const visibleTable = (page) => page.locator('table:visible').first();
const toolbar = (page, name) => page.locator('floating-toolbar').getByText(name, { exact: true });
function listen(page, denied = false) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        const url = m.location().url;
        if (m.text().includes('401') && /\/api\/core\//.test(url)) return;
        if (denied && m.text().includes('403') && /\/api\/lmn\/(quota|ldap-search)/.test(url)) return;
        errors.push(m.text());
    });
    return errors;
}
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
async function open(page) {
    const loaded = response(page, '/api/lmn/quota/quotas');
    await page.goto('/view/lmn/quotas');
    const r = await loaded;
    expect(r.status()).toBe(200);
    await expect(page.locator('.nav-tabs > li > a')).toHaveText(['Lehrer', 'Schüler', 'Schul-Administratoren', 'Klassen', 'Projekte', 'Quota-Prüfung']);
    return r.json();
}
async function search(page, text) {
    const input = page.locator('input[type="text"]:visible').last();
    const found = response(page, '/api/lmn/ldap-search', 'POST');
    await input.fill(text);
    const r = await found;
    expect(r.status()).toBe(200);
    const results = await r.json();
    expect(results.length).toBeGreaterThan(0);
    const user = results.find((u) => u.login === text) || results[0];
    await page.getByRole('option').filter({ hasText: user.label }).click();
    return user;
}
for (const role of [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }]) {
    test(`${role.name}: real read, LDAP add/remove, save and apply with LDAP proof`, async ({ page }) => {
        test.setTimeout(180000);
        const errors = listen(page);
        await login(page, role);
        const initial = await open(page);
        const userRole = role.name === 'global-admin' ? 'teacher' : 'student';
        const userLogin = userRole === 'teacher' ? 'zem' : 'serdarje';
        const userTab = userRole === 'teacher' ? 'Lehrer' : 'Schüler';
        const groupsLoaded = response(page, '/api/lmn/quota/groups');
        await tab(page, 'Klassen').click();
        const groups = await (await groupsLoaded).json();
        await expect(visibleTable(page)).toContainText('5a');
        const groupValue = Number(groups.adminclass['5a'].QUOTA['default-school'].value) + 11;
        await visibleTable(page).locator('tr').filter({ hasText: '5a' }).locator('input[type=number]').nth(1).fill(String(groupValue));
        await tab(page, 'Projekte').click();
        await expect(visibleTable(page).locator('tr')).toHaveCount(1);
        await tab(page, userTab).click();
        await toolbar(page, /^(Search & add user|Benutzer suchen.*)$/).click();
        const added = await search(page, userLogin);
        const row = visibleTable(page).locator('tr').filter({ hasText: added.displayName });
        await expect(row).toBeVisible();
        await row.getByRole('button').click();
        await expect(row).toHaveCount(0);
        await open(page); // removal and class edit unsaved
        const reloadedGroups = response(page, '/api/lmn/quota/groups');
        await tab(page, 'Klassen').click();
        await reloadedGroups;
        await visibleTable(page).locator('tr').filter({ hasText: '5a' }).locator('input[type=number]').nth(1).fill(String(groupValue));
        await tab(page, userTab).click();
        await toolbar(page, /^(Search & add user|Benutzer suchen.*)$/).click();
        const secondAdded = await search(page, userLogin);
        const editRow = visibleTable(page).locator('tr').filter({ hasText: secondAdded.displayName });
        const value = Number(initial[1][`role.${userRole}`].QUOTA_DEFAULT_GLOBAL) + 17;
        await editRow.locator('input[type="number"]').first().fill(String(value));
        const saved = response(page, '/api/lmn/quota/save', 'POST');
        const applied = response(page, '/api/lmn/quota/apply', 'POST');
        await toolbar(page, /^(Save & apply|Speichern.*Übernehmen)$/).click();
        const result = await saved;
        expect(result.status()).toBe(200);
        expect(result.request().postDataJSON()).toEqual({ users: { teacher: {}, student: {}, schooladministrator: {}, [userRole]: { [`${userLogin}_QUOTA_DEFAULT_GLOBAL`]: { login: userLogin, quota: 'QUOTA_DEFAULT_GLOBAL', value } } }, groups: { adminclass: { '5a_default-school': { group: '5a', quota: 'default-school', type: 'adminclass', value: groupValue } }, project: {} } });
        expect((await applied).status()).toBe(200);
        expect(ssh(`ldbsearch -H /var/lib/samba/private/sam.ldb '(sAMAccountName=${userLogin})' sophomorixQuota`)).toContain(`sophomorixQuota: linuxmuster-global:${value}:`);
        expect(ssh("ldbsearch -H /var/lib/samba/private/sam.ldb '(cn=5a)' sophomorixQuota")).toContain(`sophomorixQuota: default-school:${groupValue}:`);
        await expect(page.locator('.modal:visible')).toContainText(/(Applying changes|Änderungen werden übernommen|Änderungen übernehmen)/);
        await expect(page.locator('.modal:visible pre')).not.toBeEmpty({ timeout: 20000 });
        const refreshed = response(page, '/api/lmn/quota/quotas');
        await page.locator('.modal:visible').getByText(/^(Close|Schließen)$/, { exact: true }).click();
        const persisted = await (await refreshed).json();
        await tab(page, userTab).click();
        const persistedRow = visibleTable(page).locator('tr').filter({ hasText: persisted[0][userRole][userLogin].displayName });
        await expect(persistedRow.locator('input[type="number"]').first()).toHaveValue(String(value));
        await tab(page, 'Quota-Prüfung').click();
        const checked = response(page, `/api/lmn/quota/check/${userLogin}`);
        await search(page, userLogin);
        const checkResult = await checked;
        expect(checkResult.status()).toBe(200);
        const usage = await checkResult.json();
        await expect(visibleTable(page)).toContainText(String(usage.total));
        expect(errors).toEqual([]);
    });
}
// Projects are absent on E. These exact fixtures run on both implementations.
test('fixture: projects, quota check, reset and apply log', async ({ page }) => {
    const errors = listen(page);
    await login(page, admin);
    await page.route('**/api/lmn/quota/groups', (route) => route.fulfill({ json: { adminclass: {}, project: { 'p38-project': { QUOTA: { 'linuxmuster-global': { value: 5 }, 'default-school': { value: 6 }, mailquota: { value: 7 } } } } } }));
    await page.route('**/api/lmn/ldap-search', (route) => route.fulfill({ json: [{ login: 'p38-user', label: 'P38 User', role: 'teacher', displayName: 'P38 User' }] }));
    await page.route('**/api/lmn/quota/check/p38-user', (route) => route.fulfill({ json: { directories: { '/home/p38': { total: '12 MiB' } }, total: '12 MiB' } }));
    await page.route('**/api/lmn/quota/save', (route) => route.fulfill({ json: null }));
    // Avoid failed HTTP console events: adapter HTTP policy is separately covered by unit tests.
    await page.route('**/api/lmn/quota/apply', (route) => route.fulfill({ json: null }));
    await page.route('**/api/lmn/log/tmp/apply-sophomorix.log?*', (route) => route.fulfill({ body: 'P38 fixture log\n' }));
    await open(page);
    await tab(page, 'Projekte').click();
    const row = visibleTable(page).locator('tr').filter({ hasText: 'p38-project' });
    await row.getByRole('button').click();
    expect(await row.locator('input').evaluateAll((inputs) => inputs.map((i) => i.value))).toEqual(['0', '0', '0']);
    const saved = response(page, '/api/lmn/quota/save', 'POST');
    await toolbar(page, /^(Save & apply|Speichern.*Übernehmen)$/).click();
    const body = (await saved).request().postDataJSON();
    expect(body.groups.project).toEqual(Object.fromEntries(['linuxmuster-global', 'default-school', 'mailquota'].map((quota) => [`p38-project_${quota}`, { group: 'p38-project', quota, type: 'project', value: '---' }])));
    await page.locator('.modal:visible').getByText(/^(Close|Schließen)$/, { exact: true }).click();
    await tab(page, 'Quota-Prüfung').click();
    await search(page, 'p38');
    await expect(visibleTable(page)).toContainText('/home/p38');
    await expect(visibleTable(page)).toContainText('12 MiB');
    expect(errors).toEqual([]);
});
for (const role of [settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: administration denied; own quota allowed and foreign denied`, async ({ page }) => {
        const errors = listen(page, true);
        await login(page, role);
        await expect(page.locator('a[href="/view/lmn/quotas"]')).toHaveCount(0);
        const loaded = response(page, '/api/lmn/quota/quotas');
        await page.goto('/view/lmn/quotas');
        expect((await loaded).status()).toBe(403);
        for (const path of ['quotas', 'groups', 'check/zem']) expect((await page.request.get(`/api/lmn/quota/${path}`)).status()).toBe(403);
        expect((await page.request.post('/api/lmn/quota/save', { data: { users: {}, groups: {} } })).status()).toBe(403);
        expect((await page.request.post('/api/lmn/quota/apply')).status()).toBe(403);
        expect((await page.request.post('/api/lmn/ldap-search', { data: { role: '', login: 'zem' } })).status()).toBe(403);
        expect((await page.request.get(`/api/lmn/quota/user/${role.login}`)).status()).toBe(200);
        expect((await page.request.get('/api/lmn/quota/user/global-admin')).status()).toBe(403);
        expect(errors).toEqual([]);
    });
}
