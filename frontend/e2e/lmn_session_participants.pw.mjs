import { observeRoute } from './session_route.mjs';
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';
import { session, users } from './fixtures/session_participants.mjs';
const fullRoute = process.env.P96_ROUTE === '1';
const vue = process.env.P93_UI === 'vue', base = '/api/lmn/session/', detail = '/view/lmn/session';
const pane = p => p.locator(vue && !fullRoute ? '#p93-mount' : '[ng\\:view]');
async function path(p, value) { await p.evaluate(v => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path(v)); }, value); await p.waitForURL('**' + value); }
async function setup(p, context, type = 'group', mkdir = {}) {
    const s = { calls: [], blocked: [], errors: [], room: [], mkdir, membership: ['LOG', 'fixture membership'], kerberos: { type: 'success', msg: 'fixture kerberos' } };
    p.on('pageerror', e => s.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())) s.errors.push(m.text()); });
    await context.route('**/api/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && path.startsWith('/api/lmn/')) { s.blocked.push([r.method(), path]); return route.abort('blockedbyclient'); } return route.continue();
    });
    await p.route('**/api/lmn/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname, data = r.postData() ? r.postDataJSON() : undefined;
        let result;
        if (path === base + 'userinfo') result = data.users.map(cn => users().find(u => u.cn === cn));
        else if (path === base + 'participants') result = ['LOG', 'fixture'];
        else if (path.includes('/user-search/')) result = users();
        else if (path.includes('/schoolClass-search/')) result = [{ cn: 'p93-class', sophomorixMembers: ['p93-a', 'p93-c'], membersCount: 2 }];
        else if (['sessions', 'schoolclasses', 'projects'].some(key => path === base + key)) result = [];
        else if (path === base + 'userInRoom') result = { usersList: s.room, objects: Object.fromEntries(s.room.map(cn => [cn, { COMPUTER: 'p93-pc' }])) };
        else if (path.endsWith('/createSessionWorkingDirectory')) result = s.mkdir;
        else if (path.endsWith('/listCollectDir')) result = Object.fromEntries(data.participants.map(u => [u.cn, { items: [{ name: 'z.txt', isFile: true, isDir: false, size: 12 }, { name: 'a', isDir: true }] }]));
        else if (path === '/api/lmn/groupmembership/membership') result = s.membership;
        else if (path.endsWith('/refresh_krbcc')) { result = s.kerberos; if (result.type !== 'error') s.mkdir = {}; }
        else return route.fallback();
        s.calls.push([r.method(), path, data]); return route.fulfill({ json: result });
    });
    await p.goto('/'); await p.locator('input[ng\\:model="username"]').fill(settings.roles[1].login); await p.locator('input[type=password][ng\\:model="password"]').fill(settings.roles[1].pw); await p.locator('a[ng\\:click^="login"]').click(); await p.waitForURL('**/view/**'); await p.waitForLoadState('networkidle');
    await p.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$apply(() => i.get('gettextCatalog').setCurrentLanguage('de')); });
    await path(p, '/view/lmn/landingpage');
    if (vue && fullRoute) { await observeRoute(p, 'p93', session(type)); await path(p, detail); } else if (vue) {
        for (const file of ['lmn_common/resources/vue/bridge.js', 'lmn_session_new/resources/vue/lmn_session_new.js']) await p.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/' + file, import.meta.url)) });
        await p.evaluate(data => {
            const i = angular.element(document).injector(), node = document.createElement('div'); node.id = 'p93-mount'; document.querySelector('[ng\\:view]').style.display = 'none'; document.body.append(node);
            const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
            const entry = { mount(el, aj) { window.p93aj = aj; aj.navigate = value => { const event = value === '/view/lmn/session' ? null : i.get('$rootScope').$broadcast('$locationChangeStart', value); if (!event?.defaultPrevented) window.p93path = value; }; const store = LmnVue_lmn_session_new.getSessionStore(aj); store.state.current = data; store.filterExamUsers(); window.p93unmount = LmnVue_lmn_session_new.mountDetail(el, aj); return window.p93unmount; } };
            LmnVueBridge.mountBridge(i.get('$route').current.scope.$new(), node, entry, Object.fromEntries(names.map(n => [n, i.get(n)])));
        }, session(type));
    } else {
        await p.evaluate(data => { const i = angular.element(document).injector(); i.get('lmnSession').current = data; i.get('lmnSession').filterExamUsers(); }, session(type)); await path(p, detail);
    }
    await expect.poll(() => s.calls.filter(c => c[1].endsWith('/createSessionWorkingDirectory')).length).toBe(1); return s;
}
async function state(p) { return p.evaluate(v => { const s = v ? LmnVue_lmn_session_new.getSessionStore(window.p93aj).state : angular.element(document).injector().get('lmnSession'); return JSON.parse(JSON.stringify(s.current)); }, vue); }
const check = s => { expect(s.blocked).toEqual([]); expect(s.errors).toEqual([]); };
const members = p => pane(p).locator('tr').filter({ has: p.locator('td:first-child b') });
test('detail: initial workdir, four sorts, files immediate/5s/stop and unmount', async ({ page: p, context }) => {
    const s = await setup(p, context); await expect(members(p).locator('td:first-child b')).toHaveText(['Alpha, Zoe', 'Zulu, Ada']);
    for (const [label, names] of [['Login name', ['Zulu, Ada', 'Alpha, Zoe']], ['Firstname', ['Zulu, Ada', 'Alpha, Zoe']], ['Email', ['Alpha, Zoe', 'Zulu, Ada']]]) {
        if (vue) await pane(p).locator('select').selectOption({ label: { 'Login name': 'Anmeldename', Firstname: 'Vorname', Email: 'E-Mail' }[label] });
        else { await p.evaluate(label => { const el = document.querySelector('[ng\\:controller="LMNSessionController"]') || document.querySelector('[ng\\:view]').firstElementChild; const scope = angular.element(el).scope(); scope.$apply(() => { scope.sort = scope.sorts[['Lastname','Login name','Firstname','Email'].indexOf(label)]; }); }, label); }
        await expect(members(p).locator('td:first-child b')).toHaveText(names);
    }
    const start = vue ? pane(p).locator('[data-files-start]') : pane(p).locator('[ng\\:click="startRefreshFiles()"]');
    await start.click(); await expect.poll(() => s.calls.filter(c => c[1].endsWith('/listCollectDir')).length).toBe(1);
    await expect(members(p).first()).toContainText('z.txt'); await p.waitForTimeout(5200); expect(s.calls.filter(c => c[1].endsWith('/listCollectDir')).length).toBe(2);
    await (vue ? pane(p).locator('[data-files-stop]') : pane(p).locator('[ng\\:click="stopRefreshFiles()"]')).click();
    await p.waitForTimeout(5100); expect(s.calls.filter(c => c[1].endsWith('/listCollectDir')).length).toBe(2);
    if (vue) await p.evaluate(() => window.p93unmount()); else await path(p, '/view/lmn/landingpage');
    await p.waitForTimeout(5100); expect(s.calls.filter(c => c[1].endsWith('/listCollectDir')).length).toBe(2); check(s);
});
test('room: immediate refresh, empty retains members, nonempty replaces with computer; cleanup', async ({ page: p, context }) => {
    const s = await setup(p, context, 'room'); await expect.poll(() => s.calls.filter(c => c[1].endsWith('/userInRoom')).length).toBe(1);
    expect((await state(p)).members.map(u => u.cn)).toEqual(['p93-a', 'p93-b']); s.room = ['p93-c'];
    await expect.poll(async () => (await state(p)).members.map(u => u.cn), { timeout: 8000 }).toEqual(['p93-c']); expect((await state(p)).members[0].computer).toBe('p93-pc');
    if (vue) await p.evaluate(() => window.p93unmount()); else await path(p, '/view/lmn/landingpage'); const count = s.calls.length; await p.waitForTimeout(5200); expect(s.calls.length).toBe(count); check(s);
});
test('real membership: duplicate, user/class addition and removal payloads', async ({ page: p, context }) => {
    const s = await setup(p, context);
    const edit = pane(p).getByRole('button', { name: 'Gruppe bearbeiten' }); await edit.click();
    await expect(pane(p).locator(vue ? '[data-rename]' : '[ng\\:click="renameSession()"]')).toBeVisible(); await edit.click();
    const input = pane(p).locator('input').first(); await input.fill('p93'); await pane(p).locator(vue ? '[data-users] button' : '.dropdown-menu:visible a').filter({ hasText: /\(p93-a\)$/ }).click();
    expect(s.calls.filter(c => c[1] === base + 'participants')).toEqual([]);
    await input.fill('p93'); await pane(p).locator(vue ? '[data-users] button' : '.dropdown-menu:visible a').filter({ hasText: /\(p93-c\)$/ }).click();
    await expect.poll(async () => (await state(p)).members.length).toBe(3);
    const remove = vue ? pane(p).locator('[data-remove]').first() : pane(p).locator('[ng\\:click="removeParticipant(participant)"]:visible').first(); await remove.click();
    await expect.poll(() => s.calls.filter(c => c[1] === base + 'participants').length).toBe(2);
    expect(s.calls.filter(c => c[1] === base + 'participants')).toEqual([['POST', base + 'participants', { users: ['p93-c'], session: 'p93-fixture' }], ['PATCH', base + 'participants', { users: ['p93-b'], session: 'p93-fixture' }]]); check(s);
});
test('generated change, leave cancel/accept, unload guard', async ({ page: p, context }) => {
    const s = await setup(p, context, 'schoolclass'), input = pane(p).locator('input').nth(1); await input.fill('p'); await pane(p).locator(vue ? '[data-classes] button' : '.dropdown-menu:visible a').filter({ hasText: 'p93-class' }).click();
    await expect.poll(async () => (await state(p)).members.length).toBe(3); expect(s.calls.filter(c => c[1] === base + 'participants')).toEqual([]);
    const close = vue ? pane(p).getByRole('button', { name: 'Schließen', exact: true }) : pane(p).locator('[ng\\:click="backToSessionList()"]');
    if (vue) expect(await p.evaluate(() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; })).toBe(true);
    const leave = async accept => { const handled = p.waitForEvent('dialog').then(d => accept ? d.accept() : d.dismiss()); await close.click(); await handled; };
    await leave(false); expect(await p.evaluate(v => v ? window.p93path : location.pathname, vue)).toBe(detail);
    await leave(true);
    if (vue && !fullRoute) expect(await p.evaluate(() => window.p93path)).toBe('/view/lmn/sessionsList'); else await p.waitForURL('**/view/lmn/sessionsList');
    check(s);
});
test('missing membership and kerberos repair reuse identity refresh', async ({ page: p, context }) => {
    const s = await setup(p, context, 'group', { 'p93-a': 'missing' });
    const join = vue ? pane(p).locator('[data-membership]').first() : pane(p).locator('[ng\\:click="fixMembership()"]').first(); await join.click();
    const prompt = p.locator('.messagebox:visible').last(); await expect(prompt.locator('input[type=password]')).toBeVisible(); await prompt.locator('input').fill('synthetic-only'); await prompt.locator('.positive').click();
    await expect.poll(() => s.calls.filter(c => c[1].endsWith('/createSessionWorkingDirectory')).length).toBe(2);
    expect(s.calls.filter(c => c[1] === '/api/lmn/groupmembership/membership')).toEqual([['POST', '/api/lmn/groupmembership/membership', { action: 'addadmins', entity: settings.roles[1].login, groupname: 'p93-class', type: 'class' }]]);
    expect(s.calls.filter(c => c[1].endsWith('/refresh_krbcc'))).toEqual([['POST', '/api/lmn/smbclient/refresh_krbcc', { pw: 'synthetic-only' }]]); check(s);
});

