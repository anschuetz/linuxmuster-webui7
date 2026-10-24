import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';
import { fixtures, members } from './fixtures/session_new.mjs';
const vue = process.env.P92_UI === 'vue', base = '/api/lmn/session/', list = '/view/lmn/sessionsList', detail = '/view/lmn/session';
const admin = settings.roles[0], teacher = settings.roles[1];
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, teacher, { name: 'student', login: 'serdarje', pw: admin.pw }];
const box = p => p.locator('.messagebox:visible').last();
const pane = p => p.locator(vue ? '#p92-mount' : '[ng\\:view]');
const cards = (p, i) => pane(p).locator('.list-group').nth(i).locator('.list-group-item:visible');
function listen(p) {
    const errors = []; p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())) errors.push(m.text()); }); return errors;
}
async function login(p, r) {
    await p.goto('/'); await p.locator('input[ng\\:model="username"]').fill(r.login); await p.locator('input[type=password][ng\\:model="password"]').fill(r.pw);
    await p.locator('a[ng\\:click^="login"]').click(); await p.waitForURL('**/view/**'); await p.waitForLoadState('networkidle'); await p.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$apply(() => i.get('gettextCatalog').setCurrentLanguage('de')); });
}
async function setup(p, context, empty = false) {
    const s = { errors: listen(p), writes: [], blocked: [], data: fixtures() }; let roomReads = 0;
    if (empty) Object.assign(s.data, { sessions: [], projects: [], schoolclasses: [], room: { name: '', usersList: [], objects: {} } });
    await context.route('**/api/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && path.startsWith('/api/lmn/')) { s.blocked.push([r.method(), path]); return route.abort('blockedbyclient'); } return route.continue();
    });
    await p.route('**/api/lmn/session/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname, key = path.slice(base.length);
        if (r.method() === 'GET') { if (key === 'userInRoom') return route.fulfill({ json: { ...s.data.room, usersList: roomReads++ === 0 ? s.data.room.usersList : [] } }); if (Object.hasOwn(s.data, key)) return route.fulfill({ json: s.data[key] }); }
        if (r.method() === 'POST' && key === 'userinfo') { s.writes.push([r.method(), path, r.postDataJSON()]); return route.fulfill({ json: empty ? [] : members() }); }
        if ((['PUT', 'DELETE'].includes(r.method()) && /^sessions\/[^/]+$/.test(key)) || (r.method() === 'POST' && key === 'sessions')) {
            s.writes.push([r.method(), path, r.postData() ? r.postDataJSON() : null]); return route.fulfill({ json: 'P92 fixture' });
        } return route.fallback();
    });
    // Eager detail mkdir/list writes are fixtures too; no real files touched.
    for (const path of ['createSessionWorkingDirectory', 'listCollectDir']) await p.route('**/api/lmn/smbclient/' + path, r => r.fulfill({ json: {} }));
    await login(p, teacher); return s;
}
async function path(p, value) {
    await p.evaluate(value => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path(value)); }, value); await p.waitForURL('**' + value);
}
async function open(p) {
    if (!vue) return path(p, list);
    await path(p, '/view/lmn/landingpage');
    for (const file of ['lmn_common/resources/vue/bridge.js', 'lmn_session_new/resources/vue/lmn_session_new.js']) await p.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/' + file, import.meta.url)) });
    await p.evaluate(() => {
        const i = angular.element(document).injector(), node = document.createElement('div'); node.id = 'p92-mount'; document.querySelector('[ng\\:view]').style.display = 'none'; document.body.append(node);
        const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
        const entry = { mount(el, aj) { window.p92aj = aj; aj.navigate = value => { window.p92path = value; }; window.p92unmount = LmnVue_lmn_session_new.mount(el, aj); return window.p92unmount; } };
        LmnVueBridge.mountBridge(i.get('$route').current.scope.$new(), node, entry, Object.fromEntries(names.map(n => [n, i.get(n)])));
    });
}
async function prompt(p, value, cancel = false) { await expect(box(p).locator('input')).toBeVisible(); await box(p).locator('input').fill(value); await box(p).locator(cancel ? '.negative' : '.positive').click(); }
const check = s => { expect(s.blocked).toEqual([]); expect(s.errors).toEqual([]); };
for (const r of roles) test(`${r.name}: real read authorization and sidebar`, async ({ page: p }) => {
    const errors = listen(p); await login(p, r); const allowed = r.name !== 'student';
    await expect(p.locator('a[href="' + list + '/"]:visible')).toHaveCount(r.name === 'teacher' ? 1 : 0);
    for (const key of ['sessions', 'schoolclasses', 'projects', 'userInRoom']) expect((await p.request.get(base + key)).status()).toBe(allowed ? 200 : 403);
    for (const key of ['userinfo', 'exam/userinfo']) expect((await p.request.post(base + key, { data: { users: [] } })).status()).toBe(allowed ? 200 : 403);
    expect(errors).toEqual([]);
});
test('teacher: order, deep/negative/trim filter and unfiltered room', async ({ page: p, context }) => {
    const s = await setup(p, context); await open(p);
    await expect(cards(p, 2).locator('h4')).toHaveText(['Alpha', 'alpha', 'Zeta']);
    await expect(cards(p, 1).locator('h4')).toHaveText(['p92-z-class', 'p92-a-class']); await expect(cards(p, 3).locator('h4')).toHaveText(['p92-z-project', 'p92-a-project']);
    const f = pane(p).locator('input[type=search]'); await f.fill(' !alpha '); await expect(cards(p, 2).locator('h4')).toHaveText(['Zeta']); await expect(cards(p, 0)).toHaveCount(1);
    await f.fill(' p92-student '); await expect(cards(p, 2)).toHaveCount(3); await f.fill(''); await f.pressSequentially('  inner space  '); await expect(cards(p, 2)).toHaveCount(0); check(s);
});
test('teacher: empty lists and original project notice', async ({ page: p, context }) => {
    const s = await setup(p, context, true); await open(p); for (let i = 0; i < 4; i++) { await expect(cards(p, i)).toHaveCount(0); await expect(pane(p).locator('.list-group').nth(i).locator('.alert-info:visible')).toHaveCount(1); } check(s);
});
test('teacher: new, clone, rename, delete, cancellations and exact payloads', async ({ page: p, context }) => {
    const s = await setup(p, context); await open(p); const create = pane(p).getByRole('button', { name: /New group|Neue Gruppe/ });
    await create.click(); await prompt(p, 'p92-cancel', true); expect(s.writes).toEqual([]); await create.click(); await prompt(p, 'bad name'); expect(s.writes).toEqual([]);
    await create.click(); await prompt(p, '  p92-new  '); await expect.poll(() => s.writes.length).toBe(1);
    const card = cards(p, 2).filter({ hasText: 'Zeta' }); await card.locator('a').nth(1).click(); await prompt(p, 'p92-clone'); await expect.poll(() => s.writes.length).toBe(2);
    await card.locator('a').nth(2).click(); await prompt(p, 'p92-cancel', true); expect(s.writes.length).toBe(2); await card.locator('a').nth(2).click(); await prompt(p, ' p92-renamed ');
    const renamed = cards(p, 2).filter({ hasText: 'p92-renamed' }); await expect(renamed).toHaveCount(1);
    await renamed.locator('a').first().click(); await box(p).locator('.negative').click(); expect(s.writes.length).toBe(3); await renamed.locator('a').first().click(); await box(p).locator('.positive').click();
    await expect.poll(() => s.writes.length).toBe(4); expect(s.writes).toEqual([
        ['PUT', base + 'sessions/p92-new', { members: [] }], ['PUT', base + 'sessions/p92-clone', { members: fixtures().sessions[0].members }],
        ['POST', base + 'sessions', { action: 'rename-session', session: 'Zeta', comment: 'p92-renamed' }], ['DELETE', base + 'sessions/Zeta', null],
    ]); check(s);
});
for (const [section, type, name] of [[0, 'room', 'p92-room'], [1, 'schoolclass', 'p92-z-class'], [3, 'project', 'p92-z-project'], [2, 'group', 'Alpha']]) test(`teacher: open ${type}, state, return/remount`, async ({ page: p, context }) => {
    const s = await setup(p, context); await open(p); await cards(p, section).filter({ has: p.locator('h4', { hasText: new RegExp('^\\s*' + name + '\\s*$') }) }).first().click();
    await expect.poll(() => p.evaluate(vue => vue ? window.p92path : location.pathname, vue)).toBe(detail);
    const state = await p.evaluate(vue => { const s = vue ? LmnVue_lmn_session_new.getSessionStore(window.p92aj).state : angular.element(document).injector().get('lmnSession'); return { current: { ...s.current, members: s.current.members.map(u => u.cn) }, examUsers: s.examUsers.map(u => u.cn), extExamUsers: s.extExamUsers.map(u => u.cn), examMode: s.examMode }; }, vue);
    expect(state.current.name).toBe(name); expect(state.current.type).toBe(type); expect(state.current.generated).toBe(type !== 'group'); expect(typeof state.current.sid).toBe(type === 'group' ? 'string' : 'number');
    expect(state.current.members).toEqual(members().map(u => u.cn)); expect(state.examUsers).toEqual(['p92-exam']); expect(state.extExamUsers).toEqual(['p92-foreign']); expect(state.examMode).toBe(false);
    expect(s.writes).toEqual([['POST', base + 'userinfo', { users: section === 0 ? ['p92-student'] : fixtures().sessions[0].members }]]);
    if (vue) await p.evaluate(() => { window.p92unmount(); window.p92unmount = LmnVue_lmn_session_new.mount(document.getElementById('p92-mount'), window.p92aj); }); else await path(p, list);
    await expect(cards(p, 2)).toHaveCount(3); check(s);
});
test('teacher: direct detail without SID returns to list', async ({ page: p, context }) => {
    const s = await setup(p, context);
    if (vue) { await open(p); await p.evaluate(() => LmnVue_lmn_session_new.getSessionStore(window.p92aj).enterDetail()); await expect.poll(() => p.evaluate(() => window.p92path)).toBe(list); }
    else { await path(p, detail); await p.waitForURL('**' + list); } check(s);
});
test('teacher: German headings and class-dependent project notice even with projects', async ({ page: p, context }) => {
    const s = await setup(p, context); s.data.schoolclasses = []; await open(p);
    await expect(pane(p).locator('h3')).toHaveText(['Dieser Raum', 'Meine Klassen', 'Meine Gruppen', 'Meine Projekte']);
    await expect(cards(p, 3)).toHaveCount(2); await expect(pane(p).locator('.list-group').nth(3).locator('.alert-info:visible')).toHaveCount(1); check(s);
});
test('teacher: invalid rename preserves undefined-name quirk without write', async ({ page: p, context }) => {
    const s = await setup(p, context); await open(p); await cards(p, 2).filter({ hasText: 'Zeta' }).locator('a').nth(2).click(); await prompt(p, 'bad name');
    await expect(pane(p).locator('h4', { hasText: /^Zeta$/ })).toHaveCount(0); expect(s.writes).toEqual([]); check(s);
});
