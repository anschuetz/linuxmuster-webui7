// C7 offline real-Vue fixtures; synthetic responses, no server connection.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { buildStyles } from '../static-assets.mjs';
const frontend=fileURLToPath(new URL('..',import.meta.url)), output=process.argv[2], reference='78cfb5e48';
assert.ok(output); await mkdir(output,{recursive:true});
const previous=path=>execFileSync('git',['show',`${reference}:${path}`],{cwd:frontend,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(frontend)};
const entry=`import {createApp,h} from 'vue';
import Websession from '${frontend}/src/plugins/lmn_websession/components/Websession.vue';
import CreateSession from '${frontend}/src/plugins/lmn_websession/components/CreateSession.vue';
import Participants from '${frontend}/src/plugins/lmn_websession/components/Participants.vue';
import Docker from '${frontend}/src/plugins/lmn_docker/components/Docker.vue';
import Dashboard from '${frontend}/src/plugins/lmn_vdi_dashboard/Dashboard.vue';
import Administration from '${frontend}/src/plugins/lmn_vdi_administration/Administration.vue';
import GroupInfo from '${frontend}/src/plugins/lmn_vdi_administration/GroupInfo.vue';
import MasterInfo from '${frontend}/src/plugins/lmn_vdi_administration/MasterInfo.vue';
import {createMockAj} from '${frontend}/src/adapter/mock.mjs';
const scene=window.fixtureScene;
const master={name:'Synthetic VM',status:'running',cloop:'fixture.cloop',buildstate:'ready',ostype:'linux',imagesize:'8G',dateOfCreation:'2026-01-01',memory:4096,cores:2,bios:'sea',scsi0:'disk',scsihw:'virtio',audio0:'spice',vga:'qxl',net0:'net',usb0:'usb',spice_enhancements:'folders'};
const group={group:'Fixture',hostname:'master',room:'room',ip:'192.0.2.60',mac:'02:00:00:00:00:60',pxe:1,actual_imagesize:'8G',master_vms:{101:master,102:null}};
const container={Container:'fixture-hash',Name:'Synthetic',PIDs:scene==='docker-stopped'?0:1,MemUsage:'1 MiB',CPUPerc:'1%',NetIO:'1 KiB'};
const session={id:'fixture',sessionname:'Synthetic session',moderator:scene==='web-other'?'other':'synthetic',sessionpassword:'',attendeepw:'fixture',moderatorpw:'fixture',participants:['Synthetic User'],status:scene==='web-stopped'||scene==='web-other'?'stopped':'started'};
const aj=createMockAj({identity:{user:scene==='web-loading'?null:scene==='web-denied'?'root':'synthetic',profile:scene==='web-denied'?{}:{sophomorixRole:scene==='web-student'?'student':'teacher',givenName:'Synthetic',sn:'User'}},http:async r=>{
 window.requests.push(r);if(r.method!=='get')throw Error('Forbidden write');
 if(scene.endsWith('-loading'))return new Promise(()=>{});
 if(r.url.endsWith('webConferenceEnabled'))return {data:scene!=='web-disabled'};
 if(r.url.endsWith('webConferences'))return {data:scene==='web-empty'?[]:[session]};
 if(r.url.includes('schoolClass-search'))return {data:[{sophomorixAdminClass:'Fixture Class',members:{one:{sAMAccountName:'fixture',givenName:'Synthetic',sn:'User'}}}]};
 if(r.url.endsWith('/which')){if(scene==='docker-missing')throw Error('Fixture missing');return {data:true};}
 if(r.url.endsWith('/containers'))return {data:scene==='docker-empty'?[]:[container]};
 if(r.url.endsWith('/images'))return {data:scene==='docker-images-empty'?[]:[{Repository:'synthetic',CreatedSince:'today',Tag:'latest',Size:'8 MB',hash:'fixture'}]};
 if(r.url.includes('/container/'))return {data:{Name:'Synthetic',Config:{Hostname:'fixture'},Id:'fixture-hash',Created:'2026-01-01',NetworkSettings:{Networks:{fixture:{IPAddress:'192.0.2.1'}},Ports:{'80/tcp':[{HostPort:'8080'}]}},Mounts:[{Source:'/fixture',Type:'bind',Destination:'/data'}]}};
 if(r.url.endsWith('/masterVMs'))return {data:scene==='admin-error'?{status:'error',message:'Fixture unavailable'}:{status:'success',data:scene==='admin-empty'?{}:{Fixture:group}}};
 if(r.url.endsWith('/clones'))return {data:{status:'success',data:scene==='dashboard-empty'?{}:{Fixture:{summary:{available_vms:scene==='dashboard-unavailable'?0:2},clone_vms:{201:{group:'Fixture',room:'room',hostname:'clone',ip:'192.0.2.61',mac:'02:00:00:00:00:61',user:''}}}}}};
 throw Error('Forbidden fixture request '+JSON.stringify(r));
}});
const type=scene.split('-')[0],component={web:Websession,create:CreateSession,participants:Participants,docker:Docker,dashboard:Dashboard,admin:Administration,group:GroupInfo,master:MasterInfo}[type];
const props=type==='participants'?{participants:scene==='participants-empty'?[]:['Synthetic User']}:type==='group'?{masterGroupData:group}:type==='master'?{masterVM:'101',masterVMData:master}:{};
const app=createApp({render:()=>h(component,props)});app.provide('aj',aj);app.mount('#fixture');window.fixture={ready:true,dispose:()=>app.unmount()};`;
const bundles={};
for(const name of ['before','after']){
 const result=await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'c7-fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},load(id){
 if(id==='\0fixture-entry')return entry;
 if(!id.includes('?')&&/src\/plugins\/lmn_(websession|docker|vdi_dashboard|vdi_administration)\/.*\.vue$/.test(id))return name==='before'?previous('frontend/'+id.slice(frontend.length)):readFile(id,'utf8');
 }},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
 bundles[name]=result.output[0].code;
}
const scenes=['web','web-stopped','web-other','web-student','web-loading','web-denied','web-disabled','web-empty','create','create-password','create-dropdown','create-selected','create-error','participants','participants-empty','docker','docker-stopped','docker-empty','docker-missing','docker-loading','docker-images','docker-images-empty','docker-details','admin','admin-clones','admin-loading','admin-empty','admin-error','dashboard','dashboard-loading','dashboard-empty','dashboard-unavailable','group','master'];
const results=[],browser=await chromium.launch({headless:true});
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,browser:browser.version(),fixture:'offline synthetic reads; frozen motion',cssSha256:Object.fromEntries(Object.entries(css).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))},null,2));
try{
 for(const scene of scenes.filter(s=>!process.env.C7_ONLY||process.env.C7_ONLY.split(',').includes(s)))for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
 const pages=[];
 for(const name of ['before','after']){
 const page=await browser.newPage({viewport:{width,height},locale:'en-GB',timezoneId:'UTC'});pages.push(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html><body class="customized"><main id="fixture" style="padding:20px"></main></body></html>'}):r.abort());
 await page.goto('https://fixture.invalid/');await page.addStyleTag({content:css[name]});await page.addStyleTag({content:'*,*::before,*::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }'});
 await page.evaluate(scene=>{window.fixtureScene=scene;window.requests=[];},scene);await page.addScriptTag({type:'module',content:bundles[name]});await page.waitForFunction(()=>window.fixture?.ready);
 if(scene==='create-password')await page.locator('#websession-type').selectOption('password');
 if(scene==='create-dropdown'||scene==='create-selected'){await page.locator('#websession-class').fill('Fixture');await page.locator('.dropdown-menu button').waitFor();if(scene==='create-selected')await page.locator('.dropdown-menu button').click();}
 if(scene==='create-error')await page.locator('[data-action="create"]').click();
 if(scene==='docker-images'||scene==='docker-images-empty')await page.locator('[role=tab]').nth(1).click();
 if(scene==='docker-details')await page.locator('tbody td').first().click();
 if(scene==='admin-clones')await page.locator('[role=tab]').nth(1).click();
 await page.waitForTimeout(30);assert.deepEqual(errors,[],scene+' '+name);
 await page.evaluate(()=>{document.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName==='A')e.preventDefault();},true);});
 }
 const controlSelector=scene==='docker-details'?'.modal .btn':'[role=tab],.btn:visible:not(:disabled),input:visible,select:visible';
 const targets=await pages[0].locator(controlSelector).evaluateAll(els=>els.map((el,i)=>({i,key:el.getAttribute('role')==='tab'?'tab-'+i:el.tagName+' '+el.className})).filter((v,i,a)=>a.findIndex(x=>x.key===v.key)===i).map(x=>x.i));
 const runs=[{state:'normal',index:null},...targets.flatMap(index=>['hover','focus','active','space'].map(state=>({state,index})))];
 for(const {state,index} of runs){
 const shots=[],styles=[];
 for(let i=0;i<2;i++){
 const page=pages[i],name=['before','after'][i];await page.mouse.up();await page.keyboard.up(' ');await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,left:0,behavior:'instant'});});await page.mouse.move(width-1,height-1);
 if(index!==null){const control=page.locator(controlSelector).nth(index);
 if(state==='hover')await control.hover();
 if(state==='active'){await control.hover();await page.mouse.down();}
 if(state==='focus'||state==='space'){
 // Legacy dialog anchors lack href/tabindex: same instrumentation on both sides.
 await control.evaluate(el=>{if(el.tagName==='A'&&!el.hasAttribute('href'))el.tabIndex=0;});
 await page.keyboard.press('Tab');await control.focus();assert.ok(await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')));
 if(state==='space')await page.keyboard.down(' ');
 }}
 await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 shots.push(await page.screenshot({path:join(output,`${scene}-${index??'all'}-${state}-${width}-${name}.png`)}));
 styles.push(await page.locator('.btn,[role=tab],.panel,.card,.panel-heading,.card-header,.panel-body,.card-body,.badge,.alert,input,select,th,td,.dropdown-menu').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return{text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,padding:s.padding,margin:s.margin,float:s.cssFloat,display:s.display};})));
 }
 results.push({scene,state,index,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(styles[0])===JSON.stringify(styles[1]),...(shots[0].equals(shots[1])?{}:{before:styles[0],after:styles[1]})});
 }
 await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2));
 for(const page of pages){assert.ok(await page.evaluate(()=>window.requests.every(r=>r.method==='get')));await page.evaluate(()=>window.fixture.dispose());await page.close();}
 }
}finally{await browser.close();}
await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2));
console.log(`${results.filter(x=>x.equal).length}/${results.length} PNG pairs; ${results.filter(x=>x.geometryEqual).length}/${results.length} geometry/style pairs identical`);
assert.ok(results.every(x=>x.equal&&x.geometryEqual),'Inspect comparison.json');
