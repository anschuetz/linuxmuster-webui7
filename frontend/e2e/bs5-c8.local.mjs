// P164: offline real Vue, synthetic data, baseline sources/CSS at the package base.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {build} from 'vite';
import vue from '@vitejs/plugin-vue';
import {buildStyles} from '../static-assets.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),out=process.argv[2];assert.ok(out);await mkdir(out,{recursive:true});
const reference='78cfb5e48',previous=p=>execFileSync('git',['show',`${reference}:${p}`],{cwd:root,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(root)};
const entry=`import {createApp,h} from 'vue';
import {createMockAj} from '${root}/src/adapter/mock.mjs';
import Page from '${root}/src/plugins/lmn_linbo4/LinboPage.vue';
import Groups from '${root}/src/plugins/lmn_linbo4/GroupsTab.vue';
import Config from '${root}/src/plugins/lmn_linbo4/ConfigDialog.vue';
import Partition from '${root}/src/plugins/lmn_linbo4/PartitionDialog.vue';
import Script from '${root}/src/plugins/lmn_linbo4/ScriptEditor.vue';
import {editorConfig,editorVDI} from '${root}/e2e/fixtures/linbo4-editor.mjs';
import {configs} from '${root}/e2e/fixtures/linbo4.mjs';
const scene=window.fixtureScene;
const examples=['start.conf.bios64-linux-example-template','start.conf.efi64-windows-example-template'];
const aj=createMockAj({identity:{profile:{activeSchool:'default-school'}},http:async r=>{
 window.requests.push(r);if(r.method!=='get')throw Error('Unexpected write');
 if(scene==='page-loading')return new Promise(()=>{});
 if(r.url.endsWith('/configs'))return {data:configs()};
 if(r.url.endsWith('/examples/config'))return {data:examples};
 if(r.url.endsWith('/icons'))return {data:['ubuntu.svg','win10.svg','old.png','linbo_hidden.svg']};
 if(r.url.endsWith('/images'))return {data:[{name:'linux',used_in:['fixture'],backups:{}}]};
 throw Error('Unexpected fixture request '+r.url);
}});
const component=scene.startsWith('page')?Page:scene.startsWith('groups')?Groups:scene.startsWith('config')?Config:scene.startsWith('partition')?Partition:Script;
const config=editorConfig(),vdi=editorVDI();
const props=component===Groups?{configs:scene==='groups-empty'?[]:configs(),examples,changed:scene==='groups-changed'}:component===Config?{config,vdiconfig:scene==='config-no-vdi'?null:vdi}:component===Partition?{partition:config.partitions[1],os:scene==='partition-no-os'?null:config.os[0]}:component===Script?{modelValue:'#!/bin/sh\\necho synthetic\\n',field:'reg',active:true}:{};
const dialog=component===Config||component===Partition;
const app=createApp({render:()=>dialog?h('div',{class:'modal show',style:'display:block;background:rgba(0,0,0,.5)'},h('div',{class:'modal-dialog'},h('div',{class:'modal-content'},h(component,props)))):h(component,props)});
app.provide('aj',aj);app.mount('#fixture');window.fixture={ready:true,dispose:()=>app.unmount()};`;
const bundles={};
for(const variant of ['before','after']){
 const result=await build({root,configFile:false,logLevel:'error',plugins:[{name:'c8-fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},async load(id){
 if(id==='\0fixture-entry')return entry;
 if(!id.includes('?')&&id.includes('/src/plugins/lmn_linbo4/')&&id.endsWith('.vue')){
 let source=variant==='before'?previous('frontend/'+id.slice(root.length)):await readFile(id,'utf8');
 if(id.endsWith('/ConfigDialog.vue'))source=source.replace('</script>','window.fixtureRefs={tab,expert,state};</script>');
 if(id.endsWith('/PartitionDialog.vue'))source=source.replace('</script>','window.fixtureRefs={tab,advanced,iconMenu};</script>');
 return source;
 }
 }},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});bundles[variant]=result.output[0].code;
}
const scenes=['page','page-images','page-loading','groups','groups-empty','groups-changed','groups-menu','config','config-no-vdi','config-invalid','config-partitions','config-vdi','config-expert','partition','partition-no-os','partition-invalid','partition-advanced','partition-os','partition-icons','partition-os-advanced','config-buttons','partition-buttons','script','script-ace'];
const browser=await chromium.launch({headless:true}),results=[];
await writeFile(join(out,'metadata.json'),JSON.stringify({reference,browser:browser.version(),scenes,limitations:'Synthetic fixture refs reach nested states; ScriptEditor textarea and real Ace; no image/sync/import actions.'},null,2));
try{
for(const scene of scenes.filter(s=>!process.env.C8_ONLY||process.env.C8_ONLY.split(',').includes(s)))for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
 const pages=[];
 for(const variant of ['before','after']){
 const p=await browser.newPage({viewport:{width,height}});pages.push(p);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',async r=>{
 const url=new URL(r.request().url()),font=url.pathname.match(/^\/assets\/fonts\/([a-zA-Z0-9_.-]+)$/);
 if(url.href==='https://fixture.invalid/')return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body class="customized"><main id="fixture" style="padding:20px"></main></body></html>'});
 if(font)return r.fulfill({body:await readFile(join(root,'vendor/fonts',font[1]))});
 if(url.pathname.startsWith('/api/lmn/linbo4/icons/'))return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="2" y="2" width="28" height="28" fill="#233c4c"/></svg>'});
 return r.abort();});await p.goto('https://fixture.invalid/');
 await p.addStyleTag({content:css[variant]});await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
 if(scene==='script-ace'){await p.addScriptTag({content:await readFile(join(root,'vendor/ace/ace.js'),'utf8')});await p.addScriptTag({content:await readFile(join(root,'vendor/ace/theme-solarized_dark.js'),'utf8')});}
 await p.evaluate(scene=>{window.fixtureScene=scene;window.requests=[];},scene);await p.addScriptTag({type:'module',content:bundles[variant]});await p.waitForFunction(()=>window.fixture?.ready);
 await p.evaluate(scene=>{
 const r=window.fixtureRefs;
 if(scene==='config-partitions')r.tab.value='partitions';
 if(scene==='config-vdi'||scene==='config-expert'){r.tab.value='vdi';r.expert.value=scene==='config-expert';}
 if(scene.startsWith('partition-os')||scene==='partition-icons')r.tab.value='os';
 if(scene==='partition-icons')r.iconMenu.value=true;
 if(scene.includes('advanced'))r.advanced.value=true;
 },scene);
 if(scene==='page-images')await p.locator('.nav-tabs a').nth(1).click();
 if(scene==='groups-menu')await p.locator('[data-action="create"]').click();
 if(scene==='partition-invalid')await p.locator('[data-model="partition.Label"]').fill('invalid label');
 if(scene==='config-invalid')await p.locator('[data-model="config.config.LINBO.BackgroundColor"]').fill('invalid');
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(80);assert.deepEqual(errors,[],scene+' '+variant);
 // Measure CSS states without executing config/hardware operations on Space/mouse release.
 await p.evaluate(()=>{document.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName==='A')e.preventDefault();},true);});
 }
 const target=scene.endsWith('-buttons')?'.modal-footer button:last-child':scene==='script'?'textarea':scene==='script-ace'?'.ace_editor':scene.includes('invalid')?'input:visible':scene==='partition-icons'?'.dropdown button:visible':scene==='groups-menu'?'[data-action="create"]':scene.startsWith('config')||scene.startsWith('partition')?'.nav-tabs a:visible':scene==='page-loading'?'[data-no-control]':scene.startsWith('page')?'.nav-tabs a:visible':'button:has(.fa-pencil)';
 const controls=await Promise.all(pages.map(p=>p.locator(target).count()));
 for(const state of controls.every(Boolean)?['normal','hover','focus','active','space']:['normal']){
 const shots=[],styles=[];
 for(let i=0;i<2;i++){
 const p=pages[i],variant=['before','after'][i],control=p.locator(target).first();await p.mouse.up();await p.keyboard.up(' ');await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await p.mouse.move(width-1,height-1);
 if(state==='hover')await control.hover();
 if(state==='active'){await control.hover();await p.mouse.down();}
 if(state==='focus'||state==='space'){
 if(scene==='script-ace')await p.locator('.ace_text-input').focus();else await control.evaluate(el=>el.focus()); // Force keyboard modality for focus-visible.
 await p.keyboard.press('Shift');assert.ok(scene==='script-ace'?await p.locator('.ace_text-input').evaluate(el=>el===document.activeElement):await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')));
 if(state==='space')await p.keyboard.down(' ');
 }
 await p.waitForTimeout(50);
 if(scene==='groups-menu'&&width===390&&variant==='after'){const bounds=await p.locator('.dropdown-menu').boundingBox();assert.ok(bounds.x>=20&&bounds.x+bounds.width<=width-20,'D09 menu stays within viewport');await writeFile(join(out,'menu-ancestors.json'),JSON.stringify(await p.locator('.dropdown-menu').evaluate(el=>{let out=[];while(el){let s=getComputedStyle(el),r=el.getBoundingClientRect();out.push({tag:el.tagName,cls:el.className,position:s.position,left:s.left,right:s.right,width:r.width,x:r.x});el=el.parentElement;}return out;}),null,2));}
 shots.push(await p.screenshot({path:join(out,`${scene}-${state}-${width}-${variant}.png`)}));
 styles.push(await p.locator('.btn,input,select,textarea,td,.nav-tabs a,.modal-header,.modal-body,.modal-footer,.card,.panel,.card-header,.panel-heading,.card-body,.panel-body,.dropdown-menu:visible,.dropdown-menu a:visible,td span').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,padding:s.padding,margin:s.margin,display:s.display,float:s.cssFloat};})));
 }
 results.push({scene,state,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(styles[0])===JSON.stringify(styles[1]),before:styles[0],after:styles[1]});
 }
 for(const p of pages){assert.ok(await p.evaluate(()=>window.requests.every(r=>r.method==='get')));await p.evaluate(()=>window.fixture.dispose());await p.close();}
}
}finally{await browser.close();await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));}
const unexpected=results.filter(r=>!r.equal&&!(r.scene==='groups-menu'&&r.width===390));
console.log(JSON.stringify({pairs:results.length,exact:results.filter(r=>r.equal).length,unexpected:unexpected.map(({scene,state,width,geometryEqual})=>({scene,state,width,geometryEqual}))},null,2));
assert.equal(unexpected.length,0,'Visual differences require classification');