test('membership ERROR and kerberos cancel/rejection retain missing class', async ({ page: p, context }) => {
    const s = await setup(p, context, 'group', { 'p93-a': 'missing' }); s.membership = ['ERROR', 'fixture denied'];
    const join = () => vue ? pane(p).locator('[data-membership]').first() : pane(p).locator('[ng\\:click="fixMembership()"]').first();
    await join().click(); await expect.poll(() => s.calls.filter(c => c[1].endsWith('/membership')).length).toBe(1); expect(s.calls.filter(c => c[1].endsWith('/refresh_krbcc'))).toEqual([]);
    s.membership = ['LOG', 'fixture joined']; await join().click(); const prompt = () => p.locator('.messagebox:visible').last(); await expect(prompt().locator('input[type=password]')).toBeVisible(); await prompt().locator('.negative').click(); expect(s.calls.filter(c => c[1].endsWith('/refresh_krbcc'))).toEqual([]);
    s.kerberos = { type: 'error', msg: 'fixture bad ticket' }; await join().click(); await prompt().locator('input').fill('synthetic-only'); await prompt().locator('.positive').click(); await expect.poll(() => s.calls.filter(c => c[1].endsWith('/refresh_krbcc')).length).toBe(1);
    expect((await state(p)).members[0].files_error).toBe('NOTJOINED'); check(s);
});

