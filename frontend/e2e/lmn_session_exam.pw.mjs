import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';
import { session, users } from './fixtures/session_exam.mjs';
const vue = process.env.P95_UI === 'vue', base = '/api/lmn/session/', detail = '/view/lmn/session';
const pane = p => p.locator(vue ? '#p95-mount' : '[ng\\:view]');
async function path(p, value) { await p.evaluate(v => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path(v)); }, value); await p.waitForURL('**' + value); }
async function setup(p, context, mode = 'mixed') {
    const s = { calls: [], blocked: [], errors: [], members: users(settings.roles[1].login, mode), fail: '', hold: null };
    p.on('pageerror', e => s.errors.push(e.message));
    p.on('console', m => { if(m.type() === 'error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text()) && !(s.fail && /500|fixture|unavailable/.test(m.text()))) s.errors.push(m.text()); });
    // Legacy rejected exam promises can surface in the shell; record separately in failure cases.
    await context.route('**/api/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && path.startsWith('/api/lmn/')) { s.blocked.push([r.method(), path]); return route.abort('blockedbyclient'); } return route.continue();
    });
    await p.route('**/api/lmn/**', async route => {
        const r = route.request(), path = new URL(r.url()).pathname, data = r.postData() ? r.postDataJSON() : undefined;
        let result = {};
        if (path === base + 'exam/userinfo') result = data.users.map(cn => ({...s.members.find(u => u.cn === cn), cn: cn + '-exam', sAMAccountName: cn + '-exam', examMode:true, examTeacher:settings.roles[1].login}));
        else if (path === base + 'userinfo') result = s.members;
        else if (path.endsWith('/listCollectDir')) result = Object.fromEntries(data.participants.map(u => [u.cn, {items: []}]));
        else if (path.endsWith('/userInRoom')) result = {usersList:[],objects:{}};
        else if (![base+'exam/start',base+'exam/stop','/api/lmn/managementgroup','/api/lmn/smbclient/createSessionWorkingDirectory'].includes(path)) return route.fallback();
        s.calls.push([r.method(), path, data]);
        if (s.hold && /exam\/(start|stop)$/.test(path)) await s.hold;
        if (s.fail && (path.includes('/exam/start') || path.endsWith('/managementgroup'))) return route.fulfill({status:500,json:{message:s.fail}});
        return route.fulfill({json:result});
    });
    await p.goto('/'); await p.locator('input[ng\\:model="username"]').fill(settings.roles[1].login); await p.locator('input[type=password][ng\\:model="password"]').fill(settings.roles[1].pw); await p.locator('a[ng\\:click^="login"]').click(); await p.waitForURL('**/view/**'); await p.waitForLoadState('networkidle');
    await p.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$apply(() => i.get('gettextCatalog').setCurrentLanguage('de')); });
    await path(p, '/view/lmn/landingpage');
    await p.clock.setFixedTime(new Date('2026-10-24T12:34:56'));
    await p.evaluate(() => { angular.element(document).injector().get('identity').profile.homeDirectory = '\\\\P95\\fixture\\teacher'; });
    if (vue) {
        for (const file of ['lmn_common/resources/vue/bridge.js', 'lmn_session_new/resources/vue/lmn_session_new.js']) await p.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/' + file, import.meta.url)) });
        await p.evaluate(data => {
            const i = angular.element(document).injector(), node = document.createElement('div'); node.id = 'p95-mount'; document.querySelector('[ng\\:view]').style.display = 'none'; document.body.append(node);
            const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
            const entry = { mount(el, aj) { window.p95aj = aj; aj.navigate = value => { const event = value === '/view/lmn/session' ? null : i.get('$rootScope').$broadcast('$locationChangeStart', value); if (!event?.defaultPrevented) window.p95path = value; }; const store = LmnVue_lmn_session_new.getSessionStore(aj); store.state.current = data; store.filterExamUsers(); window.p95store = store; window.p95unmount = LmnVue_lmn_session_new.mountDetail(el, aj); return window.p95unmount; } };
            LmnVueBridge.mountBridge(i.get('$route').current.scope.$new(), node, entry, Object.fromEntries(names.map(n => [n, i.get(n)])));
        }, session(settings.roles[1].login, mode));
    } else {
        await p.evaluate(data => { const i = angular.element(document).injector(); i.get('lmnSession').current = data; i.get('lmnSession').filterExamUsers(); }, session(settings.roles[1].login, mode)); await path(p, detail);
    }
    await expect.poll(() => s.calls.filter(c => c[1].endsWith('/createSessionWorkingDirectory')).length).toBe(1); return s;
}

