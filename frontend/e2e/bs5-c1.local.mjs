// Offline real Vue C1 fixtures. No VM, credentials or network.
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
const previous = path => execFileSync('git', ['show', `2ffbc6257:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const components = {
 Landingpage:'lmn_landingpage/Landingpage', CustomFields:'lmn_landingpage/CustomFields', WebappQR:'lmn_landingpage/WebappQR', Wireguard:'lmn_landingpage/Wireguard',
 Links:'lmn_links/components/Links', SchoolSwitcher:'lmn_common/components/SchoolSwitcher', Nextcloud:'lmn_nextcloud/components/Nextcloud'
};
const entry = `import { createApp, h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import { createModalService } from '${frontend}/src/shell/modal.mjs';
import { createPresentation, ShellServices } from '${frontend}/src/shell/presentation.mjs';
${Object.entries(components).map(([name,path])=>`import ${name} from '${frontend}/src/plugins/${path}.vue';`).join('\n')}
const scene=window.fixtureScene;
const profile={givenName:'Synthetic',sn:'User',sAMAccountName:'fixture',mail:['synthetic@example.invalid'],sophomorixRole:scene==='landing-student'?'student':scene==='landing-admin'?'globaladministrator':'teacher',sophomorixSchoolname:'default-school',sophomorixAdminClass:'teachers',memberOf:['CN=teachers,OU=Teachers,DC=x'],school_show:scene!=='schools-hidden'};
const fields=[{title:'Synthetic field',attr:'sophomorixCustomMulti1',value:['Example'],editable:true}];
const aj=createMockAj({identity:{user:'fixture',profile},http:async ({url,method})=>{
 if(url.endsWith('display_options'))return {data:{show_webdav:true,show_wireguard:true}};
 if(url.endsWith('customfields'))return {data:fields};
 if(url.includes('/quota/'))return {data:{home:{used:20,hard_limit:100},group:{used:70,hard_limit:100},full:{used:95,hard_limit:100},error:{ERROR:true}}};
 if(url.endsWith('/links'))return {data:{status:'success',data:scene==='links-empty'?{}:{one:{title:'Synthetic Link',description:'Synthetic description',link:'https://example.invalid/',icon:'',permissions:{teacher:true}}}}};
 if(url.endsWith('list-schools'))return {data:[{school:'default-school',schoolname:'Synthetic School'},{school:'other-school',schoolname:'Other School'}]};
 if(url.endsWith('activeschool'))return {data:'default-school'};
 if(url.endsWith('get-schoolname'))return {data:'Synthetic School'};
 if(url.endsWith('/nextcloud'))return {data:[scene==='nextcloud-error'?404:200,'about:blank',false,false]};
 if(url.endsWith('/qrcode'))return {data:{displayName:'Synthetic',url:'https://example.invalid',username:'fixture',qrcode:''}};
 if(url.endsWith('/wireguard'))return {data:{status:'disconnected'}};
 throw Error('Unexpected fixture request '+method+' '+url);
}});
window.open=()=>{};aj.shell={toggleNavigation(){},toggleWidescreen(){}};
aj.modal=createModalService(()=>aj);
const presentation=createPresentation({http:aj.http,identity:aj.identity,navigate:()=>{},getAj:()=>aj});aj.messagebox=presentation.messagebox;
let component,props={};
if(scene.startsWith('landing'))component=Landingpage;
else if(scene.startsWith('links'))component=Links;
else if(scene.startsWith('schools'))component=SchoolSwitcher;
else if(scene.startsWith('nextcloud'))component=Nextcloud;
else if(scene.startsWith('custom')){component=CustomFields;props={fields,user:profile};}
else if(scene.startsWith('webapp'))component=WebappQR;
else {component=Wireguard;props={peer:'synthetic',qr:false,data:scene==='wireguard-empty'?null:{data:'Synthetic configuration'}};}
const dialog=['custom','webapp','wireguard'].some(prefix=>scene.startsWith(prefix));
const app=createApp({render:()=>h('div',[dialog?null:h(component,props),h(ShellServices,{services:presentation})])});app.provide('aj',aj);app.mount('#fixture');
if(dialog)aj.modal.open(component,props,{size:'lg'}).catch(()=>{});
window.fixture={ready:true,dispose(){aj.modal.dispose();presentation.dispose();app.unmount();}};
`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture-source', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && id.startsWith(join(frontend, 'src/plugins/')) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const scene of ['landing','landing-admin','landing-student','links','links-empty','links-hover','links-focus','links-active','links-space','schools','schools-filter','schools-hidden','nextcloud','nextcloud-error','custom','custom-hover','custom-focus','webapp','webapp-hover','webapp-focus','webapp-active','webapp-space','wireguard','wireguard-empty']) {
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
                if(scene==='schools-filter')await page.locator('input').fill('other');
                await page.evaluate(() => document.activeElement?.blur());
                await page.mouse.move(width-1,height-1);
                const button=page.locator(scene.startsWith('links')?'button':'.modal-footer :is(button,a)').last();
                if(scene.endsWith('-hover'))await button.hover();
                if(scene.endsWith('-focus') || scene.endsWith('-space'))await button.focus();
                if(scene.endsWith('-space'))await page.keyboard.down(' ');
                if(scene.endsWith('-active')){await button.hover();await page.mouse.down();}
                await page.waitForTimeout(350);
                shots.push(await page.screenshot({ path: join(output, `${scene}-${width}-${name}.png`) }));
                states.push(await page.locator('.modal-dialog, .modal-header, .modal-body, .modal-footer, button, input, iframe, pre, [role=progressbar], .card, .panel, .card-header, .panel-heading, .card-body, .panel-body, .badge, .label').evaluateAll(elements => elements.map(el => {
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
await writeFile(join(output, 'metadata.json'), JSON.stringify({ reference: '2ffbc6257', cssSha256: Object.fromEntries(Object.entries(css).map(([key,value]) => [key, createHash('sha256').update(value).digest('hex')])) }, null, 2) + '\n');
await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.filter(r => r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r => r.geometryEqual).length} identical style/geometry snapshots`);
assert.ok(results.every(result => (result.scene.startsWith('landing') && result.width===390) || (result.equal && result.geometryEqual)), 'Inspect comparison.json');
