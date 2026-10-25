// P165: offline real Vue, synthetic data, baseline sources/CSS at the package base.
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
const reference='1070e6052',previous=p=>execFileSync('git',['show',`${reference}:${p}`],{cwd:root,encoding:'utf8'});
const css={before:previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'),after:await buildStyles(root)};
const entry=`import {createApp,h} from 'vue';
import {createMockAj} from '${root}/src/adapter/mock.mjs';
import Images from '${root}/src/plugins/lmn_linbo4/ImagesTab.vue';
import Image from '${root}/src/plugins/lmn_linbo4/ImageDialog.vue';
import Backups from '${root}/src/plugins/lmn_linbo4/ImageBackupsDialog.vue';
import Import from '${root}/src/plugins/lmn_linbo4/ImportDialog.vue';
import Accept from '${root}/src/plugins/lmn_linbo4/AcceptDialog.vue';
import Sync from '${root}/src/plugins/lmn_linbo_sync/components/LinboSync.vue';
import {imageList,backupImage} from '${root}/e2e/fixtures/linbo4-images.mjs';
import {groups} from '${root}/e2e/fixtures/linboSync.mjs';
const scene=window.fixtureScene;
const aj=createMockAj({http:async r=>{
 window.requests.push(r);
 if(r.method!=='get' && !(scene.startsWith('import')&&r.url==='/api/lmn/devices/import'))throw Error('Unexpected fixture write');
 if(r.url==='/api/lmn/devices/import') {if(scene==='import-working')return new Promise(()=>{});if(scene==='import-error')throw {data:{message:'synthetic failure'}};return {data:{}};}
 if(r.url.endsWith('activeschool'))return {data:'default-school'};
 if(r.url.endsWith('last_syncs')) {if(scene==='sync-loading')return new Promise(()=>{});if(scene==='sync-empty')return {data:{}};const data=groups();if(scene.startsWith('sync-status-'))data.p52group.hosts=data.p52group.hosts.map(h=>({...h,upClass:scene.endsWith('success')?'btn-success':'btn-danger',up_comment:scene.endsWith('success')?'OS Linux':'Off',up_icon:scene.endsWith('success')?'fab fa-linux':'fas fa-power-off'}));return {data};}
 if(r.url.includes('/examples/'))return {data:['synthetic.example']};
 if(r.url.includes('read'))return {data:'synthetic log'};
 return {data:[]};
}});
const component=scene.startsWith('images')?Images:scene.startsWith('image-')?Image:scene==='backups'?Backups:scene.startsWith('import')?Import:scene==='accept'?Accept:Sync;
const images=imageList().map(image=>({...image,used_in:['fixture']}));
const image=scene==='image-diff'?images[0].diff_image:scene==='image-backup'?backupImage():images[0];
const props=component===Images?{images:scene==='images-empty'?[]:scene==='images-loading'?undefined:images,hasSelected:scene==='images-selected',sidebar:false}:component===Image?{image,images,renameImage:()=>{}}:component===Backups?{image:{...image,backups_list:[{...backupImage(),date:'20261001'}]},editImage:()=>{},restoreBackup:()=>{},deleteBackupImage:()=>{}}:component===Accept?{partition:'sda1',disk:{}}:{};
const dialog=[Image,Backups,Import,Accept].includes(component);
const app=createApp({render:()=>dialog?h('div',{class:'modal show',style:'display:block;background:rgba(0,0,0,.5)'},h('div',{class:'modal-dialog'},h('div',{class:'modal-content'},h(component,props)))):h(component,props)});
app.provide('aj',aj);app.mount('#fixture');window.fixture={ready:true,dispose:()=>app.unmount()};`;
const bundles={};
for(const variant of ['before','after']){
 const result=await build({root,configFile:false,logLevel:'error',plugins:[{name:'c9-fixture',enforce:'pre',resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},async load(id){
 if(id==='\0fixture-entry')return entry;
 if(!id.includes('?')&&/\/src\/plugins\/lmn_linbo(?:4|_sync)\//.test(id)&&id.endsWith('.vue')){
 let source=variant==='before'?previous('frontend/'+id.slice(root.length)):await readFile(id,'utf8');
 if(id.endsWith('/ImportDialog.vue'))source=source.replace('</script>','window.fixtureRefs={state};</script>');
 return source;
 }
 }},vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',codeSplitting:false}}}});bundles[variant]=result.output[0].code;
}
const scenes=['images','images-empty','images-loading','images-selected','image-general','image-diff','image-backup','image-reg','image-postsync','image-prestart','image-copy','backups','accept','import-working','import-done','import-error','import-hidden','sync','sync-second','sync-loading','sync-empty','sync-wol','sync-preview','image-buttons','image-rename','sync-buttons','sync-status','sync-status-success','sync-status-danger','sync-timeout'];
const browser=await chromium.launch({headless:true}),results=[];
await writeFile(join(out,'metadata.json'),JSON.stringify({reference,browser:browser.version(),scenes,limitations:'Offline synthetic data only; import promise simulated, no actual image/sync/power operations. Local states include dialogs unreachable on E; anchors without href receive fixture-only tabindex=-1 for CSS focus measurement, original keyboard reachability unchanged.'},null,2));
try{
for(const scene of scenes.filter(s=>!process.env.C9_ONLY||process.env.C9_ONLY.split(',').includes(s)))for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
 const pages=[];
 for(const variant of ['before','after']){
 const p=await browser.newPage({viewport:{width,height}});pages.push(p);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*',async r=>{
 const url=new URL(r.request().url()),font=url.pathname.match(/^\/assets\/fonts\/([a-zA-Z0-9_.-]+)$/);
 if(url.href==='https://fixture.invalid/')return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body class="customized global-color-red"><main id="fixture" style="padding:20px"></main></body></html>'});
 if(font)return r.fulfill({body:await readFile(join(root,'vendor/fonts',font[1]))});
 if(url.pathname.startsWith('/api/lmn/linbo4/icons/'))return r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect x="2" y="2" width="28" height="28" fill="#233c4c"/></svg>'});
 return r.abort();});await p.goto('https://fixture.invalid/');
 await p.addStyleTag({content:css[variant]});await p.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}'});
 await p.evaluate(scene=>{window.fixtureScene=scene;window.requests=[];},scene);await p.addScriptTag({type:'module',content:bundles[variant]});await p.waitForFunction(()=>window.fixture?.ready);
 if(['image-reg','image-postsync','image-prestart','image-copy'].includes(scene))await p.locator('[data-tab="'+(scene==='image-copy'?'reg':scene.slice(6))+'"]').click();
 if(scene==='image-copy')await p.locator('[data-image-copy] button:visible').click();
 if(scene==='import-hidden')await p.evaluate(()=>window.fixtureRefs.state.logVisible=false);
 if(scene==='sync-second')await p.locator('[role=tab]').nth(1).click();
 if(scene==='sync-wol'||scene==='sync-timeout')await p.getByRole('button',{name:'Wake on lan'}).first().click();
 if(scene==='sync-preview'){await p.getByRole('button',{name:'Sync',exact:true}).first().click();await p.locator('.tab-pane.active input[type=checkbox]').first().click();}
 await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(80);assert.deepEqual(errors,[],scene+' '+variant);
 // Measure CSS states without executing config/hardware operations on Space/mouse release.
 await p.evaluate(()=>{document.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();},true);document.addEventListener('keydown',e=>{if(e.code==='Space'&&e.target.tagName==='A')e.preventDefault();},true);});
 }
 const target=scene==='image-buttons'?'[data-action=save]':scene==='image-rename'?'[data-action=rename]':scene==='sync-buttons'?'button:has(.fa-lightbulb)':scene==='sync-timeout'?'button:has(.fa-clock)':scene.startsWith('sync-status')?'.tab-pane.active tbody a.btn':scene==='images-empty'||scene==='images-loading'||scene==='sync-loading'||scene==='sync-empty'?'[data-no-control]':scene==='image-copy'?'.dropdown-menu a:visible':scene.startsWith('image-')?'.nav-tabs a:visible':scene.startsWith('sync')?'.nav-tabs a:visible':scene.startsWith('import')?'.modal-footer a:visible':scene==='backups'?'[data-action="edit-backup"]':scene==='accept'?'[data-action="cancel"]':'[data-action="edit"]';
 const controls=await Promise.all(pages.map(p=>p.locator(target).count()));
 for(const state of controls.every(Boolean)?['normal','hover','focus','active','space']:['normal']){
 const shots=[],styles=[];
 for(let i=0;i<2;i++){
 const p=pages[i],variant=['before','after'][i],control=p.locator(target).first();await p.mouse.up();await p.keyboard.up(' ');await p.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});await p.mouse.move(width-1,height-1);
 if(state==='hover')await control.hover();
 if(state==='active'){await control.hover();await p.mouse.down();}
 if(state==='focus'||state==='space'){
 await control.evaluate(el=>{if(el.tagName==='A'&&!el.hasAttribute('href'))el.tabIndex=-1;el.focus();}); // Force keyboard modality for focus-visible.
 await p.keyboard.press('Shift');assert.ok(await control.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')));
 if(state==='space')await p.keyboard.down(' ');
 }
 await p.waitForTimeout(50);
 if(variant==='after'&&state==='normal'&&await p.locator('.c9-tabs .nav-link.active').count())assert.equal(await p.locator('.c9-tabs .nav-link.active').first().evaluate(el=>getComputedStyle(el).color),'rgb(35, 60, 76)','customized global-color-red retains original active tab');
 if(variant==='after'&&['focus','space'].includes(state)&&await control.evaluate(el=>el.classList.contains('nav-link')))assert.equal(await control.evaluate(el=>getComputedStyle(el).boxShadow),'none','new nav-link focus shadow reset');

 if(scene.startsWith('sync')&&width===390&&variant==='after'){
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'D06 no page overflow');
 assert.ok(await p.locator('.tab-pane.active .c9-command-row > .btn:visible').evaluateAll(els=>els.every(el=>{const r=el.getBoundingClientRect();return r.x>=0&&r.right<=innerWidth;})),'D06 every command fits horizontally');
 const table=p.locator('.tab-pane.active .c9-sync-table');
 if(await table.count())assert.ok(await table.evaluate(el=>{el.scrollLeft=el.scrollWidth;const reached=el.scrollWidth<=el.clientWidth||el.scrollLeft>0;el.scrollLeft=0;return reached;}),'D06 host table scrolls to its last columns');
 }

 if(scene==='sync'&&state==='normal'&&width===390)await p.screenshot({path:join(out,`D06-full-${variant}.png`),fullPage:true});
 shots.push(await p.screenshot({path:join(out,`${scene}-${state}-${width}-${variant}.png`)}));
 styles.push(await p.locator('.btn,input,select,textarea,td,.nav-tabs a,.modal-header,.modal-body,.modal-footer,.dropdown-menu:visible,.dropdown-menu a:visible,td span').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,border:s.border,shadow:s.boxShadow,padding:s.padding,margin:s.margin,display:s.display,float:s.cssFloat};})));
 }
 results.push({scene,state,width,equal:shots[0].equals(shots[1]),geometryEqual:JSON.stringify(styles[0])===JSON.stringify(styles[1]),before:styles[0],after:styles[1]});
 }
 for(const p of pages){assert.ok(await p.evaluate(()=>window.requests.every(r=>r.method==='get'||r.url==='/api/lmn/devices/import')));await p.evaluate(()=>window.fixture.dispose());await p.close();}
}
}finally{await browser.close();await writeFile(join(out,'results.json'),JSON.stringify(results,null,2));}
const unexpected=results.filter(r=>!r.equal&&!(r.scene.startsWith('sync')&&r.width===390));
console.log(JSON.stringify({pairs:results.length,exact:results.filter(r=>r.equal).length,unexpected:unexpected.map(({scene,state,width,geometryEqual})=>({scene,state,width,geometryEqual}))},null,2));
assert.equal(unexpected.length,0,'Visual differences require classification');
