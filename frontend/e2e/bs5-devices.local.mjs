// Offline C3 Vue fixtures. Synthetic data only; HTTP is an in-memory mock.
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
const output = process.argv[2]; assert.ok(output, 'Pass output directory');
await mkdir(output, { recursive: true });
const reference = '2ffbc6257';
const previous = path => execFileSync('git', ['show', `${reference}:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const components = { Devices:'lmn_devices/Devices', AddDialog:'lmn_devices/AddDialog', ApplyDialog:'lmn_devices/ApplyDialog', Clients:'lmn_clients/Clients', DeviceManager:'lmn_device-manager/DeviceManager', LinboRemote:'lmn_device-manager/LinboRemote', Processes:'lmn_device-manager/Processes', Prestart:'lmn_device-manager/Prestart', BulkAction:'lmn_device-manager/BulkAction' };
const entry = `import { createApp, h } from 'vue';
import { createMockAj } from '${frontend}/src/adapter/mock.mjs';
import { createModalService } from '${frontend}/src/shell/modal.mjs';
import { createPresentation, ShellServices } from '${frontend}/src/shell/presentation.mjs';
${Object.entries(components).map(([name,path]) => `import ${name} from '${frontend}/src/plugins/${path}.vue';`).join('\n')}
const scene=window.fixtureScene;
const device={room:'R100',hostname:'fixture-pc',group:'ubuntu',mac:'02:00:00:00:00:01',ip:'10.0.0.10',pxeFlag:'0',sophomorixRole:'classroom-studentcomputer',school:'default-school',online:'down',os:'Linbo'};
const processes=[{id:1,hostname:'fixture-pc',startdate:'2026-10-25',starttime:'10:00'}];
const commands=[{name:'fixture-pc',content:'sync:1',path:'/synthetic/pc.cmd'}];
const aj=createMockAj({identity:{user:'global-admin',profile:{sophomorixRole:'globaladministrator'}},http:async request=>{
 const endpoint=request.url.split('/').pop();
 const data={activeschool:'default-school',groups:['ubuntu','windows'],devices:scene==='devices-pages'?Array.from({length:101},(_,i)=>({...device,hostname:'fixture'+i,room:'R'+i})):[{...device,hostname:scene==='devices-error'?'':device.hostname}],
 getdevices:[device],checkOS:'Linbo',checkOnline:'down',getrunninglinboremotecommands:processes,getPrestartCommands:commands,
 scripts:{linux:[{name:'sessionstart.sh',path:'/synthetic/linux.sh',content:'# synthetic script'}],windows:[{name:'logon.bat',path:'/synthetic/windows.bat',content:'rem synthetic'}]},
 drives:[[{disabled:false,properties:{label:'Home',useLetter:true,letter:'H'}}],[{letter:'H',active:true},{letter:'G',active:false}]],
 getlinboconfig:[{BaseImage:'synthetic.qcow2'}],getlastsync:{status:'success',date:'2026-10-25'},getlinboremotelog:'Synthetic process log'};
 if(endpoint==='import') { if(scene==='apply-working') return new Promise(()=>{}); if(scene==='apply-error') throw Error('Synthetic failure'); return {data:{}}; }
 if(['start','shutdown','reboot'].includes(endpoint)) { if(scene==='bulk-pending') return new Promise(()=>{}); return {data:{status:false,message:'Synthetic failure'}}; }
 if(request.method!=='get' && !['getdevices','checkOS','checkOnline','getlinboconfig','getlastsync','getlinboremotelog'].includes(endpoint)) throw Error('No fixture write: '+endpoint);
 return {data:data[endpoint]??'Synthetic log'};
}});
aj.modal=createModalService(()=>aj);
const presentation=createPresentation({http:aj.http,identity:aj.identity,navigate:()=>{},getAj:()=>aj});aj.messagebox=presentation.messagebox;
const modal=!['devices','devices-sort','devices-fields','devices-rows','devices-error','devices-group','devices-pages','clients','clients-drives','clients-edit','manager','manager-options','manager-infos','manager-bulk'].includes(scene);
const component=scene.startsWith('devices')?Devices:scene.startsWith('clients')?Clients:DeviceManager;
const app=createApp({render:()=>h('div',[modal?null:h(component),h(ShellServices,{services:presentation})])});app.provide('aj',aj);app.mount('#fixture');
if(modal){let c,p={};
 if(scene==='add') {c=AddDialog;p={device};}
 else if(scene.startsWith('apply')) c=ApplyDialog;
 else if(scene.startsWith('remote')) {c=LinboRemote;p={device,prestart:scene==='remote-prestart',refreshProcesses(){},refreshPrestart(){}};}
 else if(scene.startsWith('processes')) {c=Processes;p={processes:scene==='processes-empty'?[]:processes,refresh(){}};}
 else if(scene.startsWith('prestart')) {c=Prestart;p={commands:scene==='prestart-empty'?[]:commands,refresh(){}};}
 else {c=BulkAction;p={devices:[device],action:'reboot'};}
 aj.modal.open(c,p,{size:'lg'}).catch(()=>{});
}
window.fixture={ready:true,dispose(){aj.modal.dispose();presentation.dispose();app.unmount();}};`;
const bundles = {};
for (const name of ['before', 'after']) {
 const result=await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'fixture-source',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},load(id){
 if(id==='\0fixture-entry')return entry;
 if(name==='before' && /\/src\/plugins\/lmn_(devices|clients|device-manager)\//.test(id) && /\.(vue|mjs)$/.test(id) && !id.includes('?')) return previous('frontend/'+id.slice(frontend.length));
 }},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
 bundles[name]=result.output[0].code;
}
const scenes=['devices','devices-sort','devices-fields','devices-rows','devices-error','devices-group','devices-pages','clients','clients-drives','clients-edit','manager','manager-options','manager-infos','manager-bulk','add','apply-working','apply-done','apply-error','remote','remote-prestart','processes','processes-empty','prestart','prestart-empty','bulk-done','bulk-pending'];
const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1].split(','):null;
const browser=await chromium.launch({headless:true,args:['--disable-lcd-text','--disable-gpu']});const results=[];
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,browser:browser.version(),cssSha256:Object.fromEntries(Object.entries(css).map(([key,value])=>[key,createHash('sha256').update(value).digest('hex')]))},null,2)+'\n');
try { for(const scene of scenes.filter(s=>!only||only.includes(s))) for(const [width,height] of [[1440,900],[768,1024],[390,844]].filter(([w])=>!process.argv.includes('--width')||w===Number(process.argv[process.argv.indexOf('--width')+1]))) {
 const states={};
 for(const name of ['before','after']) {
 const page=await browser.newPage({viewport:{width,height},timezoneId:'UTC',locale:'en-GB'});
 await page.route('**/*',route=>route.abort());
 // This static shell follows the source contract of the CSS snapshot being rendered.
 const shellGrid=css[name].includes('--aj-layout-sidebar');
 await page.setContent(`<!doctype html><html><body class="customized"><div class="container"><div class="row${shellGrid?' aj-theme-shell':''}"><div class="${shellGrid?'aj-theme-sidebar-column':'col-md-3'} sidebar hide-tablet hide-phone"></div><main class="content shell-content"><div id="fixture" style="padding:20px"></div></main></div></div></body></html>`);
 await page.addStyleTag({content:css[name]});
 // Like P138 screenshot preparation: compare settled static states, without animation timing noise.
 await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});await page.evaluate(scene=>{window.fixtureScene=scene;},scene);await page.addScriptTag({type:'module',content:bundles[name]});
 await page.waitForFunction(()=>window.fixture?.ready);await page.waitForTimeout(80);
 if(scene.startsWith('devices-') && !['devices-error','devices-group','devices-pages'].includes(scene)) await page.locator('.input-group button').nth(['sort','fields','rows'].indexOf(scene.slice(8))).click();
 if(scene==='devices-error') await page.locator('a.btn').filter({hasText:/^Save$/}).click();
 if(scene==='devices-pages'){await page.locator('.input-group button').nth(2).click();await page.locator('[data-size="10"]').click();}
 if(scene==='devices-group') {await page.locator('[role=combobox]').fill('ub');}
 if(scene==='clients-drives') await page.getByRole('tab',{name:'Drives',exact:true}).click();
 if(scene==='clients-edit') await page.locator('.list-group-item button').first().click();
 if(scene.startsWith('manager')) {await page.locator('.room input').check();await page.waitForTimeout(30);}
 if(scene==='manager-options') await page.locator('button:has(.fa-bars)').click();
 if(scene==='manager-infos') await page.locator('button:has(.fa-question-circle)').click();
 if(scene==='manager-bulk') await page.locator('floating-toolbar button').last().click();
 if(scene==='remote-prestart') await page.locator('[data-global=initcache]').click();
 await page.mouse.move(width-1,height-1);await page.evaluate(()=>{if(window.fixtureScene!=='devices-group')document.activeElement?.blur();document.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();},true);});
 // Every migrated control family receives Normal/Hover/keyboard Focus/Active/Space states.
 const targets=scene==='devices-group'?['[role=combobox]']:scene==='devices-error'?['[data-field=hostname] input','.input-group button >> nth=0']:scene==='devices-pages'?['.pagination a >> nth=2']:scene==='clients'||scene==='clients-drives'?['.nav-tabs a >> nth=0','.nav-tabs a >> nth=1','.list-group-item button >> nth=0']:
 scene.startsWith('devices')?['.input-group button >> nth=0']:
 scene.startsWith('manager')?['button:has(.fa-bars) >> nth=0','floating-toolbar button >> nth=0']:
 scene==='clients-edit'?['.modal-footer button >> nth=1']:['.modal-footer :is(button,a) >> nth=-1'];
 states[name]=[];
 const capture=async label=>{
 await page.waitForTimeout(80);
 const shot=await page.screenshot({path:join(output,`${scene}-${width}-${label}-${name}.png`)});
 const values=await page.locator('.lmp_deviceBoxSM,.lmp_deviceBoxSM_topBar,.input-group-btn,.dropdown,.modal-dialog,.modal-header,.modal-body,.modal-footer,button,input,select,textarea,.nav-tabs a,.dropdown-menu,.dropdown-menu a,.badge,.progress,.progress-bar,.lm-table,.pagination a, #sideBar,#deviceList').evaluateAll(elements=>elements.filter(el=>el.getBoundingClientRect().width).map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {tag:el.tagName,text:el.textContent,x:r.x,y:r.y,w:r.width,h:r.height,color:s.color,bg:s.backgroundColor,padding:s.padding,margin:s.margin,border:s.border,borders:[s.borderTop,s.borderRight,s.borderBottom,s.borderLeft],radius:s.borderRadius,shadow:s.boxShadow,font:s.fontSize,line:s.lineHeight,display:s.display,focus:el.matches(':focus-visible'),paint:{transform:s.transform,origin:s.transformOrigin,zIndex:s.zIndex,overflow:s.overflow,clip:s.clip,filter:s.filter,isolation:s.isolation,contain:s.contain,opacity:s.opacity},active:el.matches(':active')};}));
 states[name].push({label,shot,values});};
 if(scene==='devices-group' && width===390 && name==='after')assert.ok(await page.locator('.group-options').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.c3-devices-scroll').getBoundingClientRect();return r.bottom<=p.bottom;}),'Typeahead remains inside mobile scroll area');
 await capture('normal');
 for(const [i,selector] of targets.entries()) {
 const target=page.locator(selector);if(!await target.count()||!await target.isVisible()||await target.isDisabled())continue;
 await target.hover();await capture(`${i}-hover`);await page.mouse.move(width-1,height-1);
 // Native Tab events establish keyboard modality; focus then selects the exact control.
 await page.keyboard.press('Tab');await target.focus();await capture(`${i}-focus`);
 await page.keyboard.down(' ');await capture(`${i}-space`);await page.keyboard.up(' ');
 // No click is dispatched: this tests held active visuals without closing dialogs or writing.
 if(await target.count() && await target.isVisible()){await target.hover();await page.mouse.down();await capture(`${i}-active`);await page.mouse.move(width-1,height-1);await page.mouse.up();}
 await page.evaluate(()=>document.activeElement?.blur());
 }
 if(scene.startsWith('manager') && width===390 && name==='after'){assert.ok(await page.locator('#sideBar').evaluate(el=>{const r=el.getBoundingClientRect();return r.x>=0 && r.right<=innerWidth;}),'D08 sidebar fits viewport');}
 if(scene==='devices' && width===390 && name==='after') {
 const scroll=page.locator('.c3-devices-scroll');assert.ok(await scroll.evaluate(el=>el.scrollWidth>el.clientWidth));
 await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;});await page.locator('button[title=Remove]').first().scrollIntoViewIfNeeded();await capture('scrolled-actions');
 }
 await page.evaluate(()=>window.fixture.dispose());await page.close();
 }
 for(const before of states.before){const after=states.after.find(s=>s.label===before.label);assert.ok(after,`${scene}: ${before.label} missing`);results.push({scene,width,state:before.label,equal:before.shot.equals(after.shot),geometryEqual:JSON.stringify(before.values)===JSON.stringify(after.values),before:before.values,after:after.values});}
 await writeFile(join(output,'progress.json'),JSON.stringify(results,null,2)+'\n');
 } } finally{await browser.close();}
await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2)+'\n');
console.log(`${results.filter(r=>r.equal).length}/${results.length} PNG pairs identical; ${results.filter(r=>r.geometryEqual).length} style/geometry snapshots identical; reference ${reference}`);
const unexpected=results.filter(r=>(!r.equal || !r.geometryEqual) && !(widthMobile(r)&&['devices','devices-sort','devices-fields','devices-rows','devices-error','devices-group','devices-pages','manager','manager-options','manager-infos','manager-bulk'].includes(r.scene)));
function widthMobile(r){return r.width===390;}
await writeFile(join(output,'unexpected.json'),JSON.stringify(unexpected,null,2)+'\n');
assert.equal(unexpected.length,0,'Inspect unexpected.json');
