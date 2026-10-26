// Offline real-component comparison, synthetic data only; no server access.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,readFile,open} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {build} from 'vite';
import vue from '@vitejs/plugin-vue';
import {buildStyles} from '../static-assets.mjs';
const frontend=fileURLToPath(new URL('..',import.meta.url)),output=process.argv[2],reference=process.env.C13_REFERENCE||'6a614dfec';
assert.ok(output);await mkdir(output,{recursive:true});
const previous=p=>execFileSync('git',['show',`${reference}:${p}`],{cwd:frontend,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(frontend)};
const entry=`import {createApp,h} from 'vue';
import Settings from '${frontend}/src/plugins/lmn_settings/SchoolSettings.vue';
import {responses} from '${frontend}/src/plugins/lmn_settings/fixtures.test-data.mjs';
import {createMockAj} from '${frontend}/src/adapter/mock.mjs';
const data=responses(); data['/api/lmn/holidays']=[{name:'Synthetic holiday',start:'invalid',end:'invalid'}];
const aj=createMockAj({gettext:text=>({'Save':'Speichern','Restart WebUI':'Schulkonsole neu starten'}[text]||text),identity:{profile:{sophomorixRole:'globaladministrator'}},http:async r=>{window.requests.push(r);if(r.url==='/api/lmn/ldap-search')return {data:[{label:'Synthetic user',login:'fixture'}]};return {data:structuredClone(data[r.url]),status:200};}});
const app=createApp({render:()=>h(Settings,{layout:{sidebar:true}})});app.provide('aj',aj);app.mount('#fixture');window.fixture={ready:true,dispose:()=>app.unmount()};`;
const bundles={};
for(const name of ['before','after']){
 const result=await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'c13-fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},load(id){if(id==='\0fixture-entry')return entry;if(!id.includes('?')&&/src\/plugins\/lmn_settings\/.*\.vue$/.test(id)){return (name==='before'?previous('frontend/'+id.slice(frontend.length)):execFileSync('cat',[id],{encoding:'utf8'})).replace('const s = createSchoolSettings(aj);','const s = createSchoolSettings(aj);window.settingsState=s;');}}},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
 bundles[name]=result.output[0].code;
}
const scenes=['general','listimport','quota','printing','custom','holidays','password','holidays-empty','custom-students','custom-admin','password-teacher'];
const results=[],browser=await chromium.launch({headless:true});
try{
for(const scene of scenes.filter(s=>!process.env.C13_ONLY||process.env.C13_ONLY.split(',').includes(s)))for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
 const pages=[];
 for(const name of ['before','after']){
 const page=await browser.newPage({viewport:{width,height},locale:'en-GB',timezoneId:'UTC'});pages.push(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html><body class="customized global-color-red"><main id="fixture" style="padding:20px"></main></body></html>'}):r.abort());
 await page.goto('https://fixture.invalid/');await page.addStyleTag({content:css[name]});await page.addStyleTag({content:'*,*::before,*::after {transition:none!important;animation:none!important;scroll-behavior:auto!important}'});
 await page.evaluate(()=>window.requests=[]);await page.addScriptTag({type:'module',content:bundles[name]});await page.waitForFunction(()=>window.fixture?.ready&&window.settingsState.settings);
 const tab=scene.startsWith('holidays')?5:scene.startsWith('custom')?4:scene.startsWith('password')?6:scenes.indexOf(scene);await page.locator('.nav-tabs a').nth(tab).click();
 await page.evaluate(scene=>{const s=window.settingsState;
 if(scene==='holidays-empty')s.holidays=[];
 if(scene==='custom-students')s.custom_fields_role_selector='students';
 if(scene==='custom-admin')s.custom_fields_role_selector='schooladministrators';
 if(scene==='password-teacher')s.passwordConstraintsRole='teacher';
 },scene);
 await page.waitForTimeout(80);assert.deepEqual(errors,[],scene+' '+name);
 await page.evaluate(()=>{document.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('keydown',e=>{if(e.code==='Space')e.preventDefault();},true);});
 }
 const selectors=['.nav-tabs a','.tab-pane.active .btn:visible','.tab-pane.active input:visible,.tab-pane.active select:visible',...(scene==='holidays'?['.tab-pane.active td:nth-child(2) input','.tab-pane.active td:nth-child(3) input']:[])];
 for(const [kind,selector]of selectors.entries()){
 const available=(await Promise.all(pages.map(p=>p.locator(selector).count()))).every(Boolean);
 for(const state of available?['normal','hover','focus','active','space']:['normal']){
 const shots=[],styles=[];
 for(let i=0;i<2;i++){
 const page=pages[i];await page.mouse.up();await page.keyboard.up(' ');await page.evaluate(scene=>{if(scene!=='api-search')document.activeElement?.blur();window.scrollTo(0,0);},scene);await page.mouse.move(width-1,height-1);
 const control=page.locator(selector).first();
 if(available){if(state==='hover'||state==='active')await control.hover();if(state==='active')await page.mouse.down();if(state==='focus'||state==='space'){await control.evaluate(el=>el.tabIndex=0);await control.focus();if(state==='space')await page.keyboard.down(' ');}}
 await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(30);

 assert.equal(await page.locator('.nav-tabs > li.active > a,.nav-tabs a.active').evaluate(el=>getComputedStyle(el).color),'rgb(35, 60, 76)');
 shots.push(await page.screenshot({path:join(output,`${scene}-${kind}-${state}-${width}-${['before','after'][i]}.png`)}));
 styles.push(await page.locator('.btn,.nav-tabs a,.badge,.label,.dropdown-menu a,input,select,th,td').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,padding:s.padding,margin:s.margin,display:s.display};})));
 }
 results.push({scene,kind,state,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(styles[0])===JSON.stringify(styles[1]),before:styles[0],after:styles[1]});
 }
 }
 for(const page of pages){assert.ok(await page.evaluate(()=>window.requests.every(r=>r.method==='get'||r.url==='/api/lmn/ldap-search')));await page.evaluate(()=>window.fixture.dispose());await page.close();}
}
}finally{await browser.close();}
// Stream the unchanged records: expanded breakpoint runs can exceed Node's
// single-string limit even though each individual result fits comfortably.
const comparison=await open(join(output,'comparison.json'),'w');
try{
 await comparison.write('[\n');
 for(const [index,result] of results.entries())await comparison.write((index?',\n':'')+JSON.stringify(result,null,2));
 await comparison.write('\n]\n');
}finally{await comparison.close();}
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,browser:browser.version(),scenes,viewports:[1440,768,390]},null,2));
console.log(`${results.filter(r=>r.equal).length}/${results.length} PNG pairs identical; inspect comparison.json for differences`);
