// Offline B6 real-Vue fixtures against merge 302. No VM or external requests.
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
const reference = '984a0006c';
const previous = path => execFileSync('git', ['show', `${reference}:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const entry = `import { createApp, h } from 'vue';
import Dashboard from '${frontend}/src/shell/Dashboard.vue';
import SessionList from '${frontend}/src/shell/SessionList.vue';
import StockSettings from '${frontend}/src/shell/StockSettings.vue';
import { StaticPage } from '${frontend}/src/shell/static-pages.mjs';
import { createDashboard } from '${frontend}/src/shell/dashboard.mjs';
import { createSettings } from '${frontend}/src/shell/settings.mjs';
import { createSessionList } from '${frontend}/src/shell/session-list.mjs';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
const scene = window.fixtureScene;
const config = { name: 'Synthetic host', color: 'default', language: 'en', bind: { mode: 'tcp', host: '127.0.0.1', port: 8000 }, auth: { provider: 'os', allow_sudo: true }, trusted_domains: ['fixture.test'], trusted_proxies: ['192.0.2.1'], session_max_time: 3600, ssl: { enable: true, force: false, certificate: '/fixture.pem', fqdn_certificate: '', client_auth: { enable: true, force: false, certificates: [] } }, email: { enable: true, templates: { reset_email: '/fixture.txt' } } };
const types = ['hostname','uptime','loadavg','cpu','memory','disk','sessions','datetime'].map(id => ({ id, name: id, config_template: ['disk','datetime'].includes(id) ? '/config' : null }));
const values = { hostname: 'fixture.test', uptime: 90061, loadavg: [.1,.2,.3], cpu: [1,1], memory: { used: 99, total: 100 }, disk: { used: 95, total: 100 }, sessions: true, datetime: '25.10.2026 12:34' };
const sessions = { synthetic: { identity: 'synthetic-user', timestamp: 1700000000, client_info: { address: '192.0.2.1' } } };
const tabs = [{ name: 'Main', width: 2, widgetsLeft: types.slice(0,4).map(x=>({id:x.id,typeId:x.id,config:{}})), widgetsRight: types.slice(4).map(x=>({id:x.id,typeId:x.id,config:{}})) }, { name: 'Other', width: 1, widgetsLeft: [{id:'other',typeId:'hostname',config:{}}], widgetsRight: [] }];
const aj = createMockAj({ identity: { isSuperuser: !scene.startsWith('denied'), user: 'synthetic', profile: {} }, http: async r => {
 if (r.url === '/api/core/user-config') return {data:r.data ?? {dashboard:{tabs}}};
 if (r.url === '/api/dashboard/widgets') return {data:types};
 if (r.url === '/api/dashboard/widgets-values') return {data:r.data.map(w=>({id:w.id,data:values[w.typeId]}))};
 if (r.url === '/api/core/config') return {data:config};
 if (r.url === '/api/core/languages') return {data:['en','de']};
 if (r.url === '/api/core/authentication-providers') return {data:[{id:'os',name:'OS'}]};
 if (r.url === '/api/core/smtp-config') return {data:{smtp:{server:'relay.fixture.test',port:'ssl',user:'synthetic',password:scene}}};
 if (r.url === '/api/core/tfa-config') return {data:{}};
 if (r.url === '/api/passwds') return {data:[{name:'synthetic'}]};
 if (r.url.includes('mountpoints')) return {data:['/','/home']};
 if (r.url.includes('sessions')) return {data:sessions};
 throw new Error('Unexpected fixture request '+r.url);
} });
let model, component, props;
if (scene.startsWith('dashboard')) { model=createDashboard(aj); await model.start(); await model.refresh(); component=Dashboard; props={model}; }
else if (scene === 'sessions' || scene === 'denied-sessions') { model=createSessionList(aj,{session_max_time:3600}); await model.start(); component=SessionList; props={model}; }
else if (scene.startsWith('settings') || scene === 'denied-settings') { model=createSettings(aj); component=StockSettings; props={model}; }
else { component=StaticPage; props={ kind: scene === '404' ? undefined : scene, prefix:'', route:{fullPath:'/missing'}, gettext:aj.gettext }; }
const app=createApp({render:()=>h(component,props)});app.provide('aj',aj); app.mount('#fixture');
window.fixture={model,ready:true,dispose(){app.unmount();model?.dispose();}};
`;
const bundles = {};
for (const name of ['before','after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'stock-fixture', enforce: 'pre',
        resolveId(id) { if (id === 'fixture-entry') return '\0fixture-entry'; },
        load(id) {
            if (id === '\0fixture-entry') return entry;
            if (name === 'before' && id.startsWith(join(frontend,'src/shell/')) && /(?:\.vue|static-pages\.mjs)$/.test(id) && !id.includes('?')) return previous('frontend/' + id.slice(frontend.length));
        } },vue()], build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}} });
    bundles[name]=result.output[0].code;
}
const tabScenes = ['normal','hover','focus','active','keyboard'].flatMap(state => [
    ...[0,1].map(i => `dashboard-nav-${i}-${state}`), ...[0,1,2,3].map(i => `settings-nav-${i}-${state}`),
]);
const scenes = [...tabScenes, 'dashboard','dashboard-one-column','dashboard-tab','dashboard-disk','dashboard-datetime','dashboard-hover','dashboard-focus','dashboard-active','dashboard-keyboard','dashboard-flat-keyboard','sessions','settings','settings-security','settings-smtp','settings-tfa','denied-settings','denied-sessions','404','configuration-error','ui-test','quotas-disabled'];
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only')+1].split(',') : null;
const browser = await chromium.launch({headless:true}); const results=[];
try {
    for (const scene of scenes.filter(x=>!only || only.includes(x))) for (const [width,height] of [[1440,900],[768,1024],[390,844]]) {
        const shots=[], states=[];
        for (const name of ['before','after']) {
            const page=await browser.newPage({viewport:{width,height},timezoneId:'UTC',locale:'en-GB'});
            const errors=[];page.on('pageerror',error=>errors.push(error.message));
            await page.route('**/*',route=>route.abort());
            await page.setContent('<!doctype html><html><body class="customized"><main id="fixture" style="padding:20px"></main></body></html>');
            await page.addStyleTag({content:css[name]});
            await page.evaluate(scene=>{window.fixtureScene=scene;},scene);
            await page.addScriptTag({type:'module',content:bundles[name]});
            await page.waitForFunction(()=>window.fixture?.ready);
            if(scene==='dashboard-tab') await page.locator('[data-tab="1"]').click();
            if(scene==='dashboard-one-column') await page.locator('[data-action="width-1"]').click();
            if(scene==='dashboard-disk' || scene==='dashboard-datetime' || scene==='dashboard-flat-keyboard') await page.evaluate(scene=>window.fixture.model.configureWidget(scene==='dashboard-disk'?'disk':'datetime'),scene);
            const tab = { 'settings-security':'Security','settings-smtp':'Smtp relay','settings-tfa':'2FA' }[scene];
            if(tab) await page.locator('[data-tab="'+tab+'"]').click();
            await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(width-1,height-1);
            const navScene=scene.match(/^(dashboard|settings)-nav-(\d)-(normal|hover|focus|active|keyboard)$/);
            const navTarget=navScene && (navScene[1]==='dashboard' ? navScene[2] : ['General','Security','Smtp relay','2FA'][Number(navScene[2])]);
            const control=page.locator(navScene ? '[data-tab="'+navTarget+'"]' : scene==='dashboard-flat-keyboard'?'[data-action="save-config"]':'[data-action="add-tab"]');
            if(navScene){
                if(navScene[3]==='hover') await control.hover();
                if(navScene[3]==='active'){await control.hover();await page.mouse.down();}
                if(navScene[3]==='focus'||navScene[3]==='keyboard'){
                    // Keyboard modality and real Tab traversal, including selected and unselected links.
                    for(let i=0;i<40;i++){
                        await page.keyboard.press('Tab');
                        if(await control.evaluate(el=>el===document.activeElement))break;
                    }
                    assert.ok(await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),'Tab traversal must reach '+navTarget);
                    if(navScene[3]==='keyboard')await page.keyboard.down(' ');
                }
            }
            if(scene==='dashboard-hover') await control.hover();
            if(scene==='dashboard-focus') await control.focus();
            if(scene==='dashboard-active') {await control.hover();await page.mouse.down();}
            if(scene==='dashboard-keyboard'||scene==='dashboard-flat-keyboard') {await control.focus();await page.keyboard.down(' ');}
            await page.waitForTimeout(550);
            assert.deepEqual(errors,[],scene+' '+name);
            if(scene==='settings-smtp') assert.equal(await page.locator('[aria-label="SMTP password"]').getAttribute('type'),'password');
            shots.push(await page.screenshot({path:join(output,`${scene}-${width}-${name}.png`)}));
            states.push(await page.locator('a.btn, button, select, input, .widget-header, .widget-value, .badge, .label, .root-access-blocker, .alert, th, td').evaluateAll(elements=>elements.map(el=>{
                const r=el.getBoundingClientRect(),s=getComputedStyle(el);
                return {tag:el.tagName,text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,lineHeight:s.lineHeight,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow,fontSize:s.fontSize,display:s.display,fontWeight:s.fontWeight,verticalAlign:s.verticalAlign};
            })));
            await page.evaluate(()=>window.fixture.dispose());await page.close();
        }
        results.push({scene,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(states[0])===JSON.stringify(states[1]),before:states[0],after:states[1]});
    }
}finally{await browser.close();}
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,cssSha256:Object.fromEntries(Object.entries(css).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))},null,2)+'\n');
await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2)+'\n');
console.log(results.filter(x=>x.equal).length+'/'+results.length+' PNG pairs identical; '+results.filter(x=>x.geometryEqual).length+' styles/geometries identical');
assert.ok(results.every(x=>x.equal&&x.geometryEqual),'Inspect comparison.json');
