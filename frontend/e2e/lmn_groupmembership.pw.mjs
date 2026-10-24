import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
const base = '/api/lmn/groupmembership/';
const admin = settings.roles.find((r) => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const response = (page, path, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === method);
const message = (page) => page.locator('dialog.messagebox:visible').last();
const modal = (page) => page.locator('.modal:visible').last();
function listen(page) {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !(m.text().includes('401') && /\/api\/core\//.test(m.location().url))) errors.push(m.text()); });
    return errors;
}
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    const auth = response(page, '/api/core/auth', 'POST');
    await page.locator('a[ng\\:click^="login"]').click(); expect((await auth).status()).toBe(200);
    await page.waitForURL('**/view/**'); await page.waitForLoadState('networkidle');
}
async function open(page) {
    await page.evaluate(() => { const i = angular.element(document.body).injector(); i.get('$rootScope').$apply(() => i.get('$location').path('/view/lmn/groupmembership')); });
    await page.waitForURL('**/view/lmn/groupmembership');
}
const group = (name, type = 'project', changes = {}) => ({ groupname: name, cn: name, description: name, type: type === 'adminclass' ? 'schoolclass' : type === 'printer' ? 'printergroup' : 'project', sophomorixType: type, membership: false, admin: false, members: [], sophomorixMembers: [], sophomorixAdmins: [], sophomorixMemberGroups: [], sophomorixAdminGroups: [], sophomorixJoinable: true, sophomorixHidden: false, no_admin: true, ...changes });
const detail = (g) => ({ GROUP: { [g.groupname]: { ...g, sophomorixJoinable: 'TRUE', sophomorixHidden: 'FALSE', sophomorixMailList: 'FALSE', sophomorixCreationDate: '20261023090000.0Z', sophomorixSchoolname: 'default-school', sophomorixStatus: 'P' } }, MEMBERS: { [g.groupname]: {} }, LISTS: { MEMBERLIST: { [g.groupname]: [] } } });
async function fixtures(page) {
    await page.route('**/api/lmn/groupmembership/projects', (r) => r.fulfill({ json: [group('p73-alpha'), group('p73-zeta', 'project', { membership: true }), group('p73-hidden', 'project', { sophomorixHidden: true })] }));
    await page.route('**/api/lmn/groupmembership/schoolclasses', (r) => r.fulfill({ json: [group('p73-class', 'adminclass')] }));
    await page.route('**/api/lmn/groupmembership/printers', (r) => r.fulfill({ json: [group('p73-printer', 'printer')] }));
    await page.route('**/api/lmn/groupmembership/groups/*', (r) => { const name = new URL(r.request().url()).pathname.split('/').at(-1); return r.fulfill({ json: detail(group(name, name === 'p73-class' ? 'adminclass' : name === 'p73-printer' ? 'printer' : 'project')) }); });
}
for (const role of roles) test(`${role.name}: real lists, detail authorization and sidebar`, async ({ page }) => {
    const errors = listen(page); await login(page, role); const allowed = role.name !== 'student';
    await expect(page.locator('a[href^="/view/lmn/groupmembership"]:visible')).toHaveCount(allowed ? 1 : 0);
    for (const path of ['projects', 'printers', 'schoolclasses', 'groups/5a']) {
        const result = await page.request.get(base + path); expect(result.status()).toBe(allowed ? 200 : 403);
        if (allowed && path !== 'groups/5a') expect(Array.isArray(await result.json())).toBe(true);
    }
    if (allowed) { await open(page); await expect(page.locator('h3').filter({ hasText: /Schoolclasses|Schulklassen/ })).toBeVisible(); }
    expect(errors).toEqual([]);
});
for (const role of roles.slice(0, 3)) {
    test(`${role.name}: fixtures, ngTrim, self membership and refresh cancellation`, async ({ page }) => {
        const errors = listen(page); await fixtures(page); await login(page, role); await open(page);
        const filter = page.locator('input[type=search]'); await filter.pressSequentially('  p73 alpha  ');
        await expect(page.locator('.membership-item a:visible')).toHaveCount(0);
        await filter.fill(' !p73-alpha '); await expect(page.locator('.membership-item a:visible')).toHaveCount(role.name === 'teacher' ? 3 : 4);
        await filter.fill('p73-alpha'); const calls = [];
        await page.route('**/api/lmn/groupmembership/membership', (r) => { calls.push(r.request().postDataJSON()); return r.fulfill({ json: ['LOG', 'P73 membership fixture'] }); });
        await page.locator('#p73-alpha').click(); await expect(page.locator('#p73-alpha')).toBeChecked();
        await expect.poll(() => calls).toEqual([{ action: 'addmembers', entity: role.login, groupname: 'p73-alpha', type: 'project' }]);
        await page.getByText(/Do it now|Jetzt erneuern|Jetzt ausführen/, { exact: true }).click();
        await expect(message(page).locator('input')).toBeVisible(); await message(page).locator('.negative').click();
        await filter.fill('p73-printer'); await page.locator('#p73-printer').click();
        await expect.poll(() => calls.at(-1)).toEqual({ action: 'addmembers', entity: role.login, groupname: 'p73-printer', type: 'group' });
        expect(errors).toEqual([]);
    });
    test(`${role.name}: natural detail permissions and properties`, async ({ page }) => {
        const errors = listen(page); await fixtures(page); await login(page, role); await open(page);
        await page.locator('.membership-item a').filter({ hasText: 'p73-alpha' }).click(); await expect(modal(page)).toContainText('p73-alpha');
        if (role.name === 'teacher') await expect(modal(page).locator('input[type=checkbox]').first()).toBeDisabled();
        else await expect(modal(page).locator('input[type=checkbox]').first()).toBeEnabled();
        await expect(modal(page).locator('a:visible').filter({ hasText: /^(Add user or group|Benutzer oder Gruppe hinzufügen)$/ })).toHaveCount(role.name === 'teacher' ? 0 : 1);
        await page.keyboard.press('Escape'); console.log('P73 natural detail errors:', JSON.stringify(errors));
        expect(errors).toEqual([]);
    });
}
test('teacher: synthetic project creation and validation', async ({ page }) => {
    const errors = listen(page); await fixtures(page); await login(page, roles[2]); await open(page); const calls = [];
    await page.route('**/api/lmn/groupmembership/projects/*', (r) => { calls.push({ method: r.request().method(), path: new URL(r.request().url()).pathname, body: r.request().postData() }); return r.fulfill({ json: ['LOG', 'fixture'] }); });
    const create = page.getByRole('button', { name: /New Project|Neues Projekt/ });
    await create.click(); await message(page).locator('input').fill('bad name'); await message(page).locator('.positive').click(); expect(calls).toEqual([]);
    await create.click(); await message(page).locator('input').fill('  p73-test  '); await message(page).locator('.positive').click();
    await expect.poll(() => calls.length).toBe(1); expect(calls).toEqual([{ method: 'POST', path: base + 'projects/p73-test', body: null }]);
    expect(execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', 'samba-tool group list | grep "^p73-test$" || true'], { encoding: 'utf8' })).toBe('');
    expect(errors).toEqual([]);
});

test('teacher: real synthetic project creation, SSH proof and API cleanup', async ({ page }) => {
    const errors = listen(page); await login(page, roles[2]); await open(page);
    await page.getByRole('button', { name: /New Project|Neues Projekt/ }).click();
    await message(page).locator('input').fill('p73_oracle');
    const created = response(page, base + 'projects/p73_oracle', 'POST');
    await message(page).locator('.positive').click(); const result = await created;
    expect(result.status()).toBe(200); console.log('P73 real create:', JSON.stringify(await result.json()));
    const ssh = (cmd) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', cmd], { encoding: 'utf8', timeout: 30000 });
    expect(ssh('samba-tool group list | grep "^p_p73_oracle$"')).toBe('p_p73_oracle\n');
    try { const deleted = await page.request.delete(base + 'projects/p_p73_oracle'); expect(deleted.status()).toBe(200); expect((await deleted.json())[0]).toBe('LOG'); }
    finally { console.log('P73 remaining synthetic group:', ssh('samba-tool group list | grep "^p_p73_oracle$" || true').trim()); }
    expect(ssh('samba-tool group list | grep "^p_p73_oracle$" || true')).toBe(''); expect(errors).toEqual([]);
});
test('global-admin: reset trailing commas and empty-class deletion with identical fixtures', async ({ page }) => {
    const errors = listen(page); await fixtures(page); await login(page, roles[0]); await open(page); const calls = [];
    await page.route('**/api/lmn/groupmembership/resetadmins', (r) => { calls.push(r.request().postDataJSON()); return r.fulfill({ json: ['ERROR', 'old UI still reports success'] }); });
    await page.locator('button[title="Reset all memberships"]').first().click();
    await message(page).locator('.negative').click(); expect(calls).toEqual([]);
    await page.locator('button[title="Reset all memberships"]').first().click();
    await message(page).locator('.positive').click(); await expect.poll(() => calls.length).toBe(1);
    expect(calls).toEqual([{ type: 'class', all_groups: 'p73-class,' }]);
    await page.locator('.membership-item a').filter({ hasText: 'p73-class' }).click();
    await expect(modal(page).locator('.alert-warning')).toBeVisible();
    const deleted = [];
    await page.route('**/api/lmn/groupmembership/schoolclass/*', (r) => { deleted.push({ path: new URL(r.request().url()).pathname, method: r.request().method() }); return r.fulfill({ json: ['LOG', 'fixture deleted'] }); });
    await modal(page).locator('.alert-warning a').click(); await message(page).locator('.negative').click(); expect(deleted).toEqual([]);
    await modal(page).locator('.alert-warning a').click(); await message(page).locator('.positive').click();
    await expect.poll(() => deleted.length).toBe(1); expect(deleted).toEqual([{ path: base + 'schoolclass/p73-class', method: 'DELETE' }]);
    await expect(modal(page)).toHaveCount(0);
    expect(errors).toEqual([]);
});
for (const role of roles.slice(0, 3)) test(`${role.name}: owned project options, member search, group membership and delete (synthetic)`, async ({ page }) => {
    const errors = listen(page); await fixtures(page);
    const owner = { sn: 'P73', givenName: 'Owner', sAMAccountName: role.login, sophomorixAdminClass: 'teachers', sophomorixRole: 'teacher' };
    const user = { label: 'P73 Testuser', login: 'p73-user', sn: 'P73', givenName: 'Testuser', sophomorixAdminClass: 'p73-class', sophomorixRole: 'student' };
    await page.route('**/api/lmn/groupmembership/groups/p73-alpha', (r) => { const g = group('p73-alpha', 'project', { sophomorixAdmins: [role.login] }); const data = detail(g); data.MEMBERS[g.groupname] = { [role.login]: owner }; return r.fulfill({ json: data }); });
    const calls = [];
    for (const path of ['groupoptions/*', 'membership', 'projects/p73-alpha']) await page.route('**/api/lmn/groupmembership/' + path, (r) => { calls.push({ path: new URL(r.request().url()).pathname, method: r.request().method(), body: r.request().postData() ? r.request().postDataJSON() : null }); return r.fulfill({ json: path === 'groupoptions/*' ? 'P73 option fixture' : ['LOG', 'P73 fixture'] }); });
    await page.route('**/api/lmn/find/user', (r) => { expect(r.request().postDataJSON()).toEqual({ name: 'p73' }); return r.fulfill({ json: [user] }); });
    await page.route('**/api/lmn/find/group/p73', (r) => r.fulfill({ json: ['p73-alpha', 'p73-group'] }));
    await login(page, role); await open(page); await page.locator('.membership-item a').filter({ hasText: 'p73-alpha' }).click();
    await expect(modal(page).locator('input[type=checkbox]').first()).toBeEnabled();
    await modal(page).locator('input[type=checkbox]').first().click();
    await expect.poll(() => calls.length).toBe(1); expect(calls[0]).toEqual({ method: 'POST', path: base + 'groupoptions/p73-alpha', body: { attribute: 'sophomorixJoinable', value: false, type: 'project' } });
    await modal(page).locator('a:visible').filter({ hasText: /Add user or group|Benutzer oder Gruppe hinzufügen/ }).click();
    const input = page.locator('.modal input[type=text]:visible'); await input.first().fill('p73');
    await page.locator('ul.dropdown-menu:visible li').filter({ hasText: 'P73 Testuser' }).click();
    await expect(input.first()).toHaveValue(''); await expect(input.first()).toBeFocused();
    await input.nth(2).fill('p73'); await expect(page.locator('ul.dropdown-menu:visible li')).toHaveCount(1);
    await page.locator('ul.dropdown-menu:visible li').filter({ hasText: 'p73-group' }).click();
    await page.locator('a:visible').filter({ hasText: /^\s*(Apply|Übernehmen)\s*$/ }).click();
    await expect.poll(() => calls.length).toBe(3);
    expect(calls.slice(1)).toEqual([{ method: 'POST', path: base + 'membership', body: { action: 'addmembers', entity: 'p73-user,', groupname: 'p73-alpha', type: 'project' } }, { method: 'POST', path: base + 'membership', body: { action: 'addmembergroups', entity: 'p73-group,', groupname: 'p73-alpha', type: 'project' } }]);
    await modal(page).locator('a:visible').filter({ hasText: /Delete Project|Projekt löschen/ }).click(); await message(page).locator('.positive').click();
    await expect.poll(() => calls.length).toBe(4); expect(calls.at(-1)).toEqual({ method: 'DELETE', path: base + 'projects/p73-alpha', body: null });
    expect(errors).toEqual([]);
});
