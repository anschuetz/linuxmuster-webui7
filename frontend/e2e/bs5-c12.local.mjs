// Offline real-component comparison, synthetic data only; no server access.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {build} from 'vite';
import vue from '@vitejs/plugin-vue';
import {buildStyles} from '../static-assets.mjs';
const frontend=fileURLToPath(new URL('..',import.meta.url)),output=process.argv[2],reference='78cfb5e48';
assert.ok(output);await mkdir(output,{recursive:true});
const previous=p=>execFileSync('git',['show',`${reference}:${p}`],{cwd:frontend,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(frontend)};
const entry=`import {createApp,h} from 'vue';
import Settings from '${frontend}/src/plugins/lmn_settings/GlobalSettings.vue';
import {responses} from '${frontend}/src/plugins/lmn_settings/fixtures.test-data.mjs';
import {createMockAj} from '${frontend}/src/adapter/mock.mjs';
const data=responses();data['/api/core/config'].email.enable=true;
data['/api/lmn/subnets']=[{name:'Synthetic',subnet:'192.0.2.0/24'}];
data['/api/core/tfa-config']={'fixture@ldap':{totp:[{created:1700000000,description:'Synthetic device'}]}};
data['/api/lmn/apisettings']={keys:{fixture:{user:'fixture',ips:['192.0.2.1'],scope:['GET /fixture/**']}},enable_host_auth:true};
const aj=createMockAj({gettext:text=>({'Save':'Speichern','Restart WebUI':'Schulkonsole neu starten'}[text]||text),identity:{profile:{sophomorixRole:'globaladministrator'}},http:async r=>{window.requests.push(r);if(r.url==='/api/lmn/ldap-search')return {data:[{label:'Synthetic user',login:'fixture'}]};return {data:structuredClone(data[r.url]),status:200};}});
const app=createApp({render:()=>h(Settings,{layout:{sidebar:true}})});app.provide('aj',aj);app.mount('#fixture');window.fixture={ready:true,dispose:()=>app.unmount()};`;
const bundles={};
for(const name of ['before','after']){
 const result=await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'c12-fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},load(id){if(id==='\0fixture-entry')return entry;if(!id.includes('?')&&/src\/plugins\/lmn_settings\/.*\.vue$/.test(id)){return (name==='before'?previous('frontend/'+id.slice(frontend.length)):execFileSync('cat',[id],{encoding:'utf8'})).replace('const s = createGlobalSettings(aj);','const s = createGlobalSettings(aj);window.settingsState=s;');}}},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
 bundles[name]=result.output[0].code;
}
const scenes=['general','subnets','smtp','roles','api','tfa','edulution','version','api-new','api-update','api-ip','api-scope','api-secret','api-search','smtp-password'];
const results=[],browser=await chromium.launch({headless:true});
try{
for(const scene of scenes.filter(s=>!process.env.C12_ONLY||process.env.C12_ONLY.split(',').includes(s)))for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
 const pages=[];
 for(const name of ['before','after']){
 const page=await browser.newPage({viewport:{width,height},locale:'en-GB',timezoneId:'UTC'});pages.push(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html><body class="customized"><main id="fixture" style="padding:20px"></main></body></html>'}):r.abort());
 await page.goto('https://fixture.invalid/');await page.addStyleTag({content:css[name]});await page.addStyleTag({content:'*,*::before,*::after {transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
 await page.evaluate(()=>window.requests=[]);await page.addScriptTag({type:'module',content:bundles[name]});await page.waitForFunction(()=>window.fixture?.ready&&window.settingsState.config.data);
 const tab=scene.startsWith('api')?4:scene.startsWith('smtp')?2:scenes.indexOf(scene);await page.locator('.nav-tabs a').nth(tab).click();
 await page.evaluate(scene=>{const s=window.settingsState;if(scene.startsWith('api-')){s.apiKey={name:'fixture',ips:['192.0.2.1'],scope:['GET /fixture/**']};s._.newApiUser={label:'Synthetic user',login:'fixture'};s.showNewApiKey=true;}
 if(scene==='api-update'){s.showNewApiKey=false;s.showUpdateApiKey=true;}
 if(scene==='api-ip'){s.showAddApiKeyIp=true;s._.newIp='invalid';}
 if(scene==='api-scope'){s.showAddApiKeyScope=true;s._.newScope='invalid';}
 if(scene==='api-secret'){s.showNewApiKey=false;s.showApiKeySecret=true;s.apiKeySecret='SYNTHETIC-SECRET';}
 if(scene==='smtp-password')s.showSMTPPassword=true;},scene);
 if(scene==='api-search')await page.locator('.modal input').last().fill('syn');
 await page.waitForTimeout(80);assert.deepEqual(errors,[],scene+' '+name);
 await page.evaluate(()=>{document.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('keydown',e=>{if(e.code==='Space')e.preventDefault();},true);});
 }
 const selectors=[...(scene.startsWith('api-')?[]:['.nav-tabs a']),scene.startsWith('api-')?'.modal-footer .btn:visible':'.tab-pane.active .btn:visible'];
 for(const [kind,selector]of selectors.entries()){
 const available=(await Promise.all(pages.map(p=>p.locator(selector).count()))).every(Boolean);
 for(const state of available?['normal','hover','focus','active','space']:['normal']){
 const shots=[],styles=[];
 for(let i=0;i<2;i++){
 const page=pages[i];await page.mouse.up();await page.keyboard.up(' ');await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await page.mouse.move(width-1,height-1);
 const control=scene.startsWith('api-')?page.locator(selector).last():page.locator(selector).first();
 if(available){if(state==='hover'||state==='active')await control.hover();if(state==='active')await page.mouse.down();if(state==='focus'||state==='space'){await control.evaluate(el=>el.tabIndex=0);await control.focus();if(state==='space')await page.keyboard.down(' ');}}
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(30);
 shots.push(await page.screenshot({path:join(output,`${scene}-${kind}-${state}-${width}-${['before','after'][i]}.png`)}));
 styles.push(await page.locator('.btn,.nav-tabs a,.badge,.label,.dropdown-menu a,input,select,th,td').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,padding:s.padding,margin:s.margin,display:s.display};})));
 }
 results.push({scene,kind,state,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(styles[0])===JSON.stringify(styles[1]),before:styles[0],after:styles[1]});
 }
 }
 for(const page of pages){assert.ok(await page.evaluate(()=>window.requests.every(r=>r.method==='get'||r.url==='/api/lmn/ldap-search')));await page.evaluate(()=>window.fixture.dispose());await page.close();}
}
}finally{await browser.close();}
await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2));await writeFile(join(output,'metadata.json'),JSON.stringify({reference,browser:browser.version(),scenes,viewports:[1440,768,390]},null,2));
console.log(`${results.filter(r=>r.equal).length}/${results.length} PNG pairs identical; inspect comparison.json for D13 and differences`);
