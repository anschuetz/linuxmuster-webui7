import { observeRoute } from './session_route.mjs';
import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { settings } from './playwright.config.mjs';
import { session, users, items, teacherHome } from './fixtures/session_files.mjs';
const fullRoute = process.env.P96_ROUTE === '1';
const vue = process.env.P94_UI === 'vue', base = '/api/lmn/session/', detail = '/view/lmn/session';
const pane = p => p.locator(vue && !fullRoute ? '#p94-mount' : '[ng\\:view]');
async function path(p, value) { await p.evaluate(v => { const i = angular.element(document).injector(); i.get('$rootScope').$evalAsync(() => i.get('$location').path(v)); }, value); await p.waitForURL('**' + value); }
async function setup(p, context, foreign = false) {
    const s = { listing: [], calls: [], blocked: [], errors: [] };
    p.on('pageerror', e => s.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())) s.errors.push(m.text()); });
    await context.route('**/api/**', route => {
        const r = route.request(), path = new URL(r.url()).pathname;
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && path.startsWith('/api/lmn/')) { s.blocked.push([r.method(), path]); return route.abort('blockedbyclient'); } return route.continue();
    });
    await p.route('**/api/lmn/**', async route => {
        const r = route.request(), path = new URL(r.url()).pathname, data = r.postData() && !path.endsWith('/upload') ? r.postDataJSON() : undefined;
        let result;
        if (path === '/api/lmn/smbclient/list') result = {items: s.listing};
        else if (/\/(directory|copy|move|unlink|rmdir)$/.test(path)) result = {};
        else if (path.endsWith('/finish-upload')) result = [];
        else if (path.endsWith('/upload')) { if (r.method() === 'POST') await new Promise(resolve => setTimeout(resolve, /name="flowChunkNumber"\r\n\r\n3/.test(r.postData()) ? 1000 : 150)); s.calls.push([r.method(), path, r.method() === 'GET' ? new URL(r.url()).search : r.postData()]); return route.fulfill({status: r.method() === 'GET' ? 204 : 200, body: ''}); }
        else if (path.endsWith('/createSessionWorkingDirectory')) result = {};
        else return route.fallback();
        s.calls.push([r.method(), path, data]); return route.fulfill({ json: result });
    });
    await p.goto('/'); await p.locator('input[ng\\:model="username"]').fill(settings.roles[1].login); await p.locator('input[type=password][ng\\:model="password"]').fill(settings.roles[1].pw); await p.locator('a[ng\\:click^="login"]').click(); await p.waitForURL('**/view/**'); await p.waitForLoadState('networkidle');
    await p.evaluate(() => { const i = angular.element(document).injector(); i.get('$rootScope').$apply(() => i.get('gettextCatalog').setCurrentLanguage('de')); });
    await path(p, '/view/lmn/landingpage');
    await p.clock.setFixedTime(new Date('2026-10-24T12:34:56'));
    await p.evaluate(() => { angular.element(document).injector().get('identity').profile.homeDirectory = '\\\\P94\\fixture\\teacher'; });
    if (vue && fullRoute) { await observeRoute(p, 'p94', session(foreign)); await path(p, detail); } else if (vue) {
        for (const file of ['lmn_common/resources/vue/bridge.js', 'lmn_session_new/resources/vue/lmn_session_new.js']) await p.addScriptTag({ path: fileURLToPath(new URL('../../usr/lib/linuxmuster-webui/plugins/' + file, import.meta.url)) });
        await p.evaluate(data => {
            const i = angular.element(document).injector(), node = document.createElement('div'); node.id = 'p94-mount'; document.querySelector('[ng\\:view]').style.display = 'none'; document.body.append(node);
            const names = ['$http', 'notify', 'toaster', 'gettextCatalog', 'identity', '$location', '$route', 'pageTitle', 'messagebox', '$rootScope'];
            const entry = { mount(el, aj) { window.p94aj = aj; aj.navigate = value => { const event = value === '/view/lmn/session' ? null : i.get('$rootScope').$broadcast('$locationChangeStart', value); if (!event?.defaultPrevented) window.p94path = value; }; const store = LmnVue_lmn_session_new.getSessionStore(aj); store.state.current = data; store.filterExamUsers(); window.p94unmount = LmnVue_lmn_session_new.mountDetail(el, aj); return window.p94unmount; } };
            LmnVueBridge.mountBridge(i.get('$route').current.scope.$new(), node, entry, Object.fromEntries(names.map(n => [n, i.get(n)])));
        }, session(foreign));
    } else {
        await p.evaluate(data => { const i = angular.element(document).injector(); i.get('lmnSession').current = data; i.get('lmnSession').filterExamUsers(); }, session(foreign)); await path(p, detail);
    }
    await expect.poll(() => s.calls.filter(c => c[1].endsWith('/createSessionWorkingDirectory')).length).toBe(1); return s;
}
const M = '/api/lmn/smbclient/';
const dialog = p => p.locator('.modal:visible').last();
const click = async (p, name, old) => { const el = pane(p).locator(vue ? `[data-${name}]` : `[ng\\:click="${old}"]`).first(); if (!await el.isVisible()) { const toggle = el.locator(vue ? 'xpath=../../..' : 'xpath=ancestor::*[@uib-dropdown][1]').locator('[uib-dropdown-toggle], [data-collect-toggle]').first(); await toggle.click(); } await el.click(); };
const check = s => { expect(s.blocked).toEqual([]); expect(s.errors).toEqual([]); };
const select = async (p, name) => { const row = dialog(p).locator(vue ? '[data-item]' : '[test-bind-item]').filter({hasText: name}); await row.locator(vue ? 'input[type=checkbox]' : '[checkbox]').click(); };
const accept = p => dialog(p).locator(vue ? '[data-save]' : '[ng\\:click="save()"]' ).click();
const close = p => dialog(p).locator(vue ? '[data-close]' : '[ng\\:click="close()"]' ).click();
async function listed(p, s, action='share-all', old='shareAll()') { s.listing = items(teacherHome + '\\transfer'); await click(p, action, old); await expect(dialog(p).locator(vue ? '[data-item]' : '[test-bind-item]')).toHaveCount(3); }
test('share all filters student/examuser, retains backend selection order; single and cancel', async ({page:p,context}) => {
    const s=await setup(p,context); await listed(p,s); await select(p,'a.txt'); await select(p,'z.txt'); await accept(p);
    await expect.poll(()=>s.calls.filter(c=>c[1]===M+'copy').length).toBe(4);
    expect(s.calls.filter(c=>c[1]===M+'copy').map(c=>c[2])).toEqual(users().slice(0,2).flatMap(u=>['z.txt','a.txt'].map(name=>({src:teacherHome+'\\transfer/'+name,dst:u.homeDirectory+'\\transfer\\'+settings.roles[1].login+'/'+name}))));
    await listed(p,s,'share-user','shareUser(participant)'); await close(p); expect(s.calls.filter(c=>c[1]===M+'copy').length).toBe(4);
    await listed(p,s,'share-user','shareUser(participant)'); await select(p,'Bdir'); await accept(p); await expect.poll(()=>s.calls.filter(c=>c[1]===M+'copy').length).toBe(5); check(s);
});
test('foreign exam blocks both all actions and hides own row actions', async ({page:p,context})=>{
    const s=await setup(p,context,true); await click(p,'share-all','shareAll()'); await p.locator('.messagebox:visible .positive').click(); await click(p,'collect-all-copy',"collectAll('copy')"); await p.locator('.messagebox:visible .positive').click();
    expect(s.calls.filter(c=>/\/(list|copy|move|directory)$/.test(c[1]))).toEqual([]); const row=pane(p).locator('tr').filter({hasText:'p94-0'}); await expect(row.locator(vue?'[data-share-user]':'[ng\\:click="shareUser(participant)"]')).toBeHidden(); check(s);
});
test('collect all copy/move exact timestamp/targets, sequence then recreate working directories',async({page:p,context})=>{
    const s=await setup(p,context); for(const operation of ['copy','move']) { const start=s.calls.length; await click(p,'collect-all-'+operation,`collectAll('${operation}')`); await expect.poll(()=>s.calls.slice(start).filter(c=>c[1]===M+'createSessionWorkingDirectory').length).toBe(1);
        const destination=teacherHome+'\\transfer\\collected\\group_p94_20261024-123456';
        expect(s.calls.slice(start)).toEqual([['POST',M+'directory',{path:destination}],...users().slice(0,2).map(u=>['POST',M+operation,{src:u.homeDirectory+'\\transfer\\'+settings.roles[1].login+'\\_collect',dst:destination+'\\'+u.sAMAccountName+'/'}]),['POST',M+'createSessionWorkingDirectory',{users:['p94-0','p94-1']}]]);
    } check(s);
});
test('single collect creates target before cancel, selected move/copy; archive without selection',async({page:p,context})=>{
    const s=await setup(p,context);s.listing=items('p94-own');
    for(const operation of ['copy','move']) { await click(p,'collect-user-'+operation,`collectUser('${operation}', participant)`); await expect(dialog(p)).toBeVisible(); await select(p,'z.txt');await accept(p);await expect.poll(()=>s.calls.filter(c=>c[1]===M+operation).length).toBe(1); expect(s.calls.filter(c=>c[1]===M+operation)[0][2]).toEqual({src:'p94-own/z.txt',dst:teacherHome+'\\transfer\\collected\\group_p94_20261024-123456\\p94-0/z.txt'}); }
    await click(p,'collect-user-copy',"collectUser('copy', participant)");await close(p);expect(s.calls.filter(c=>c[1]===M+'directory').length).toBe(3);
    await click(p,'archive','browseCollected()');await expect(dialog(p).locator(vue?'input[type=checkbox]':'[checkbox]')).toHaveCount(0);await close(p);check(s);
});
test('dialog sorts, navigates back; empty save stays open; invert-all includes hidden collected',async({page:p,context})=>{
    const s=await setup(p,context);await listed(p,s,'collect-user-copy',"collectUser('copy', participant)");const rows=()=>dialog(p).locator(vue?'[data-item]':'[test-bind-item]');expect(await rows().evaluateAll(es=>es.map(e=>e.getAttribute('data-item')||e.getAttribute('test-bind-item')))).toEqual(['Bdir','a.txt','z.txt']);
    await accept(p);await expect(dialog(p)).toBeVisible();s.listing=[];await rows().filter({hasText:'Bdir'}).locator(vue?'[data-open]':'[ng\\:click="load_path(item.path)"]').click();await expect(dialog(p)).toContainText('Leeres Verzeichnis');s.listing=items('p94-own');await dialog(p).locator(vue?'[data-back]':'[ng\\:click="back()"]' ).click();await expect(rows()).toHaveCount(3);
    await select(p,'a.txt');await dialog(p).locator(vue?'[data-toggle-all]':'[ng\\:click="toggleAll()"]' ).click();await accept(p);await expect.poll(()=>s.calls.filter(c=>c[1]===M+'copy').length).toBe(3);expect(s.calls.filter(c=>c[1]===M+'copy').map(c=>c[2].src)).toEqual(['p94-own/z.txt','p94-own/collected','p94-own/Bdir']);check(s);
});
test('directory/rename/delete file and directory with prompt/confirm cancellation',async({page:p,context})=>{
    const s=await setup(p,context);await listed(p,s);const msg=()=>p.locator('.messagebox:visible').last();
    const command=async(name,old)=>dialog(p).locator(vue?`[data-${name}]`:`[ng\\:click="${old}"]`).first().click();
    await command('mkdir','create_dir()');await msg().locator('.negative').click();expect(s.calls.filter(c=>c[1]===M+'directory')).toEqual([]);
    await command('mkdir','create_dir()');await msg().locator('input').fill('  inner space  ');await msg().locator('.positive').click();await expect.poll(()=>s.calls.filter(c=>c[1]===M+'directory').length).toBe(1);expect(s.calls.find(c=>c[1]===M+'directory')[2]).toEqual({path:teacherHome+'\\transfer/inner space'});
    await command('rename','rename(item)');await msg().locator('input').fill('renamed');await msg().locator('.positive').click();await expect.poll(()=>s.calls.filter(c=>c[1]===M+'move').length).toBe(1);expect(s.calls.find(c=>c[1]===M+'move')[2]).toEqual({src:teacherHome+'\\transfer/Bdir',dst:teacherHome+'\\transfer/renamed'});
    for(const [name,old,api] of [['delete-file','delete_file(item.path)','unlink'],['delete-dir','delete_dir(item.path)','rmdir']]) {await command(name,old);await msg().locator('.negative').click();expect(s.calls.filter(c=>c[1]===M+api)).toEqual([]);await command(name,old);await msg().locator('.positive').click();await expect.poll(()=>s.calls.filter(c=>c[1]===M+api).length).toBe(1);}
    await close(p);check(s);
});
test('real Flow chunks/progress and finish-upload payload use dialog path',async({page:p,context})=>{
    const s=await setup(p,context);await listed(p,s);await p.evaluate(()=>{window.p94PartialProgress=false;window.p94ProgressObserver=new MutationObserver(()=>{if(/\([1-9]\d? %\)/.test(document.querySelector('.uploads')?.textContent||''))window.p94PartialProgress=true;});window.p94ProgressObserver.observe(document.body,{subtree:true,childList:true,characterData:true});});const data=Buffer.alloc(3*1024*1024,65);await dialog(p).locator('input[type=file]').setInputFiles({name:'p94-upload.txt',mimeType:'text/plain',buffer:data});
    await expect.poll(()=>p.evaluate(()=>window.p94PartialProgress)).toBe(true);await p.evaluate(()=>window.p94ProgressObserver.disconnect());
    await expect.poll(()=>s.calls.filter(c=>c[1]===M+'finish-upload').length).toBe(1);const finish=s.calls.find(c=>c[1]===M+'finish-upload')[2];expect(finish).toEqual([{id:'3145728-p94-uploadtxt',name:'p94-upload.txt',path:teacherHome+'\\transfer'}]);
    const chunks=s.calls.filter(c=>c[0]==='POST'&&c[1]===M+'upload');expect(chunks.length).toBe(3);
    const fields=chunks.map(c=>Object.fromEntries([...c[2].matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)/g)].map(m=>[m[1],m[2]]))).sort((a,b)=>Number(a.flowChunkNumber)-Number(b.flowChunkNumber));
    expect(fields).toEqual([1,2,3].map(n=>({flowChunkNumber:String(n),flowChunkSize:'1048576',flowCurrentChunkSize:'1048576',flowTotalSize:'3145728',flowIdentifier:'3145728-p94-uploadtxt',flowFilename:'p94-upload.txt',flowRelativePath:'p94-upload.txt',flowTotalChunks:'3'})));
    const probes=s.calls.filter(c=>c[0]==='GET'&&c[1]===M+'upload').map(c=>Object.fromEntries(new URLSearchParams(c[2]))).sort((a,b)=>Number(a.flowChunkNumber)-Number(b.flowChunkNumber));expect(probes).toEqual(fields);await close(p);check(s);
});
