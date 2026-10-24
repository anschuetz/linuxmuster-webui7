import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
const admin = settings.roles.find((r) => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const base = '/api/lmn/websession/';
let touchedStore = false;
const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
test.afterEach(() => { if (touchedStore) { ssh('rm -f /etc/linuxmuster/webui/websession/websession_list.json'); touchedStore = false; } });
const response = (page, path, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === path && r.request().method() === method);
const dialog = (page) => page.locator('.modal:visible').last();
const message = (page) => page.locator('dialog.messagebox:visible').last();
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
    await page.locator('a[ng\\:click^="login"]').click();
    expect((await auth).status()).toBe(200);
    await page.waitForURL('**/view/**');
    await page.waitForLoadState('networkidle');
}
async function open(page) {
    // Angular route transition avoids unrelated Socket.IO errors after document reload.
    await page.evaluate(() => {
        const root = angular.element(document.body).injector();
        root.get('$rootScope').$apply(() => root.get('$location').path('/view/lmn/websession'));
    });
    await page.waitForURL('**/view/lmn/websession');
}
const fixture = (owner, status = 'stopped') => ({ id: 'p62-session', sessionname: 'P62 Konferenz', moderator: owner, participants: ['serdarje', 'zem'], sessionpassword: 'p62-pass', sessiontype: 'password', status, attendeepw: 'attendee', moderatorpw: 'moderator' });
for (const role of roles) {
    test(`${role.name}: real enabled/list and hidden sidebar`, async ({ page }) => {
        const errors = listen(page);
        await login(page, role);
        const enabled = response(page, base + 'webConferenceEnabled');
        await open(page);
        const result = await enabled;
        expect(result.status()).toBe(200);
        const state = await result.json();
        console.log(`${role.name}: E enabled=${state}`);
        expect(await (await page.request.get(base + 'webConferences')).json()).toEqual([]);
        await expect(page.locator('a[href="/view/lmn/websession"]:visible')).toHaveCount(0);
        await expect(page.getByText(/Websession-Module not enabled|Websession-Modul nicht aktiviert/)).toBeVisible();
        expect(errors).toEqual([]);
    });
    test(`${role.name}: identical moderator/participant controls and dialogs`, async ({ page }) => {
        const errors = listen(page);
        let sessions = [fixture(role.login), { ...fixture('p62-other', 'started'), id: 'p62-other' }];
        await page.route('**/api/lmn/websession/webConferenceEnabled', (r) => r.fulfill({ json: true }));
        await page.route('**/api/lmn/websession/webConferences', (r) => r.fulfill({ json: sessions }));
        await login(page, role); await open(page);
        const rows = page.locator('tr.session_table');
        await expect(rows).toHaveCount(2);
        expect(await rows.first().locator('td').evaluateAll((nodes) => nodes.map((node) => node.textContent.trim()))).toEqual(['', 'P62 Konferenz', role.login, 'p62-pass', '2', 'stopped', '']);
        await expect(page.locator('button:has(.fa-plus):visible')).toHaveCount(role.name === 'teacher' ? 1 : 0);
        await expect(rows.first().locator('button:has(.fa-stop):visible')).toBeDisabled();
        await expect(rows.last().locator('button:has(.fa-trash-alt):visible')).toHaveCount(0);
        await rows.first().locator('td').nth(4).click();
        await expect(dialog(page)).toContainText('serdarje'); await page.keyboard.press('Escape');
        await rows.first().locator('button:has(.fa-eye)').click();
        await expect(message(page)).toContainText(new URL('/websession/p62-session', settings.baseURL).href);
        await message(page).getByText('Ok', { exact: true }).click();
        await page.evaluate(() => { window.p62copies = []; document.execCommand = (cmd) => { window.p62copies.push([cmd, document.querySelector('textarea').value]); return true; }; });
        await rows.first().locator('button:has(.fa-clipboard)').click();
        expect(await page.evaluate(() => window.p62copies)).toEqual([['copy', new URL('/websession/p62-session', settings.baseURL).href]]);
        await page.context().route('https://example.invalid/p62-join', (r) => r.fulfill({ body: 'P62 BBB fixture' }));
        const identity = (await (await page.request.get('/api/core/identity')).json()).identity;
        await page.route('**/api/lmn/websession/joinWebConference', (r) => {
            const payload = r.request().postDataJSON();
            expect(payload).toEqual({ id: payload.id, password: payload.id === 'p62-other' ? 'attendee' : 'moderator', name: `${identity.profile.sn}, ${identity.profile.givenName}` });
            return r.fulfill({ json: 'https://example.invalid/p62-join' });
        });
        await page.route('**/api/lmn/websession/startWebConference', (r) => {
            expect(r.request().postDataJSON()).toEqual({ sessionname: 'P62 Konferenz', id: 'p62-session', attendeepw: 'attendee', moderatorpw: 'moderator' });
            sessions = sessions.map((s) => ({ ...s, status: 'started' }));
            return r.fulfill({ json: { returncode: 'SUCCESS' } });
        });
        let popup = page.waitForEvent('popup'); await rows.first().locator('button:has(.fa-play):visible').click(); await (await popup).close();
        popup = page.waitForEvent('popup'); await rows.last().locator('button:has(.fa-play):visible').click(); await (await popup).close();
        await page.route('**/api/lmn/websession/endWebConference', (r) => {
            expect(r.request().postDataJSON()).toEqual({ id: 'p62-session', moderatorpw: 'moderator' });
            sessions = sessions.map((s) => s.id === 'p62-session' ? { ...s, status: 'stopped' } : s);
            return r.fulfill({ json: { returncode: 'SUCCESS' } });
        });
        await rows.first().locator('button:has(.fa-stop):visible').click();
        await expect(rows.first()).toContainText('stopped');
        // Preserve the original undefined-ID deletion; actual JSON file remains unchanged.
        touchedStore = true;
        ssh("mkdir -p /etc/linuxmuster/webui/websession; printf '[]' > /etc/linuxmuster/webui/websession/websession_list.json; chmod 666 /etc/linuxmuster/webui/websession/websession_list.json");
        await rows.first().locator('button:has(.fa-trash-alt)').click();
        await expect(message(page)).toContainText('Delete p62-session?');
        await message(page).locator('.negative').click();
        await rows.first().locator('button:has(.fa-trash-alt)').click();
        const deleted = response(page, base + 'webConference/undefined', 'DELETE');
        await message(page).locator('.positive').click(); expect((await deleted).status()).toBe(200);
        expect(JSON.parse(ssh('cat /etc/linuxmuster/webui/websession/websession_list.json'))).toEqual([]);
        ssh('rm /etc/linuxmuster/webui/websession/websession_list.json');
        expect(errors).toEqual([]);
    });
}
test('teacher: real create, class lookup, ngTrim and stale list after dismissal', async ({ page }) => {
    const errors = listen(page); const role = roles.find((r) => r.name === 'teacher');
    touchedStore = true;
        ssh("mkdir -p /etc/linuxmuster/webui/websession; printf '[]' > /etc/linuxmuster/webui/websession/websession_list.json; chmod 666 /etc/linuxmuster/webui/websession/websession_list.json");
    let listGets = 0;
    await page.route('**/api/lmn/websession/webConferences', (r) => {
        if (r.request().method() === 'POST') return r.continue();
        listGets++; return r.fulfill({ json: [] }); // E has no configured BBB server.
    });
    await login(page, role); await open(page);
    await page.locator('button:has(.fa-plus)').click();
    const modal = dialog(page);
    await modal.getByText(/^(Create|Erstellen)$/, { exact: true }).click();
    await expect(modal).toBeVisible();
    await modal.locator('input').nth(0).pressSequentially('  P62 neue Sitzung  ');
    await modal.locator('select').first().selectOption('password');
    await modal.locator('input').nth(1).fill('  p62 pass  ');
    const classes = response(page, '/api/lmn/session/schoolClass-search/5a');
    await modal.locator('input').nth(3).fill('5a');
    const foundClasses = await classes; expect(foundClasses.status()).toBe(200); const actualClasses = await foundClasses.json(); console.log('P62 class shape', JSON.stringify(actualClasses.map((c) => ({ cn: c.cn, hasLabel: 'sophomorixAdminClass' in c, hasMembers: 'members' in c, count: c.membersCount }))));
    await modal.locator('.dropdown-menu:visible li').first().click();
    // E supplies cn/member, whereas the old UI expects sophomorixAdminClass/members.
    await expect(modal.getByText(/No users selected|Keine Benutzer ausgewählt/)).toBeVisible();
    expect(await modal.locator('.fa-times-circle').count()).toBe(0);
    await page.route('**/api/lmn/session/schoolClass-search/p62', (r) => r.fulfill({ json: [{ sophomorixAdminClass: 'p62', members: { first: { sAMAccountName: 'serdarje', givenName: 'P62', sn: 'Gast' }, second: { sAMAccountName: 'zem', givenName: 'P62', sn: 'Lehrer' } } }] }));
    await modal.locator('input').nth(3).fill('p62');
    await modal.locator('.dropdown-menu:visible li').filter({ hasText: 'p62' }).click();
    await expect(modal.getByText(/No users selected|Keine Benutzer ausgewählt/)).toBeHidden();
    const removed = await modal.locator('.fa-times-circle').count();
    expect(removed).toBeGreaterThan(0);
    await modal.locator('.fa-times-circle').first().click();
    const sent = response(page, base + 'webConferences', 'POST');
    await modal.getByText(/^(Create|Erstellen)$/, { exact: true }).click();
    const result = await sent; if (result.status() !== 200) console.log(await result.text()); expect(result.status()).toBe(200);
    const payload = result.request().postDataJSON();
    expect(payload.sessionname).toBe('P62 neue Sitzung'); expect(payload.sessionpassword).toBe('p62 pass');
    expect(payload.participants.length).toBe(removed - 1);
    await expect(modal).toBeHidden(); expect(listGets).toBe(1);
    const stored = JSON.parse(ssh('cat /etc/linuxmuster/webui/websession/websession_list.json'));
    expect(stored.map(({ sessionname, sessiontype, sessionpassword, participants, moderator }) => ({ sessionname, sessiontype, sessionpassword, participants, moderator }))).toEqual([{ ...payload, moderator: role.login }]);
    ssh('rm /etc/linuxmuster/webui/websession/websession_list.json');
    expect(errors).toEqual([]);
});
test('anonymous: public password, stopped polling, wrong/right join', async ({ page }) => {
    const errors = listen(page); let running = false;
    await page.route('**/api/lmn/websession/session/name', (r) => r.fulfill({ json: 'P62 Öffentlich' }));
    await page.route('**/api/lmn/websession/session/hasPassword/', (r) => r.fulfill({ json: 'password' }));
    await page.route('**/api/lmn/websession/session/isRunning', (r) => r.fulfill({ json: running }));
    await page.goto('/websession/p62-public');
    await expect(page.locator('#sessionname')).toHaveText('P62 Öffentlich');
    await expect(page.locator('#password_field')).toBeVisible();
    await expect(page.locator('#start')).toBeDisabled();
    running = true; await expect(page.locator('#start')).toBeEnabled({ timeout: 10000 });
    await page.locator('#username').fill('  P62 Gast  '); await page.locator('#password').fill('wrong');
    await page.route('**/api/lmn/websession/session/checkPassword', (r) => r.fulfill({ json: r.request().postDataJSON().password === 'right' ? 'attendee' : 'error' }));
    const alert = page.waitForEvent('dialog'); await page.locator('#start').click();
    const warning = await alert; expect(warning.message()).toBe('Password wrong!'); await warning.accept();
    await page.locator('#password').fill('right');
    await page.route('**/api/lmn/websession/joinWebConference', (r) => { expect(r.request().postDataJSON()).toEqual({ id: 'p62-public', password: 'attendee', name: '  P62 Gast  ' }); return r.fulfill({ json: '/p62-joined' }); });
    await page.route('**/p62-joined', (r) => r.fulfill({ body: 'P62 joined' }));
    await page.locator('#start').click(); await expect(page).toHaveURL(new URL('/p62-joined', settings.baseURL).href); expect(errors).toEqual([]);
});
