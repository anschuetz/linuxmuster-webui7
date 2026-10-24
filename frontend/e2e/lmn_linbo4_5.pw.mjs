import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
import { imageList, backupImage } from './fixtures/linbo4-images.mjs';
const base='/api/lmn/linbo4',path='/view/lmn/linbo4';
const vue=process.env.P87_UI==='vue';
const admin=settings.roles.find(r=>r.name==='global-admin');
const allowed=[admin,{name:'school-admin',login:'pgmadmin',pw:admin.pw}];
const denied=[settings.roles.find(r=>r.name==='teacher'),{name:'student',login:'serdarje',pw:admin.pw}];
const pane=page=>vue?page.locator('lmn-vue-mount'):page.locator('.tab-pane.active');
const dialog=page=>page.locator('.modal:visible:not([aria-hidden="true"])').last();
const box=page=>page.locator('.messagebox:visible').last();
test.setTimeout(90_000);
async function login(page, role, state) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page).toHaveURL(/\/view\//);
    await page.waitForFunction(() => window.angular?.element(document).injector()?.get('identity').profile?.activeSchool);
    state.authenticated = true;
}
function listen(page) {
    const state = { offsets: [], imports: [], errors: [], blocked: [], writes: [], authenticated: false };
    page.on('pageerror', e => state.errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !(!state.authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) state.errors.push(m.text()); });
    return state;
}
const images=()=>{const data=imageList();data[0].backups={
 '20261001':backupImage(),
 '20261003':{...backupImage(),timestamp:300,desc:'Newest\nbackup'},
 '20261002':{...backupImage(),timestamp:200,desc:'Middle'},
};return data;};
async function fixture(page,context,state) {
    // Every write, including unrelated API writes after login, is denied unless
    // explicitly fulfilled below. restart-services is a write despite using GET.
    await context.route('**/api/**',async route=>{
        const req=route.request(),p=new URL(req.url()).pathname;
        if(req.method()==='GET'&&p===base+'/configs') {
            await page.waitForFunction(()=>window.angular?.element(document).injector()?.get('identity').profile?.activeSchool);
            return route.fulfill({json:[{file:'start.conf.one',images:['p86.qcow2'],settings:{}}]});
        }
        if(req.method()==='GET'&&p===base+'/images')return route.fulfill({json:images()});
        if(req.method()==='GET'&&p.startsWith(base+'/examples/'))return route.fulfill({json:[]});
        const expected=(req.method()==='DELETE'&&[base+'/images/p86',base+'/images/source',base+'/deleteDiffImage/p86'].includes(p))
            ||(req.method()==='POST'&&[base+'/deleteBackupImage/p86',base+'/restoreBackupImage/p86',base+'/saveBackupImage/p86'].includes(p))
            ||(req.method()==='GET'&&p===base+'/restart-services');
        if(expected) {
            state.writes.push([req.method(),p,req.postData()?req.postDataJSON():null]);
            const reply=()=>route.fulfill(state.fail===p?{status:500,json:{message:'P87 fixture failure',exception:'EndpointError'}}:{json:null});
            if(state.hold && req.method()==='DELETE') {state.pending??=[];state.pending.push(reply);return;}
            return reply();
        }
        if((state.authenticated&&!['GET','HEAD','OPTIONS'].includes(req.method()))||p===base+'/restart-services') {
            state.blocked.push([req.method(),p]);return route.abort('blockedbyclient');
        }
        return route.continue();
    });
}
async function start(page,context,role) {
    const state=listen(page);await fixture(page,context,state);await login(page,role,state);
    await page.goto(path+'#images');await expect(pane(page).locator('tbody tr, tr[ng\\:repeat="image in images"]').first()).toBeVisible();return state;
}
const row=(page,name='p86')=>pane(page).locator('tr').filter({has:page.locator('b',{hasText:new RegExp('^'+name+'$')})}).first();
const clickAction=(target,action,angular)=>target.locator(vue?`[data-action="${action}"]`:`button[ng\\:click="${angular}"]`).click();
async function backups(page) {await clickAction(row(page),'backups','showBackups(image)');await expect(dialog(page).locator('h4')).toContainText('p86');}
const backupRow=(page,date)=>dialog(page).locator('tr').filter({has:page.locator('b',{hasText:new RegExp('^'+date+'$')})});
function clean(state) {expect(state.blocked).toEqual([]);expect(state.errors.filter(e=>!/500 \(Internal Server Error\)/i.test(e))).toEqual([]);}
const close=page=>dialog(page).getByText(/^(Close|Schließen)$/,{exact:true}).last().click();
const actions=[
 ['main','delete','deleteImage(image)','DELETE','/images/p86',null,/including files added by hand|manuell/],
 ['diff','delete-diff','deleteDiffImage(image.diff_image)','DELETE','/deleteDiffImage/p86',null,/differential|differentiell/i],
 ['backup','delete-backup','$parent.deleteBackupImage(image, backup.date)','POST','/deleteBackupImage/p86',{date:'20261003'},/20261003/],
 ['restore','restore-backup','$parent.restoreBackup(image, backup.date)','POST','/restoreBackupImage/p86',{date:'20261003'},/actual image|aktuelle|momentane/i],
];
for(const role of allowed) {
 test(`${role.name}: backup order, explicit edit, saved map/list metadata and close`,async({page,context})=>{
    const state=await start(page,context,role);await backups(page);
    expect(await dialog(page).locator('tr').filter({has:page.locator('.fa-history')}).locator('td:nth-child(2) b').allTextContents()).toEqual(['20261003','20261002','20261001']);
    await clickAction(backupRow(page,'20261003'),'edit-backup','$parent.editImage(backup)');
    const model=dialog(page).locator('[data-model="image.desc"], [ng\\:model="image.desc"]');await model.fill('  P87 saved backup  ');
    state.fail=base+'/restart-services';
    await dialog(page).getByText(/^(Save|Speichern)$/,{exact:true}).last().click();await expect.poll(()=>state.writes.length).toBe(2);
    const expected={...backupImage(),timestamp:300,desc:'P87 saved backup',date:'20261003'};
    expect(state.writes).toEqual([['POST',base+'/saveBackupImage/p86',{data:expected,timestamp:300}],['GET',base+'/restart-services',null]]);
    await expect(backupRow(page,'20261003')).toContainText('P87 saved backup');
    await clickAction(backupRow(page,'20261003'),'edit-backup','$parent.editImage(backup)');await expect(model).toHaveValue('P87 saved backup');await close(page);await close(page);clean(state);
 });
 for(const [kind,action,angular,method,url,payload,warning] of actions) test(`${role.name}: ${kind} cancel, exact write, one restart and error`,async({page,context})=>{
    const state=await start(page,context,role);
    async function trigger() {
        if(kind==='backup'||kind==='restore') {await backups(page);await clickAction(backupRow(page,'20261003'),action,angular);}
        else await clickAction(row(page),action,angular);
    }
    await trigger();await expect(box(page)).toContainText(warning);await box(page).locator('.negative').click();expect(state.writes).toEqual([]);
    if(kind==='backup'||kind==='restore')await close(page);
    await trigger();await box(page).locator('.positive').click();await expect.poll(()=>state.writes.length).toBe(2);
    expect(state.writes).toEqual([[method,base+url,payload],['GET',base+'/restart-services',null]]);
    // Start an independent route instance after the success/reload sequence.
    await page.reload();await expect(row(page)).toBeVisible();state.writes=[];state.fail=base+url;
    await trigger();await box(page).locator('.positive').click();await expect(page.locator('.toast-error').last()).toContainText('P87 fixture failure');
    expect(state.writes).toEqual([[method,base+url,payload]]);clean(state);
 });
 test(`${role.name}: selection order, batch cancel, parallel requests and exactly one final restart`,async({page,context})=>{
    const state=await start(page,context,role);
    await row(page,'source').locator('input[type=checkbox]').check();await row(page).locator('input[type=checkbox]').check();
    const trigger=()=>vue?pane(page).locator('[data-action="delete-selected"]').click():pane(page).locator('button[ng\\:click="deleteImages()"]').click();
    await trigger();await expect(box(page)).toContainText('source,p86');await box(page).locator('.negative').click();expect(state.writes).toEqual([]);
    state.hold=true;await trigger();await box(page).locator('.positive').click();await expect.poll(()=>state.pending?.length).toBe(2);
    expect(state.writes).toEqual([['DELETE',base+'/images/source',null],['DELETE',base+'/images/p86',null]]);
    await state.pending[0]();await page.waitForTimeout(100);expect(state.writes.length).toBe(2);
    await state.pending[1]();await expect.poll(()=>state.writes.length).toBe(3);expect(state.writes.at(-1)).toEqual(['GET',base+'/restart-services',null]);clean(state);
 });
 test(`${role.name}: batch partial failure never restarts`,async({page,context})=>{
    const state=await start(page,context,role);state.fail=base+'/images/source';
    await row(page).locator('input[type=checkbox]').check();await row(page,'source').locator('input[type=checkbox]').check();
    if(vue)await pane(page).locator('[data-action="delete-selected"]').click();else await pane(page).locator('button[ng\\:click="deleteImages()"]').click();
    await box(page).locator('.positive').click();await expect(page.locator('.toast-error').last()).toContainText('P87 fixture failure');
    expect(state.writes).toEqual([['DELETE',base+'/images/p86',null],['DELETE',base+'/images/source',null]]);clean(state);
 });
}
for(const role of denied)test(`${role.name}: no sidebar and direct lists/dialog data forbidden`,async({page})=>{
    const state=listen(page);await login(page,role,state);await expect(page.locator('a[href^="/view/lmn/linbo4"]')).toHaveCount(0);
    for(const suffix of ['/configs','/images','/config/start.conf.p87','/vdi/p87.vdi','/examples/reg','/icons'])expect((await page.request.get(base+suffix)).status()).toBe(403);clean(state);
});
