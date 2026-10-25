// Offline real Vue common-file fixtures. No VM, credentials or network.
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
const previous = path => execFileSync('git', ['show', `da2f691f0:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const components = ['UserDetails', 'CustomPassword', 'ShowPassword', 'CheckDialog', 'CheckResultsDialog', 'ApplyDialog'];
const entry = `import { createApp, h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import { createModalService } from '${frontend}/src/shell/modal.mjs';
import { createPresentation, ShellServices } from '${frontend}/src/shell/presentation.mjs';
import { user } from '${frontend}/e2e/fixtures/users_1.mjs';
import { result } from '${frontend}/e2e/fixtures/users_3.mjs';
${components.map(name => `import ${name} from '${frontend}/src/common/users/${name}.vue';`).join('\n')}
const scene = window.fixtureScene;
const aj = createMockAj({ identity: { user:'global-admin', profile:{isAdmin:true} }, http: async request => {
 if(request.url==='/api/lmn/ldap-search') return {data:[{login:'parent-fixture',label:'Synthetic Parent',displayName:'Synthetic Parent',role:'teacher'}]};
 if(request.url.includes('/sophomorixUsers/')) return {data:[user()]};
 if(request.url.includes('/quota/')) return {data:{home:{used:75,hard_limit:100},small:{used:20,hard_limit:100},full:{used:95,hard_limit:100}}};
 if(request.url.includes('/config/')) return {data:{proxyAddresses:{show:true},custom:{1:{show:true}},customMulti:{1:{show:true}}}};
 if(request.url.includes('/log')) return {data:'Synthetic work log'};
 if(request.url.includes('/check')) {const data=result();data.CHECK_RESULT.ERRORLIST=['synthetic'];return {data};}
 if(request.method !== 'get') throw Error('No writes allowed by local fixture');
 // Password display uses an empty value: no password enters screenshots/DOM logs.
 return {data:''};
} });
aj.modal=createModalService(()=>aj);
const presentation=createPresentation({http:aj.http,identity:aj.identity,navigate:()=>{},getAj:()=>aj});
aj.messagebox=presentation.messagebox;
const app=createApp({render:()=>h(ShellServices,{services:presentation})});app.mount('#fixture');
let component,props;
if(scene.startsWith('details') || scene==='delete' || scene==='parents') {component=UserDetails;props={id:'fixture',role:'students'};}
else if(scene.startsWith('password')) {component=CustomPassword;props={users:[user()],pwtype:'current'};}
else if(scene==='show-password') {component=ShowPassword;props={username:'fixture'};}
else if(scene==='check-error') {component=CheckDialog;props={};}
else if(scene.startsWith('results')) {component=CheckResultsDialog;props={data:result()};}
else {component=ApplyDialog;props={params:{doAdd:false,doMove:true,doKill:false}};aj.http.post=()=>new Promise(()=>{});}
aj.modal.open(component,props,{size:'lg'}).catch(()=>{});
window.fixture={ready:true,dispose(){aj.modal.dispose();presentation.dispose();app.unmount();}};
`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture-source', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && id.startsWith(join(frontend, 'src/common/')) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const scene of ['details','password','show-password','check-error','results','results-move','results-error','apply','delete','password-hover','results-hover','results-focus','results-keyboard-active','parents']) {
        if (only && !only.includes(scene)) continue;
        for (const [width, height] of [[1440,900],[768,1024],[390,844]]) {
            const shots = [], states = [];
            for (const name of ['before','after']) {
                const page = await browser.newPage({ viewport: { width, height }, timezoneId: 'UTC', locale: 'en-GB' });
                await page.route('**/*', route => route.abort());
                await page.setContent('<!doctype html><html><body class="customized"><div id="fixture" style="padding:20px"></div></body></html>');
                await page.addStyleTag({ content: css[name] });
                await page.evaluate(scene => { window.fixtureScene = scene; }, scene);
                await page.addScriptTag({ type: 'module', content: bundles[name] });
                await page.waitForFunction(() => window.fixture?.ready);
                await page.waitForTimeout(800);
                if(scene==='parents') { await page.locator('[data-action=parent-search]').dispatchEvent('click'); await page.locator('dialog[open] input').fill('syn'); await page.waitForTimeout(300); }
                if(scene==='delete') await page.locator('[data-action=kill]').click();
                if(scene==='results-move') await page.locator('.nav-tabs a').nth(2).click();
                if(scene==='results-error') await page.locator('.nav-tabs a').nth(4).click();
                await page.evaluate(() => document.activeElement?.blur());
                await page.mouse.move(width - 1, height - 1);
                const button=page.locator('.modal-footer :is(button,a)').last();
                if(scene==='password-hover' || scene==='results-hover') await button.hover();
                if(scene==='results-focus' || scene==='results-keyboard-active') await button.focus();
                if(scene==='results-keyboard-active') await page.keyboard.down(' ');
                await page.waitForTimeout(350);
                shots.push(await page.screenshot({ path: join(output, `${scene}-${width}-${name}.png`) }));
                states.push(await page.locator('.modal-dialog, .modal-header, .modal-body, .modal-footer, button, input, textarea, pre, [role=progressbar], .card, .panel, .card-header, .panel-heading, .card-body, .panel-body, .badge, .label, .nav-tabs a, .dropdown-menu, .dropdown-menu a').evaluateAll(elements => elements.map(el => {
                    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
                    return { tag: el.tagName, text: el.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        color: style.color, background: style.backgroundColor, padding: style.padding, margin: style.margin, lineHeight: style.lineHeight, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, opacity: style.opacity, fontSize: style.fontSize, display: style.display, position: style.position, fontWeight: style.fontWeight, textAlign: style.textAlign, focusVisible: el.matches(':focus-visible'), active: el.matches(':active') };
                })));
                await page.evaluate(() => window.fixture.dispose());
                await page.close();
            }
            results.push({ scene, width, equal: shots[0].equals(shots[1]), geometryEqual: JSON.stringify(states[0]) === JSON.stringify(states[1]), before: states[0], after: states[1] });
        }
    }
} finally { await browser.close(); }
await writeFile(join(output, 'metadata.json'), JSON.stringify({ reference: 'da2f691f0', cssSha256: Object.fromEntries(Object.entries(css).map(([key,value]) => [key, createHash('sha256').update(value).digest('hex')])) }, null, 2) + '\n');
await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.filter(r => r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r => r.geometryEqual).length} identical style/geometry snapshots`);
assert.ok(results.every(result => result.equal && result.geometryEqual), 'Inspect comparison.json');
