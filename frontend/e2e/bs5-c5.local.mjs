// C5 offline real-Vue visual comparison; instrument refs only to reach render states.
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
const frontend=fileURLToPath(new URL('..',import.meta.url)), output=process.argv[2];
assert.ok(output); await mkdir(output,{recursive:true});
const reference='33377978e';
const previous=path=>execFileSync('git',['show',`${reference}:${path}`],{cwd:frontend,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(frontend)};
const entry=`import {createApp,h} from 'vue';
import Shares from '${frontend}/src/plugins/lmn_samba_shares/SambaShares.vue';
import Wireguard from '${frontend}/src/plugins/lmn_wireguard/components/Wireguard.vue';
import ImportDialog from '${frontend}/src/plugins/lmn_wireguard/components/ImportDialog.vue';
import ConfigDialog from '${frontend}/src/plugins/lmn_wireguard/components/ConfigDialog.vue';
import {createMockAj} from '${frontend}/src/adapter/mock.mjs';
const scene=window.fixtureScene;
const home='//fixture/home';
const peer={name:'synthetic',public_key:'PUBLIC-FIXTURE',ip:'192.0.2.41',routes:['192.0.2.0/24','198.51.100.0/24']};
const aj=createMockAj({identity:{user:scene==='shares-denied'?'root':'synthetic',profile:scene==='shares-denied'?{}:{sophomorixRole:'teacher'}},http:async r=>{
 window.requests.push(r);
 if(r.url.includes('/shares/'))return scene==='shares-loading'?new Promise(()=>{}):{data:[{name:'Home',path:home,icon:'fa fa-home'},{name:'Other',path:'//fixture/other',icon:'fa fa-folder'}]};
 if(r.url.endsWith('/list')) {if(scene==='shares-error')throw {data:{message:'Fixture denied'}};return {data:{items:scene==='shares-empty'?[]:['transfer','.upload','Folder','file.txt'].map((name,i)=>({name,path:home+'/'+name,isDir:i<3,isFile:i===3,filetype:'text',size:1024,selected:scene==='shares-selected'&&i===3}))}};}
 if(r.url.includes('/sophomorixUsers/'))return {data:scene==='import-empty'?[]:[{sAMAccountName:r.url.endsWith('students')?'fixture-student':'fixture-teacher',givenName:'Synthetic',sn:'User'}]};
 if(r.url==='/api/lmn/wireguard'&&r.data.method==='GET'&&r.data.url==='/api/wireguard/peers')return {data:scene==='wireguard-warning'?false:scene==='wireguard-empty'?[]:[peer]};
 if(r.url==='/api/lmn/wireguard'&&r.data.method==='GET'&&r.data.url==='/api/wireguard/peers/status')return {data:scene==='wireguard-disconnected'?{}:{synthetic:{status:'connected',endpoint:'192.0.2.1:51820',latest_handshake_difference:12,transfer:{received:1.25,send:2.5}}}};
 throw Error('Forbidden fixture request '+JSON.stringify(r));
}});
const type=scene.split('-')[0], component={shares:Shares,wireguard:Wireguard,import:ImportDialog,config:ConfigDialog}[type];
const props=type==='import'?{peers:[{name:'lmn-user_orphan'}]}:type==='config'?{peer:'synthetic',...(scene==='config-qr'?{qr:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+n8AAAAASUVORK5CYII='}:{config:'[Synthetic configuration fixture]'})}:{};
const app=createApp({render:()=>h(component,props)});app.provide('aj',aj);app.mount('#fixture');
window.fixture={ready:true,dispose:()=>app.unmount()};`;
const bundles={};
for(const name of ['before','after']){
 const result=await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'c5-fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},load(id){
 if(id==='\0fixture-entry')return entry;
 if(id===join(frontend,'src/common/SmbUpload.vue'))return '<script setup>const progress=window.fixtureScene===\'shares-upload\'?[{id:1,name:\'fixture.txt\',progress:37}]:[];const browseRef=()=>{};</script><template><div class="smb-upload"><div><slot :browse-ref="browseRef" :progress="progress" /></div></div></template>';
 if(!id.includes('?')&&/src\/plugins\/lmn_(samba_shares|wireguard)\/.*\.vue$/.test(id)){
 let source=name==='before'?previous('frontend/'+id.slice(frontend.length)):execFileSync('cat',[id],{encoding:'utf8'});
 if(id.endsWith('/SambaShares.vue')) source=source.replace('</script>',`window.fixtureRefs={dialog,newName,clipboard};</script>`);
 if(id.endsWith('/ImportDialog.vue')) source=source.replace('</script>',`window.fixtureRefs={userstoimport,peerstodelete,importstatus,importmax,importprogress};</script>`);
 return source;
 }
 }},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
 bundles[name]=result.output[0].code; await writeFile(join(output,name+'.js'),bundles[name]);
}
const scenes=['shares','shares-empty','shares-loading','shares-denied','shares-error','shares-selected','shares-clipboard','shares-file','shares-directory','shares-upload','wireguard','wireguard-disconnected','wireguard-empty','wireguard-warning','import','import-lists','import-progress','import-stalled','import-empty','import-complete','config','config-qr'];
const variants=['normal','hover','focus','active','space'];
const results=[];const browser=await chromium.launch({headless:true});
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,browser:browser.version(),fixture:'offline synthetic refs, frozen motion, normalized instant scroll; no network',cssSha256:Object.fromEntries(Object.entries(css).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))},null,2));
try{
 for(const scene of scenes.filter(s=>!process.env.C5_ONLY||process.env.C5_ONLY.split(',').includes(s)))for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
 const pages=[];
 for(const name of ['before','after']){
 const page=await browser.newPage({viewport:{width,height},locale:'en-GB',timezoneId:'UTC'});pages.push(page);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',r=>r.request().url()==='https://fixture.invalid/'?r.fulfill({contentType:'text/html',body:'<!doctype html><html><body class="customized"><main id="fixture" style="padding:20px"></main></body></html>'}):r.abort());
 await page.goto('https://fixture.invalid/');await page.addStyleTag({content:css[name]}); await page.addStyleTag({content:'*,*::before,*::after { transition: none !important; animation: none !important; scroll-behavior: auto !important; }'});
 await page.evaluate(scene=>{window.fixtureScene=scene;window.requests=[];},scene);await page.addScriptTag({type:'module',content:bundles[name]});await page.waitForFunction(()=>window.fixture?.ready);
 assert.ok(await page.evaluate(()=>!!window.fixtureRefs)||(!scene.startsWith('shares-')&&!scene.startsWith('import-')),scene+' refs '+name);
 await page.evaluate(scene=>{
 const r=window.fixtureRefs;
 if(scene==='shares-file'||scene==='shares-directory')r.dialog.value=scene.slice(7);
 if(scene==='shares-clipboard') {r.clipboard.value=[{item:{name:'fixture.txt',path:'//fixture/other/fixture.txt',isFile:true},mode:'copy'}];r.dialog.value='clipboard';}
 if(scene.startsWith('import-')&&scene!=='import-empty'){r.userstoimport.value=[{sAMAccountName:'fixture-student',givenName:'Synthetic',sn:'User'}];r.peerstodelete.value=[{name:'lmn-user_orphan'}];}
 if(scene==='import-progress'){r.importstatus.value=1;r.importmax.value=2;r.importprogress.value=50;}
 if(scene==='import-complete'){r.importstatus.value=2;r.importmax.value=2;r.importprogress.value=100;}
 if(scene==='import-stalled'){r.importstatus.value=0;r.importmax.value=2;r.importprogress.value=0;}
 },scene);
 await page.waitForTimeout(100);assert.deepEqual(errors,[],scene+' '+name); await page.evaluate(()=>{document.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName==='A')e.preventDefault();},true);});
 }
 const controls=await Promise.all(pages.map(p=>p.locator(scene.startsWith('import')?'.modal-footer button:last-child':scene.startsWith('shares-')&&['shares-file','shares-directory','shares-clipboard'].includes(scene)?'.modal-footer .btn:last-child':scene==='shares-selected'?'floating-toolbar.accented a.btn:visible':scene.startsWith('shares')?'a.btn:visible':scene.startsWith('wireguard')?'button:has(.fa-refresh)':'[data-no-control]').first().count()));
 for(const state of controls.every(Boolean)?variants:['normal']){
 const shots=[],styles=[];
 for(let i=0;i<2;i++){
 const page=pages[i],name=['before','after'][i];await page.mouse.up();await page.keyboard.up(' ');await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({top:0,left:0,behavior:'instant'});});await page.mouse.move(width-1,height-1);
 const control=page.locator(scene.startsWith('import')?'.modal-footer button:last-child':scene.startsWith('shares-')&&['shares-file','shares-directory','shares-clipboard'].includes(scene)?'.modal-footer .btn:last-child':scene==='shares-selected'?'floating-toolbar.accented a.btn:visible':scene.startsWith('shares')?'a.btn:visible':'button:has(.fa-refresh)').first();
 if(state==='hover')await control.hover();
 if(state==='active'){await control.hover();await page.mouse.down();}
 if(state==='focus'||state==='space'){
 // Legacy Samba anchors lack href/tabindex. Instrument both versions identically to measure CSS focus only.
 if(scene.startsWith('shares'))await control.evaluate(el=>el.tabIndex=0);
 for(let n=0;n<45;n++){await page.keyboard.press('Tab');if(await control.evaluate(el=>el===document.activeElement))break;}
 assert.ok(await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')));
 if(state==='space')await page.keyboard.down(' ');
 }
 await page.waitForTimeout(100); await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 shots.push(await page.screenshot({path:join(output,`${scene}-${state}-${width}-${name}.png`)}));
 styles.push(await page.locator('.btn,.progress,.progress-bar,.list-group-item,.list-group-addon,.badge,.root-access-blocker,.alert,input,th,td').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,padding:s.padding,margin:s.margin,float:s.cssFloat,display:s.display};})));
 }
 results.push({scene,state,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(styles[0])===JSON.stringify(styles[1]),before:styles[0],after:styles[1]});
 }
 for(const page of pages){assert.ok(await page.evaluate(()=>window.requests.every(r=>r.url.includes('/shares/')||r.url.endsWith('/list')||r.url.includes('/sophomorixUsers/')||(r.url==='/api/lmn/wireguard'&&r.data.method==='GET'&&['/api/wireguard/peers','/api/wireguard/peers/status'].includes(r.data.url)))),'Only fixture reads allowed');await page.evaluate(()=>window.fixture.dispose());await page.close();}
 }
}finally{await browser.close();}
await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2));
console.log(`${results.filter(x=>x.equal).length}/${results.length} PNG pairs; ${results.filter(x=>x.geometryEqual).length}/${results.length} geometry/style pairs identical`);
assert.ok(results.every(x=>x.equal&&x.geometryEqual),'Inspect comparison.json');