test('empty SID redirects after legacy empty workdir request', async ({ page: p, context }) => {
    const s = await setup(p, context, 'direct');
    await p.waitForURL('**/view/lmn/sessionsList');
    expect(s.calls.filter(c => c[1].endsWith('/createSessionWorkingDirectory'))).toEqual([['POST','/api/lmn/smbclient/createSessionWorkingDirectory',{users:[]}]]); check(s);
});

test('identity refresh failure after kerberos does not retry credentials or lose participants', async ({ page: p, context }) => {
    const s = await setup(p, context, 'group', { 'p93-a': 'missing' });
    await p.evaluate(() => { const i = angular.element(document).injector(); window.p93identityCalls = 0; i.get('identity').init = () => { window.p93identityCalls += 1; return i.get('$q').reject('P93 identity fixture'); }; });
    await (vue ? pane(p).locator('[data-membership]').first() : pane(p).locator('[ng\\:click="fixMembership()"]').first()).click();
    const prompt = p.locator('.messagebox:visible').last(); await expect(prompt.locator('input[type=password]')).toBeVisible(); await prompt.locator('input').fill('synthetic-only'); await prompt.locator('.positive').click();
    await expect.poll(() => p.evaluate(() => window.p93identityCalls)).toBe(1);
    await expect.poll(async () => (await state(p)).members[0].files_error).toBe('');
    expect((await state(p)).members.map(u => u.cn)).toEqual(['p93-a','p93-b']);
    expect(s.calls.filter(c => c[1].endsWith('/refresh_krbcc'))).toEqual([['POST','/api/lmn/smbclient/refresh_krbcc',{pw:'synthetic-only'}]]); check(s);
});