const M = '/api/lmn/smbclient/';
const msg = p => p.locator('.messagebox:visible').last();
const wait = p => p.locator('.modal:visible').last();
async function click(p, name, old) { await pane(p).locator(vue ? `[data-${name}]` : `[ng\\:click="${old}"]`).filter({visible:true}).first().click(); }
async function confirm(p, accept=true) { await msg(p).locator(accept ? '.positive' : '.negative').click(); }
async function snapshot(p) { return p.evaluate(vue => {
    if (vue) { const s=window.p95store.state; return {changed:s.stateChanged, mode:s.examMode, polling:s.filePolling.active.value, members:s.current.members}; }
    const s=angular.element(document).injector().get('$route').current.scope;return {changed:s.stateChanged,mode:s.examMode,polling:s.autorefresh_files || false,members:s.session.members};
}, vue); }
const check = s => { expect(s.blocked).toEqual([]); expect(s.errors).toEqual([]); };
test('start single and all: confirmation/cancel, exact payload, exam userinfo, directory and file stop',async({page:p,context})=>{
    const s=await setup(p,context,'none');
    await click(p,'exam-start-all','startExam()');await expect(msg(p)).toContainText('Prüfung');await confirm(p,false);expect(s.calls.filter(c=>c[0]==='PATCH')).toEqual([]);
    await click(p,'files-start','startRefreshFiles()');await click(p,'exam-start-user','startExam(participant.cn)');await confirm(p);
    await expect.poll(()=>s.calls.filter(c=>c[1]===base+'exam/userinfo').length).toBe(1);await expect(wait(p)).toBeHidden();
    expect(s.calls.filter(c=>c[0]==='PATCH')).toEqual([['PATCH',base+'exam/start',{session:{members:[{cn:'p95-0'}]}}]]);
    expect(s.calls.find(c=>c[1]===base+'exam/userinfo')[2]).toEqual({users:['p95-0']});expect((await snapshot(p)).polling).toBe(false);expect((await snapshot(p)).changed).toBe(false);
    await expect(pane(p).locator(vue ? '[data-exam-start-all]' : '[ng\\:click="startExam()"]')).toBeVisible();check(s);
});
test('whole exam start uses complete session and all-user refresh',async({page:p,context})=>{
    const s=await setup(p,context,'none');await click(p,'exam-start-all','startExam()');await confirm(p);await expect.poll(()=>s.calls.filter(c=>c[1]===base+'exam/userinfo').length).toBe(1);await expect(wait(p)).toBeHidden();
    expect(s.calls.filter(c=>c[0]==='PATCH')).toEqual([['PATCH',base+'exam/start',{session:{...session(settings.roles[1].login,'none'),members:users(settings.roles[1].login,'none').map(u=>({...u,files_error:''}))}}]]);
    expect(s.calls.find(c=>c[1]===base+'exam/userinfo')[2]).toEqual({users:['p95-0','p95-1','p95-2']});check(s);
});
test('mixed stop is serial: foreign first then own, ENDED_FROM names, without stopping file timer',async({page:p,context})=>{
    const s=await setup(p,context);await click(p,'files-start','startRefreshFiles()');let release;s.hold=new Promise(r=>release=r);
    await click(p,'exam-stop-running','stopRunningExams()');await confirm(p);await expect.poll(()=>s.calls.filter(c=>c[0]==='PATCH').length).toBe(1);expect((await snapshot(p)).changed).toBe(false);
    release();s.hold=null;await expect.poll(()=>s.calls.filter(c=>c[0]==='PATCH').length).toBe(2);await expect(wait(p)).toBeHidden();
    const patches=s.calls.filter(c=>c[0]==='PATCH');expect(patches.map(c=>[c[2].session.members[0].cn,c[2].session.name,c[2].session.type])).toEqual(['p95-0','p95-1'].map(cn=>[cn,`p95-class_${cn}_ENDED_FROM_${settings.roles[1].login}`,'']));
    expect((await snapshot(p)).polling).toBe(true);check(s);
});
test('single foreign stop cancel and accept refreshes with exact member/name and leaves stateChanged alone',async({page:p,context})=>{
    const s=await setup(p,context);await click(p,'exam-stop-user','stopUserExam(participant)');await confirm(p,false);expect(s.calls.filter(c=>c[0]==='PATCH')).toEqual([]);
    await click(p,'exam-stop-user','stopUserExam(participant)');await confirm(p);await expect.poll(()=>s.calls.filter(c=>c[1]===base+'userinfo').length).toBe(1);await expect(wait(p)).toBeHidden();expect(s.calls.find(c=>c[0]==='PATCH')[2].session).toEqual({members:[{...users(settings.roles[1].login)[0],files_error:''}],name:`p95-class_p95-0_ENDED_FROM_${settings.roles[1].login}`,type:''});expect((await snapshot(p)).changed).toBe(false);check(s);
});
test('own whole stop clears examMode/stops timer immediately and clears stateChanged before refresh completion',async({page:p,context})=>{
    const s=await setup(p,context,'own');await click(p,'files-start','startRefreshFiles()');let release;s.hold=new Promise(r=>release=r);await click(p,'exam-stop-all','stopExam()');await confirm(p);await expect.poll(()=>s.calls.filter(c=>c[0]==='PATCH').length).toBe(1);
    expect(await snapshot(p).then(x=>[x.changed,x.mode,x.polling])).toEqual([true,false,false]);release();s.hold=null;await expect(wait(p)).toBeHidden();expect((await snapshot(p)).changed).toBe(false);
    const target=s.calls.find(c=>c[0]==='PATCH')[2].session;expect([target.name,target.type,target.members.map(u=>u.cn)]).toEqual(['p95','group',['p95-0','p95-1','p95-2']]);check(s);
});
test('management single and all preserve no prefix and filter bulk to student/examuser, report API errors',async({page:p,context})=>{
    test.setTimeout(60000);const s=await setup(p,context,'none');
    for(const group of ['wifi','internet','printing']) {
        await click(p,`management-${group}`,`setManagementGroup('${group}', participant)`);await expect.poll(()=>s.calls.filter(c=>c[1]==='/api/lmn/managementgroup').length).toBe(['wifi','internet','printing'].indexOf(group)*3+1);
        await click(p,`management-all-${group}`,`setManagementGroupAll('${group}')`);await click(p,`management-all-${group}`,`setManagementGroupAll('${group}')`);
    }
    await expect.poll(()=>s.calls.filter(c=>c[1]==='/api/lmn/managementgroup').length).toBe(9);
    expect(s.calls.filter(c=>c[1]==='/api/lmn/managementgroup').map(c=>c[2])).toEqual(['wifi','internet','printing'].flatMap(group=>[{group:group==='internet'?'no'+group:group,users:['p95-0']},{group:group==='internet'?'no'+group:group,users:['p95-0','p95-1']},{group:group==='internet'?group:'no'+group,users:['p95-0','p95-1']}]));
    for(const error of ['LMN API unavailable','fixture API error']) {s.fail=error;await click(p,'management-all-wifi',"setManagementGroupAll('wifi')");await expect(p.locator('body')).toContainText(error);await expect.poll(()=>snapshot(p).then(x=>x.changed)).toBe(false);if(await msg(p).isVisible())await msg(p).locator('.negative').click();await p.mouse.move(0,0);}check(s);
});
test('rejected exam start preserves hanging wait/stateChanged and running file timer',async({page:p,context})=>{
    const s=await setup(p,context,'none');s.fail='fixture exam denied';await click(p,'files-start','startRefreshFiles()');await click(p,'exam-start-all','startExam()');await confirm(p);await expect(p.locator('body')).toContainText(s.fail);await expect(wait(p)).toBeVisible();expect(await snapshot(p).then(x=>[x.changed,x.polling])).toEqual([true,true]);expect(s.calls.filter(c=>c[1]===base+'exam/userinfo')).toEqual([]);expect(s.blocked).toEqual([]);
});
