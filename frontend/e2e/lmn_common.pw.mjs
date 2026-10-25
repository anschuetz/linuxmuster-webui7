import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { settings } from './playwright.config.mjs';
const admin = settings.roles.find(r => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const schools = [
    { school: 'z-school', schoolname: 'Zulu Schule', $private: 'secret' },
    { school: 'a-school', schoolname: 'Alpha Campus' },
    { school: 'b-school', schoolname: null },
];
async function login(page, role) {
    const errors = []; let authenticated = false;
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) errors.push(m.text()); });
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
    authenticated = true;
    return errors;
}
async function open(page, reload = false) {
    await page.evaluate(reload => {
        const i = angular.element(document).injector();
        i.get('$rootScope').$evalAsync(() => reload ? i.get('$route').reload() : i.get('$location').path('/view/lmn/change-school'));
    }, reload);
    await expect(page).toHaveURL(/\/view\/lmn\/change-school$/);
}
for (const role of roles) {
    test(`${role.name}: real single-school profile gate and read contracts`, async ({ page }) => {
        const errors = await login(page, role);
        const { identity } = await (await page.request.get('/api/core/identity')).json();
        const active = await (await page.request.get('/api/lmn/activeschool')).json();
        expect(active).toEqual('default-school');
        const realSchools = await (await page.request.get('/api/lmn/list-schools')).json();
        expect(realSchools.map(s => s.school)).toEqual(['default-school']);
        const name = await (await page.request.post('/api/lmn/get-schoolname', { data: { school: active } })).json();
        console.log(`${role.name}: school_show=${identity.profile.school_show}, schools=${JSON.stringify(realSchools)}`);
        await open(page);
        const card = page.locator('.info-cards');
        if (identity.profile.school_show) await expect(card).toBeVisible();
        else await expect(card).toBeHidden();
        const info = page.locator('.alert-info').filter({ hasText: /multi-school|Multischul|Schul|school/i });
        if (!identity.profile.school_show) { await expect(info).toBeVisible(); await expect(info).toContainText(/(Dies|Mehr|Schul)/); }
        else {
            await expect(card.locator('.list-group-item').first()).toContainText(`${active} - ${name}`);
            await expect(card.locator('.school-item')).toHaveCount(1);
        }
        if (role.name === 'global-admin') {
            // Same-school switch is the only real reversible switch on single-school E.
            expect(await (await page.request.post('/api/lmn/change-school', { data: { school: active } })).json()).toEqual(true);
            expect(await (await page.request.get('/api/lmn/activeschool')).json()).toEqual(active);
            const directories = execFileSync('ssh', ['lmn-server-e', 'find /etc/linuxmuster/sophomorix -mindepth 1 -maxdepth 1 -type d -name "*-school" -printf "%f\\n"'], { encoding: 'utf8' }).trim().split('\n');
            expect(directories).toEqual(['default-school']);
            console.log('SSH: only default-school; same-school POST leaves context unchanged');
        }
        expect(errors).toEqual([]);
    });
}
test('global-admin: identical multischool fixture, Angular filter and switch/reload results', async ({ page }) => {
    // E has one school, so both implementations receive the same profile/API fixtures.
    await page.route('**/api/core/identity', async route => {
        const response = await route.fetch(); const json = await response.json();
        if (json.identity?.profile) json.identity.profile.school_show = true;
        await route.fulfill({ response, json });
    });
    let active = 'z-school', result = true, paused = false;
    const releases = [];
    const writes = [], reads = [];
    for (const endpoint of ['activeschool', 'get-schoolname', 'list-schools', 'change-school']) {
        await page.route(`**/api/lmn/${endpoint}`, async route => {
            const body = route.request().postDataJSON();
            if (endpoint === 'change-school') {
                writes.push(body); if (result) active = body.school;
                return route.fulfill({ contentType: 'application/json', json: result });
            }
            reads.push(endpoint);
            if (paused) await new Promise(resolve => releases.push(resolve));
            return route.fulfill({ contentType: 'application/json', json: endpoint === 'activeschool' ? active : endpoint === 'list-schools' ? schools : schools.find(s => s.school === body.school)?.schoolname ?? null });
        });
    }
    const errors = await login(page, admin);
    await open(page);
    const card = page.locator('.info-cards');
    await expect(card).toBeVisible();
    await expect(card.locator(await page.locator('.shell-content').count() > 0 ? '.card-header' : '.panel-heading')).toHaveText('Schul-Umschalter');
    await expect(page).toHaveTitle(/^(Schoolswitcher|Schul-Umschalter) \| Zulu Schule$/);
    const rows = card.locator('.school-item');
    await expect(rows).toHaveText(['z-school - Zulu Schule', 'a-school - Alpha Campus', 'b-school -']);
    const input = card.locator('input');
    for (const [query, expected] of [['CAMPUS', ['a-school - Alpha Campus']], ['!campus', ['z-school - Zulu Schule', 'b-school -']], ['!!campus', ['a-school - Alpha Campus']], ['secret', []], ['!school', []]]) {
        await input.fill(query); await expect(rows).toHaveText(expected);
    }
    await input.fill(''); await input.pressSequentially('  Alpha Campus  ');
    await expect(rows).toHaveText(['a-school - Alpha Campus']);
    await rows.first().click();
    await expect(card.locator('.list-group-item').first()).toContainText('a-school - Alpha Campus');
    await expect(page).toHaveTitle(/^(Schoolswitcher|Schul-Umschalter) \| Alpha Campus$/);
    const shellSchool = page.locator('p.navbar-text').filter({ has: page.locator('a[href="/view/lmn/change-school"]') });
    await expect(shellSchool).toContainText('a-school');
    await expect(shellSchool).not.toContainText('z-school');
    await expect.poll(() => reads.filter(s => s === 'list-schools').length).toEqual(2);
    await expect(page.getByText('School changed successfully', { exact: true })).toBeVisible();
    result = false; await input.fill('Zulu'); await rows.first().click();
    await expect.poll(() => reads.filter(s => s === 'list-schools').length).toEqual(3);
    await expect(card.locator('.list-group-item').first()).toContainText('a-school - Alpha Campus');
    await expect(page.getByText('Failed to change school!', { exact: true })).toBeVisible();
    expect(writes).toEqual([{ school: 'a-school' }, { school: 'z-school' }]);
    paused = true; await open(page, true);
    await expect.poll(() => releases.length).toEqual(2);
    await expect(rows).toHaveCount(0);
    // The original keeps the shared identity's current context while reloading.
    await expect(card.locator('.list-group-item').first()).toContainText('a-school - Alpha Campus');
    paused = false; releases.forEach(resolve => resolve());
    await expect(rows).toHaveCount(3);
    await page.unrouteAll({ behavior: 'wait' });
    expect(errors).toEqual([]);
});
