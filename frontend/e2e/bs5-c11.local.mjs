// P167 offline real Vue user-list/print/dialog fixtures. No VM, credentials or network.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2]; assert.ok(output, 'Pass local log directory');
await mkdir(output, { recursive: true });
const previous = path => execFileSync('git', ['show', `ff57e7463:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const entry = `import { createApp, h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import { rows } from '${frontend}/e2e/fixtures/users_7.mjs';
${['ListManagement','PrintPasswords','AddUserDialog','AddAdminDialog','PrintOptionsDialog','SortListDialog','UploadDialog','ShowBindPasswordDialog'].map(n=>`import ${n} from '${frontend}/src/plugins/lmn_users/${n}.vue';`).join('\n')}
const scene=window.fixtureScene, kind=scene.split(':')[0];
const aj=createMockAj({identity:{user:'global-admin',profile:{sophomorixRole:'globaladministrator',sophomorixAdminClass:'5a',activeSchool:'school-x'}},http:async r=>{
 if(r.url.includes('/bindpassword'))return {data:''};
 if(r.url.includes('/upload'))return new Promise(()=>{});
 if(r.method!=='get')throw Error('Fixture prohibits writes');
 if(r.url.includes('activeschool'))return {data:'school-x'};
 if(r.url.includes('/classes'))return {data:scene.includes('empty')?[]:['5a','5b','5c','']};
 if(r.url.includes('schoolconf'))return {data:{}};
 return {data:scene.includes('invalid')?[{class:'',first_name:'Synthetic',last_name:'Fixture',birthday:'',login:''}]:rows()};
},modal:{open:async()=>{throw Error('cancel');}}});
const components={lists:ListManagement,print:PrintPasswords,add:AddUserDialog,admin:AddAdminDialog,options:PrintOptionsDialog,sort:SortListDialog,upload:UploadDialog,bind:ShowBindPasswordDialog};
const props={add:{kind:'students'},admin:{role:'schooladmin'},options:{schoolclass:['5a'],user:'fixture',adminClass:'5a'},sort:{userlist:'students.csv',columns:Array.from({length:6},(_,i)=>({coloumn:i,data:['Synthetic '+i]}))},upload:{role:'students'},bind:{user:{sAMAccountName:'fixture'}}};
const component=components[kind];
const app=createApp({render:()=>kind==='lists'||kind==='print'?h(component,props[kind]):h('div',{class:'modal',style:'display:block'},h('div',{class:'modal-dialog modal-lg'},h('div',{class:'modal-content'},h(component,props[kind]))))});app.provide('aj',aj);app.mount('#fixture');
window.fixture={ready:true,dispose(){app.unmount();}};
`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture-source', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && id.startsWith(join(frontend, 'src/plugins/lmn_users/')) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const theme = process.env.C11_THEME ?? 'customized';
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const scene of [...['lists','print','add','admin','options','sort','upload','bind'].flatMap(n=>['normal','hover','focus','active','space'].map(state=>n+':'+state)),...['sort','fields','rows','csv','tab-hover','tab-focus','active-tab-hover','active-tab-focus','parents','teachers','extrastudents','staff','invalid','paging'].map(x=>'lists:'+x),'print:empty','print:selected','options:csv','options:space-checkbox','sort:custom','upload:progress']) {
        if (only && !only.includes(scene)) continue;
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
            const shots = [], states = [];
            for (const name of ['before','after']) {
                const page = await browser.newPage({ viewport: { width, height }, timezoneId: 'UTC', locale: 'en-GB' });
                await page.route('**/*', route => route.abort());
                await page.setContent(`<!doctype html><html><body class="${theme}"><div id="fixture" style="padding:20px"></div></body></html>`);
                await page.addStyleTag({ content: css[name] });
                await page.evaluate(scene => { window.fixtureScene = scene; }, scene);
                await page.addScriptTag({ type: 'module', content: bundles[name] });
                await page.waitForFunction(() => window.fixture?.ready);
                await page.waitForTimeout(800);
                const [kind,state]=scene.split(':');
                const visible=page.locator('[data-list]:visible');
                if(kind==='lists') {
                    if(['parents','teachers','extrastudents','staff'].includes(state))await page.locator('[data-tab='+state+']').click();
                    if(['sort','fields','rows','csv'].includes(state))await visible.locator('[data-action='+state+'-menu]').click();
                    if(state==='invalid')await visible.locator('[data-action=check]').click();
                    if(state==='paging'){await visible.locator('[data-action=rows-menu]').click();await visible.locator('.dropdown-menu input[type=number]').fill('1');await visible.locator('[data-action=rows-menu]').click();await visible.locator('[data-page=\"2\"]').click();}
                }
                if(scene==='print:selected')await page.locator('input[type=checkbox]').first().check();
                if(scene==='options:csv')await page.locator('[data-format=csv]').click();
                if(scene==='options:space-checkbox'){await page.locator('[role=checkbox]').first().focus();await page.keyboard.press(' ');}
                if(scene==='sort:custom')await page.locator('input[type=checkbox]').check();
                if(scene==='upload:progress')await page.locator('input[type=file]').first().setInputFiles({name:'synthetic.csv',mimeType:'text/csv',buffer:Buffer.from('Synthetic')});
                await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(width-1,height-1);
                const button=kind==='lists'?visible.locator('[data-action=sort-menu]'):kind==='print'?page.locator('[data-action=pdf]').first():page.locator('.modal-footer :is(button,a)').first();
                if(state==='hover')await button.hover();
                if(state==='focus'||state==='space') {await button.evaluate(el=>el.tabIndex=0);await button.focus();}
                if(state==='space')await page.keyboard.down(' ');
                if(state==='active'){await button.hover();await page.mouse.down();}
                if(state.includes('tab-')) {
                    const tab=page.locator('[data-tab='+(state.startsWith('active')?'students':'parents')+']');
                    if(state.endsWith('focus')){await page.keyboard.press('Tab');await tab.focus();assert.ok(await tab.evaluate(el=>el.matches(':focus-visible')));}
                    else await tab.hover();
                }
                await page.waitForTimeout(350);
                shots.push(await page.screenshot({ path: join(output, `${scene}-${width}-${name}.png`) }));
                states.push(await page.locator('button, input, table, th, td, .progress-bar, .badge, .label, .nav-tabs a, .dropdown-menu, .dropdown-menu a, .pagination a, .pagination li, .pagination, .input-group-addon, .c10-addon').evaluateAll(elements => elements.map(el => {
                    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
                    return { tag: el.tagName, text: el.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        color: style.color, background: style.backgroundColor, padding: style.padding, margin: style.margin, lineHeight: style.lineHeight, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, opacity: style.opacity, fontSize: style.fontSize, display: style.display, position: style.position, fontWeight: style.fontWeight, textAlign: style.textAlign, zIndex: style.zIndex, isolation: style.isolation, float: style.cssFloat, backgroundClip: style.backgroundClip, backgroundImage: style.backgroundImage, listStyle: style.listStyle, focusVisible: el.matches(':focus-visible'), active: el.matches(':active') };
                })));
                await page.evaluate(() => window.fixture.dispose());
                await page.close();
            }
            let pixelDifference;
            if (!shots[0].equals(shots[1])) {
                const probe = await browser.newPage();
                pixelDifference = await probe.evaluate(async urls => {
                    const pixels = await Promise.all(urls.map(async url => {
                        const img = new Image(); img.src = url; await img.decode();
                        const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
                        const context = canvas.getContext('2d'); context.drawImage(img, 0, 0);
                        return context.getImageData(0, 0, img.width, img.height).data;
                    }));
                    let changedPixels = 0, maxDelta = 0;
                    for (let i = 0; i < pixels[0].length; i += 4) {
                        let delta = 0;
                        for (let channel = 0; channel < 4; channel++) delta = Math.max(delta, Math.abs(pixels[0][i + channel] - pixels[1][i + channel]));
                        if (delta) changedPixels++; maxDelta = Math.max(maxDelta, delta);
                    }
                    return { changedPixels, maxDelta };
                }, shots.map(shot => 'data:image/png;base64,' + shot.toString('base64')));
                await probe.close();
            }
            results.push({ scene, width, equal: shots[0].equals(shots[1]), geometryEqual: JSON.stringify(states[0]) === JSON.stringify(states[1]), pixelDifference, before: states[0], after: states[1] });
        }
    }
} finally { await browser.close(); }
await writeFile(join(output, 'metadata.json'), JSON.stringify({ reference: 'ff57e7463', cssSha256: Object.fromEntries(Object.entries(css).map(([key,value]) => [key, createHash('sha256').update(value).digest('hex')])) }, null, 2) + '\n');
await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.filter(r => r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r => r.geometryEqual).length} identical style/geometry snapshots`);
// C11 has no assigned mobile correction: every viewport must remain pixel-identical.
// Paging has one independently measured rounded-border raster edge (delta 1), with all measured CSS and geometry identical.
assert.ok(results.every(r => r.equal || r.scene === 'lists:paging' && r.geometryEqual && r.pixelDifference?.changedPixels === 1 && r.pixelDifference.maxDelta === 1), 'Inspect comparison.json');
