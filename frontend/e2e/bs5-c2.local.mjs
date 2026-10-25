// Offline real Vue C2 DHCP/DNS/Cron fixtures. No VM, credentials or network.
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
const entry = `import { createApp,h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import Dhcp from '${frontend}/src/plugins/lmn_dhcp/Dhcp.vue';
import AddDialog from '${frontend}/src/plugins/lmn_dhcp/AddDialog.vue';
import Dns from '${frontend}/src/plugins/lmn_samba_dns/components/SambaDns.vue';
import Cron from '${frontend}/src/plugins/lmn_crontab/components/Crontab.vue';
const scene=window.fixtureScene;
const known={mac:'02:00:00:00:00:01',ip:'192.0.2.1',hostname:'fixture'};
const empty={normal_tasks:[],special_tasks:[],env_settings:[]};
const job={minute:'17',hour:'3',day_of_month:'*',month:'*',day_of_week:'*',command:'/bin/true',comment:'synthetic',school:'default-school',disable_holiday:true};
const aj=createMockAj({identity:{user:'fixture',profile:{sophomorixRole:scene==='cron-denied'?'teacher':'globaladministrator'}},http:async request=>{
 if(request.method!=='get') throw Error('No writes allowed');
 if(request.url.includes('/dhcp/'))return {data:[[{...known,mac:'02:00:00:00:00:02',starts:'fixture start',ends:'fixture end'}],[known]]};
 if(request.url.includes('/dns'))return {data:[{root:[{type:'NS',ttl:900,value:'ns.example.test'}],sub:[{host:'fixture',type:'MX',ttl:900,value:'mail.example.test',priority:17}]},'example.test']};
 return {data:[scene==='cron-empty'?empty:{...empty,normal_tasks:[job],special_tasks:[{...job,special:'@reboot'}],env_settings:[{name:'PATH',value:'/bin',comment:'synthetic'}]},empty,'default-school']};
}});
const component=scene.startsWith('dhcp-dialog')?AddDialog:scene.startsWith('dhcp')?Dhcp:scene.startsWith('dns')?Dns:Cron;
const app=createApp({render:()=>component===AddDialog?h('div',{class:'modal show',style:'display:block;background:rgba(0,0,0,.5)'},h('div',{class:'modal-dialog'},h('div',{class:'modal-content'},h(component,{mac:known.mac,used:[known],onRegistered:()=>{}})))):h(component)});app.provide('aj',aj);app.mount('#fixture');
window.fixture={ready:true,dispose(){app.unmount();}};
`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture-source', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && ['lmn_dhcp','lmn_samba_dns','lmn_crontab'].some(plugin=>id.startsWith(join(frontend,'src/plugins',plugin))) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const selectedScenes = process.argv.includes('--scenes') ? process.argv[process.argv.indexOf('--scenes')+1].split(',') : null;
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const scene of ['dhcp','dhcp-dialog','dhcp-dialog-invalid','dhcp-dialog-invalid-input','dns','dns-new','dns-modify','dns-footer','cron','cron-empty','cron-special','cron-env','cron-edit','cron-special-edit','cron-env-edit','cron-denied']) {
      if(selectedScenes && !selectedScenes.includes(scene)) continue;
      for (const state of ['normal','hover','focus','active','space']) {
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
                await page.waitForTimeout(100);
                if(scene.startsWith('dhcp-dialog-invalid')) {await page.locator('input').nth(2).fill('192.0.2.1');await page.locator('input').nth(3).fill('fixture');}
                if(scene==='dns-new'||scene==='dns-footer') await page.locator('button').first().click();
                if(scene==='dns-modify') await page.locator('button[title="Modify this entry"]').click();
                if(scene.includes('special')) await page.locator('[role=tab]').nth(1).click();
                if(scene.includes('env')) await page.locator('[role=tab]').nth(2).click();
                if(scene.endsWith('edit')) await page.locator('button[title=Modify]').click();
                await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(width-1,height-1);
                let target=page.locator(scene.startsWith('cron')&&!scene.endsWith('edit')&&scene!=='cron-denied'?'[role=tab]':scene.endsWith('edit')?'.modal button':scene.startsWith('dns-')?'.modal input':scene.startsWith('dhcp-dialog')?'.modal-footer button':'button').first();
                if(scene.startsWith('cron')&&!scene.endsWith('edit')&&scene!=='cron-denied')target=page.locator('[role=tab]').nth(scene.includes('special')?1:scene.includes('env')?2:0);
                if(scene==='dhcp-dialog-invalid-input')target=page.locator('input').nth(2);
                if(scene==='dns-footer')target=page.locator('.modal-footer a').first();
                if(await target.count()) {
                  if(state==='hover') await target.hover();
                  if((state==='focus'||state==='space')&&scene!=='dns-footer') {for(let i=0;i<40;i++){await page.keyboard.press('Tab');if(await target.evaluate(el=>el===document.activeElement))break;}}
                  if(state==='active') {await target.hover();await page.mouse.down();}
                  if(state==='space')await page.keyboard.down(' ');
                }
                await page.waitForTimeout(350);
                shots.push(await page.screenshot({ path: join(output, `${scene}-${state}-${width}-${name}.png`) }));
                states.push(await page.locator('h2,h3,.modal-dialog,.modal-header,.modal-body,.modal-footer,button,input,textarea,select,table,td,.nav-tabs a,form').evaluateAll(elements => elements.map(el => {
                    const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
                    return { tag: el.tagName, text: el.textContent, x: rect.x, y: rect.y, width: rect.width, height: rect.height,
                        color: style.color, background: style.backgroundColor, padding: style.padding, margin: style.margin, lineHeight: style.lineHeight, border: style.border, borderRadius: style.borderRadius, boxShadow: style.boxShadow, opacity: style.opacity, fontSize: style.fontSize, display: style.display, position: style.position, fontWeight: style.fontWeight, textAlign: style.textAlign, focusVisible: el.matches(':focus-visible'), active: el.matches(':active') };
                })));
                await page.evaluate(() => window.fixture.dispose());
                await page.close();
            }
            results.push({ scene, state, width, equal: shots[0].equals(shots[1]), geometryEqual: JSON.stringify(states[0]) === JSON.stringify(states[1]), before: states[0], after: states[1] });
        }
    }
} } finally { await browser.close(); }
await writeFile(join(output, 'metadata.json'), JSON.stringify({ reference: '2ffbc6257', cssSha256: Object.fromEntries(Object.entries(css).map(([key,value]) => [key, createHash('sha256').update(value).digest('hex')])) }, null, 2) + '\n');
await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`${results.filter(r => r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r => r.geometryEqual).length} identical style/geometry snapshots`);
assert.ok(results.every(result => result.equal && result.geometryEqual), 'Inspect comparison.json');
