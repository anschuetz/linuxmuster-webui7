import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
import { observeRoute } from './session_route.mjs';
// Avoid automatic failure DOM snapshots of displayed password fixtures.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
const vue = process.env.P96_UI === 'vue', teacher = settings.roles[1];
const roles = [settings.roles[0], { name: 'school-admin', login: 'pgmadmin', pw: settings.roles[0].pw }, teacher, { name: 'student', login: 'serdarje', pw: settings.roles[0].pw }];
const first = 'Synthetic-P96!';
const custom = '  Synthetic P96!  ';
const dialog = p => p.locator('.modal:visible').last();
const visible = async (locator, wanted = true) => expect.poll(() => locator.isVisible()).toBe(wanted);
const contains = async (locator, value) => expect.poll(async () => (await locator.textContent()).includes(value)).toBe(true);
async function path(p, value) { await p.evaluate(v => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path(v)); }, value); await p.waitForURL('**' + value); }
async function login(p, role) {
    await p.goto('/'); await p.locator('input[ng\\:model=username]').fill(role.login); await p.locator('input[type=password][ng\\:model=password]').fill(role.pw); await p.locator('a[ng\\:click^=login]').click(); await p.waitForURL('**/view/**'); await p.waitForLoadState('networkidle');
    await p.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$apply(() => i.get('gettextCatalog').setCurrentLanguage('de')); });
}
async function setup(p, context, exam = false) {
    const s = { calls: [], reads: [], blocked: [], errors: [], status: true };
    p.on('pageerror', e => s.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())) s.errors.push(m.text()); });
    await context.route('**/api/**', route => { const r = route.request(); if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && new URL(r.url()).pathname.startsWith('/api/lmn/')) { s.blocked.push(r.method()); return route.abort(); } return route.continue(); });
    await p.route('**/api/lmn/**', route => {
        const r = route.request(), url = new URL(r.url()).pathname;
        if (r.method() === 'GET' && url.startsWith('/api/lmn/users/passwords/')) { s.reads.push(url); return route.fulfill({ json: first }); }
        if (url.endsWith('/first-password-set')) { s.reads.push(url); return route.fulfill({ json: s.status }); }
        if (r.method() === 'POST' && /^\/api\/lmn\/users\/passwords\/(reset-first|set-random|set-first|set-current)$/.test(url)) {
            const data = r.postDataJSON(); s.calls.push([url, { users: data.users, ...(Object.hasOwn(data, 'password') ? { valid: data.password === custom } : {}) }]); return route.fulfill({ json: {} });
        }
        if (url.endsWith('/createSessionWorkingDirectory')) return route.fulfill({ json: {} });
        return route.fallback();
    });
    await login(p, teacher); await path(p, '/view/lmn/landingpage');
    const user = { cn: exam ? 'p96-user-exam' : 'p96-user', sAMAccountName: exam ? 'p96-user-exam' : 'p96-user', sophomorixRole: exam ? 'examuser' : 'student', sophomorixAdminClass: exam ? 'p96-class-exam' : 'p96-class', givenName: 'Synthetic', sn: 'Fixture', examMode: exam, examTeacher: exam ? teacher.login : '', examBaseCn: 'p96-user', files_error: '' };
    const data = { sid: 'p96', name: 'p96', type: 'group', generated: false, members: [user] };
    if (vue) await observeRoute(p, 'p96', data);
    else await p.evaluate(data => { const i = angular.element(document).injector(); i.get('lmnSession').current = data; i.get('lmnSession').filterExamUsers(); }, data);
    await path(p, '/view/lmn/session'); return s;
}
async function click(p, name, old) {
    // Clear accumulated sticky shell messages before the next table action.
    await p.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$apply(() => i.get('toaster').clear()); });
    const row = p.locator('[ng\\:view] tr').filter({ has: p.locator('td:first-child b') }).first();
    await row.locator(vue ? '[data-password-menu] > button' : '[uib-dropdown-toggle]').last().click();
    await row.locator(vue ? `[data-password-${name}]` : `[ng\\:click="${old}"]`).click();
}
async function close(p) { await dialog(p).locator('.modal-footer a').last().click(); await visible(dialog(p), false); }
const check = s => { expect(s.blocked).toEqual([]); expect(s.errors).toEqual([]); };
for (const role of roles) test(role.name + ': real password target/rank authorization', async ({ page: p }) => {
    await login(p, role);
    if (['student', 'teacher'].includes(role.name)) expect((await p.request.get('/api/lmn/users/passwords/pgmadmin')).status()).toBe(403);
    if (role.name === 'teacher') expect((await p.request.get('/api/lmn/users/passwords/' + (role.login === 'ba' ? 'zem' : 'ba'))).status()).toBe(403);
    if (role.name === 'school-admin') expect((await p.request.get('/api/lmn/users/passwords/global-admin')).status()).toBe(403);
    if (role.name !== 'global-admin') expect((await p.request.get('/api/lmn/users/p96-unknown/first-password-set')).status()).toBe(403);
    else expect((await p.request.get('/api/lmn/session/sessions')).status()).toBe(200);
});
test('first password, changed/still status, table blur and close on real session route', async ({ page: p, context }) => {
    const s = await setup(p, context);
    for (const status of [true, false]) {
        s.status = status; await click(p, 'show', 'showFirstPassword(participant.cn)'); await visible(dialog(p));
        await contains(dialog(p), first); await contains(dialog(p), status ? 'Noch gesetzt' : 'Vom Benutzer geändert');
        expect(await p.locator('[ng\\:view] table').first().evaluate(e => e.classList.contains('lmn-blurred'))).toBe(true);
        await close(p); expect(await p.locator('[ng\\:view] table').first().evaluate(e => e.classList.contains('lmn-blurred'))).toBe(false);
    }
    expect(s.reads).toEqual(Array(2).fill(['/api/lmn/users/passwords/p96-user', '/api/lmn/users/p96-user/first-password-set']).flat()); check(s);
});
test('reset/random and first/current custom: empty rejected, whitespace preserved, cancel', async ({ page: p, context }) => {
    const s = await setup(p, context);
    await click(p, 'reset', 'resetFirstPassword(participant)'); await click(p, 'random', 'setRandomFirstPassword(participant.cn)');
    for (const type of ['first', 'current']) {
        await click(p, type, `setCustomPassword(participant, '${type}')`); await visible(dialog(p));
        await dialog(p).locator('.modal-footer a').last().click(); expect(s.calls.length).toBe(type === 'first' ? 2 : 3);
        await dialog(p).locator('input[type=password]').pressSequentially(custom); await dialog(p).locator('input').press('Enter'); await visible(dialog(p), false);
    }
    await click(p, 'current', "setCustomPassword(participant, 'current')"); await dialog(p).locator('.modal-footer a').first().click();
    expect(s.calls).toEqual([['reset-first', { users: 'p96-user' }], ['set-random', { users: 'p96-user' }], ['set-first', { users: 'p96-user', valid: true }], ['set-current', { users: 'p96-user', valid: true }]].map(([a, b]) => ['/api/lmn/users/passwords/' + a, b])); check(s);
});
test('own exam reads base only, reset exam+base, current exam alone and both', async ({ page: p, context }) => {
    const s = await setup(p, context, true);
    await click(p, 'show', 'showFirstPassword(participant.cn)'); await contains(dialog(p), first); await close(p); expect(s.reads).toEqual(['/api/lmn/users/passwords/p96-user']);
    await click(p, 'reset', 'resetFirstPassword(participant, exam=true)');
    for (const both of [false, true]) {
        await click(p, both ? 'both' : 'current', both ? "setCustomPassword(participant, 'current', exam=true)" : "setCustomPassword(participant, 'current')");
        await dialog(p).locator('input[type=password]').fill(custom); await dialog(p).locator('input').press('Enter'); await visible(dialog(p), false);
    }
    expect(s.calls).toEqual([['reset-first', { users: 'p96-user-exam' }], ['reset-first', { users: 'p96-user' }], ['set-current', { users: 'p96-user-exam', valid: true }], ['set-current', { users: 'p96-user-exam,p96-user', valid: true }]].map(([a, b]) => ['/api/lmn/users/passwords/' + a, b])); check(s);
});
