// P170: real Vue and built CSS, all requests synthetic; no VM access.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {build} from 'vite';
import vue from '@vitejs/plugin-vue';
import {buildStyles} from '../static-assets.mjs';
const frontend=fileURLToPath(new URL('..',import.meta.url)),reference='deab5549d',output=process.argv[2];
assert.ok(output,'Pass output directory');await mkdir(output,{recursive:true});
const previous=path=>execFileSync('git',['show',`${reference}:${path}`],{cwd:frontend,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(frontend)};
const logo=await readFile(join(frontend,'../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/img/logo-full.png'));
const entry=`import {createApp,h} from 'vue';
import Wizard from '${frontend}/src/plugins/lmn_setup_wizard/Wizard.vue';
const scene=window.fixtureScene,step=scene.split('-')[0],requests=[];
const ini={schoolname:'Synthetic School',location:'Test City',state:'Test State',country:'de',servername:'server',domainname:'lmn.lan',skipfw:scene==='externalservices-off'?false:'False'};
const aj={gettext:s=>s,pageTitle:{set(){}},navigate(){},reload(){},notify:{error(){},success(){}},
 http:{get:async url=>{requests.push(['GET',url]);if(scene==='summary-loading')return new Promise(()=>{});return{data:url.includes('/log/')?(url.endsWith('?offset=0')?'Synthetic setup log\\n':''):url==='/api/core/languages'?['de','en']:url.includes('read-config')?{setup:{hostip:'192.0.2.71'}}:{...ini}};},
 post:async(url,payload)=>{requests.push(['POST',url,payload]);if(scene==='setup-working')return new Promise(()=>{});if(scene==='setup-error')throw{data:{message:'Synthetic rejection'}};return{};}},
 wizard:{readConfig:()=>({language:'de'}),saveConfig:async()=>{},setConfigLanguage:async()=>{}},locale:{setLanguage:async()=>{}},messagebox:{show:()=>Object.assign(new Promise(()=>{}),{close(){}})}};
const app=createApp({render:()=>h(Wizard,{step})});app.provide('aj',aj);app.mount('#fixture');window.fixture={requests,ready:true,dispose(){app.unmount();}};`;
const bundles={};
for(const name of ['before','after']){
 const result=await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},load(id){
 if(id==='\0fixture-entry')return entry;
 if(name==='before'&&id.includes('/src/plugins/lmn_setup_wizard/')&&/\.(vue|mjs)$/.test(id)&&!id.includes('?'))return previous('frontend/'+id.slice(frontend.length));
 }},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});bundles[name]=result.output[0].code;
}
const scenes=['welcome','welcome-accepted','school','school-error','account','account-error','account-valid','externalservices','externalservices-off','summary','summary-loading','setup','setup-working','setup-error','done'];
// P176: later empty log polls depend on screenshot duration, not on the UI contract.
function assertRequestsEqual(before,after,scene){
 if(!scene.startsWith('setup'))return assert.deepEqual(before,after);
 const initial=['GET','/api/lmn/log/tmp/linuxmuster-setup.log?offset=0'];
 const subsequent=['GET','/api/lmn/log/tmp/linuxmuster-setup.log?offset=20'];
 const comparable=requests=>{
  const polls=requests.filter(request=>request[0]==='GET'&&request[1].startsWith('/api/lmn/log/'));
  assert.deepEqual(polls[0],initial,'First setup log poll');
  for(const poll of polls.slice(1))assert.deepEqual(poll,subsequent,'Subsequent empty setup log poll');
  return requests.filter(request=>JSON.stringify(request)!==JSON.stringify(subsequent));
 };
 assert.deepEqual(comparable(before),comparable(after));
}
const results=[],browser=await chromium.launch({headless:true});
const snapshot=page=>page.locator('.modal *').evaluateAll(elements=>elements.filter(e=>e.getClientRects().length).map(e=>{
 const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{tag:e.tagName,text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow,font:s.font,lineHeight:s.lineHeight,display:s.display,opacity:s.opacity,outline:s.outline,textDecoration:s.textDecoration,focusVisible:e.matches(':focus-visible'),active:e.matches(':active'),hover:e.matches(':hover')};
}));
try{for(const scene of scenes)for(const[width,height]of[[1440,900],[768,1024],[390,844]]){
 if(process.argv[3] && width!==Number(process.argv[3]))continue;
 const observations={};
 for(const name of ['before','after']){
 const page=await browser.newPage({viewport:{width,height},timezoneId:'UTC',locale:'en-GB'});page.setDefaultTimeout(4000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().endsWith('/logo-full.png')?r.fulfill({body:logo,contentType:'image/png'}):r.abort());
 await page.setContent('<!doctype html><html><head><base href="http://fixture.local/"></head><body class="customized"><div id="fixture"></div></body></html>');await page.addStyleTag({content:css[name]});await page.addStyleTag({content:'*,*::before,*::after { animation: none !important; transition: none !important; caret-color: transparent !important; }'});await page.evaluate(scene=>window.fixtureScene=scene,scene);await page.addScriptTag({type:'module',content:bundles[name]});await page.waitForFunction(()=>window.fixture?.ready);
 if(scene.startsWith('setup'))await page.waitForFunction(()=>document.querySelector('.modal pre')?.textContent==='Synthetic setup log\n');else await page.waitForTimeout(1100);
 if(scene.startsWith('welcome'))await page.locator('img').evaluate(e=>e.decode());
 if(scene==='welcome-accepted')await page.locator('input[type=checkbox]').check();
 if(scene==='school-error'){await page.locator('#schoolname-input').fill('');await page.getByText('Next',{exact:true}).click();}
 if(scene==='account-error'||scene==='account-valid'){const inputs=page.locator('input[type=password]');await inputs.nth(0).fill(scene==='account-valid'?'Synthetic7!':'weak');await inputs.nth(1).fill(scene==='account-valid'?'Synthetic7!':'different');}
 assert.deepEqual(errors,[],scene);
 // Freeze callbacks after arranging real state. Native focus/hover/active still work.
 await page.evaluate(()=>{for(const type of ['click','change'])document.addEventListener(type,e=>{e.preventDefault();e.stopImmediatePropagation();},true);});
 const states={};async function record(key){await page.waitForTimeout(100);const shot=await page.screenshot({animations:'disabled',path:join(output,scene+'-'+width+'-'+key+'-'+name+'.png')});states[key]={styles:await snapshot(page),sha256:createHash('sha256').update(shot).digest('hex')};}
 await page.evaluate(()=>document.activeElement?.blur());await page.mouse.move(width-1,height-1);await record('normal');
 const controls=page.locator('.modal-footer a, select, input, [checkbox]').filter({visible:true});
 for(let i=0;i<await controls.count();i++){
 const el=controls.nth(i);await el.hover();await record(i+'-hover');await page.mouse.move(width-1,height-1);await page.keyboard.press('Tab');await el.focus();
 if(await el.evaluate(e=>e===document.activeElement)){await record(i+'-focus');await page.keyboard.down(' ');await record(i+'-space');await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.up(' ');}
 await el.hover();const point=await el.boundingBox(),x=point.x+point.width/2,y=point.y+point.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+1,y);await page.mouse.move(x,y);assert.ok(await el.evaluate(e=>e.tagName==='SELECT'||e.matches(':active')));await record(i+'-active');await page.mouse.move(width-1,height-1);await page.mouse.up();await page.evaluate(()=>document.activeElement?.blur());
 }
 observations[name]={states,requests:await page.evaluate(()=>window.fixture.requests),logo:await page.locator('img').evaluateAll(es=>es.map(e=>({width:e.width,naturalWidth:e.naturalWidth,bodyWidth:e.parentElement.clientWidth})))};await page.evaluate(()=>window.fixture.dispose());await page.close();
 }
 assertRequestsEqual(observations.before.requests,observations.after.requests,scene);
 for(const key of Object.keys(observations.before.states)){const b=observations.before.states[key],a=observations.after.states[key];results.push({scene,width,state:key,equal:b.sha256===a?.sha256,geometryEqual:JSON.stringify(b.styles)===JSON.stringify(a?.styles),expected:scene.startsWith('welcome')&&width===390?'D12':null});}
 if(scene.startsWith('welcome')&&width===390){assert.ok(observations.before.logo[0].width>observations.before.logo[0].bodyWidth-40);assert.ok(observations.after.logo[0].width<=observations.after.logo[0].bodyWidth-40);}
 await writeFile(join(output,scene+'-'+width+'-metadata.json'),JSON.stringify(observations,null,2)+'\n');await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2)+'\n');
}}finally{await browser.close();}
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,cssSha256:Object.fromEntries(Object.entries(css).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))},null,2)+'\n');
console.log(results.filter(r=>r.equal).length+'/'+results.length+' PNG pairs identical; '+results.filter(r=>r.geometryEqual).length+' identical geometry/style pairs');
assert.ok(results.every(r=>r.expected||(r.equal&&r.geometryEqual)),'Unexpected C14 rendering difference; inspect comparison.json');
