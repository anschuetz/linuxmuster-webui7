// C4 offline Vue/Chromium fixtures. Synthetic data only; no VM or remote requests.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const reference = '2ffbc6257';
const output = process.argv[2]; assert.ok(output, 'Pass log directory');
await mkdir(output, { recursive: true });
const previous = path => execFileSync('git', ['show', `${reference}:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const entry = `import {createApp,h} from 'vue';
import {createMockAj} from '${frontend}/src/adapter/mock.mjs';
import {createModalService} from '${frontend}/src/shell/modal.mjs';
import {createPresentation,ShellServices} from '${frontend}/src/shell/presentation.mjs';
import Quotas from '${frontend}/src/plugins/lmn_quotas/Quotas.vue';
import Apply from '${frontend}/src/plugins/lmn_quotas/ApplyDialog.vue';
import Groups from '${frontend}/src/plugins/lmn_groupmembership/Groupmembership.vue';
import Details from '${frontend}/src/plugins/lmn_groupmembership/Details.vue';
import Permissions from '${frontend}/src/plugins/lmn_permissions/components/Permissions.vue';
const scene=window.fixtureScene;
const defaults={QUOTA_DEFAULT_GLOBAL:100,QUOTA_DEFAULT_SCHOOL:200,CLOUDQUOTA_PERCENTAGE:50,MAILQUOTA_DEFAULT:300};
const quotas=[Object.fromEntries(['teacher','student','schooladministrator'].map(role=>[role,{list:[{login:'fixture',sn:'Synthetic',givenname:'User'}],fixture:{displayName:'Synthetic User',QUOTA:{...defaults,QUOTA_DEFAULT_GLOBAL:150}}}])),Object.fromEntries(['teacher','student','schooladministrator'].map(role=>['role.'+role,defaults]))];
const group=(name,type)=>({groupname:name,cn:name,type:type==='adminclass'?'schoolclass':type==='printer'?'printergroup':'project',sophomorixType:type,sophomorixMembers:['member'],sophomorixAdmins:['owner'],sophomorixMemberGroups:[],sophomorixAdminGroups:[],members:['member'],sophomorixJoinable:true,membership:false});
const person=(login,sn)=>({sAMAccountName:login,sn,givenName:'Test',sophomorixAdminClass:'5a',sophomorixRole:'teacher'});
const type=scene.includes('class')?'adminclass':scene.includes('printer')?'printer':'project';
const details={GROUP:{fixture:{...group('fixture',type),description:'Synthetic group',sophomorixJoinable:'TRUE',sophomorixHidden:'FALSE',sophomorixMailList:'FALSE',sophomorixCreationDate:'20260102030405.0Z'}},MEMBERS:{fixture:{member:person('member','Member'),owner:person('owner','Owner')}}};
const matrix=[{lmn_settings:{provider:'Linuxmuster.net',lmn:['lm:schoolsettings'],methods:{'/api/lmn/settings':['get','post','put','delete','patch','other'].map((method,index)=>({method,auth:true,api:true,...(index===0?{}:{permission_id:'lm:schoolsettings'}),doc:'Synthetic settings'}))}}},{'lm:schoolsettings':{name:'Settings',default:false,teacher:'false',globaladministrator:'true'},orphan:{name:'NO DESCRIPTION'}},{'/view/settings':{plugin:'lmn_settings',default:false,teacher:'true'},'/view/orphan':{plugin:'NOT IMPLEMENTED'}}];
const requests=[];
const aj=createMockAj({identity:{user:'global-admin',profile:{isAdmin:true,sophomorixRole:'globaladministrator'}},http:async request=>{
 requests.push(request);
 const {url,method}=request;
 if(url==='/api/lmn/permissions')return {data:matrix};
 if(url.endsWith('/quota/quotas')) {if(scene==='quota-loading')return new Promise(()=>{});if(scene==='quota-error')throw Error('Synthetic load error');return {data:quotas};}
 if(url.endsWith('/quota/groups')) return {data:Object.fromEntries(['adminclass','project'].map(t=>[t,{fixture:{QUOTA:Object.fromEntries(['linuxmuster-global','default-school','mailquota'].map(k=>[k,{value:0}]))}}]))};
 if(url.includes('/quota/check/')) {if(scene==='quota-check-error')throw Error('Synthetic check error');return {data:{directories:{'/home/fixture':{total:'3 MiB'}},total:'3 MiB'}};}
 if(url.includes('/groupmembership/groups/'))return {data:details};
 if(url.includes('/groupmembership/'))return {data:Array.from({length:9},(_,i)=>group('fixture-'+i,url.endsWith('schoolclasses')?'adminclass':url.endsWith('printers')?'printer':'project'))};
 if(url.includes('/ldap-search') || url.includes('/find/'))return {data:[{login:'synthetic',label:'Synthetic User',role:'teacher',sn:'Synthetic',givenName:'User'}]};
 if(url.endsWith('/quota/apply')) {if(scene==='apply-busy')return new Promise(()=>{});if(scene==='apply-error')throw {data:{message:'Synthetic apply error'}};return {data:[]};}
 if(url.includes('/log'))return {data:'Synthetic log'};
 throw Error('Unexpected local fixture request: '+method+' '+url);
}});
aj.modal=createModalService(()=>aj);
const presentation=createPresentation({http:aj.http,identity:aj.identity,navigate:()=>{},getAj:()=>aj});aj.messagebox=presentation.messagebox;
const component=scene.startsWith('quota')?Quotas:scene.startsWith('groups')?Groups:Permissions;
const dialog=scene.startsWith('details')||scene.startsWith('apply');
const app=createApp({render:()=>h('div',[dialog?null:h(component),h(ShellServices,{services:presentation})])});
app.provide('aj',aj);app.provide('smbclient',{refresh_krbcc:()=>new Promise(()=>{})});app.mount('#fixture');
if(dialog)aj.modal.open(scene.startsWith('apply')?Apply:Details,{groupType:type==='adminclass'?'schoolclass':type==='printer'?'printergroup':'project',groupName:'fixture'},{size:'lg'}).catch(()=>{});
window.fixture={ready:true,requests,dispose(){aj.modal.dispose();presentation.dispose();app.unmount();}};
`;
const bundles = {};
for (const name of ['before','after']) {
    const result = await build({ root:frontend, configFile:false,logLevel:'error',plugins:[{name:'fixture',enforce:'pre',
        resolveId(id){if(id==='fixture-entry')return '\0fixture-entry';},
        load(id){if(id==='\0fixture-entry')return entry;
            if(name==='before' && /\/src\/plugins\/lmn_(quotas|groupmembership|permissions)\//.test(id) && /\.(vue|mjs)$/.test(id) && !id.includes('?'))return previous('frontend/'+id.slice(frontend.length));}
    },vue()],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
    bundles[name]=result.output[0].code;
}
const scenes=['quotas','quota-students','quota-admins','quota-classes','quota-projects','quota-check','quota-checked','quota-check-error','quota-search','quota-loading','quota-error',
    'groups','groups-objects','groups-sort','details-project','details-class','details-printer','details-search','apply-busy','apply-done','apply-error','permissions','permissions-sidebar','permissions-orphan','permissions-scroll'];
const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1].split(','):null;
const browser=await chromium.launch({headless:true});
const results=[];
const selectors='.modal-dialog,.modal-header,.modal-body,.modal-footer,.form-group,.c4-permissions,.btn,button,input,pre,[role=progressbar],.card,.panel,.card-header,.panel-heading,.card-body,.panel-body,.badge,.label,.nav-tabs a,.dropdown-menu,.dropdown-menu a,.membership-item,table,.c4-table-scroll';
const snapshot=page=>page.locator(selectors.replace(',.c4-table-scroll','')).evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).map(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);
    return {tag:el.tagName,text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,lineHeight:s.lineHeight,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow,opacity:s.opacity,fontSize:s.fontSize,display:s.display,position:s.position,fontWeight:s.fontWeight,textAlign:s.textAlign,focusVisible:el.matches(':focus-visible'),active:el.matches(':active'),hover:el.matches(':hover'),transform:s.transform,outline:s.outline,backgroundImage:s.backgroundImage};
}));
try{
 for(const scene of scenes){
  if(only&&!only.includes(scene))continue;
  for(const [width,height]of [[1440,900],[768,1024],[390,844]]){
   if(process.argv.includes('--width')&&width!==Number(process.argv[process.argv.indexOf('--width')+1]))continue;
   const observations={};
   for(const name of ['before','after']){
    const page=await browser.newPage({viewport:{width,height},timezoneId:'UTC',locale:'en-GB'});
    page.setDefaultTimeout(5000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.abort());
    await page.setContent('<!doctype html><html><body class="customized"><main style="padding:20px"><div id="fixture"></div></main></body></html>');
    await page.addStyleTag({content:css[name]});
    await page.evaluate(scene=>window.fixtureScene=scene,scene);
    await page.addScriptTag({type:'module',content:bundles[name]});
    await page.waitForFunction(()=>window.fixture?.ready);
    // Freeze dropdown selection during style probes; payload/selection behavior is tested by the component suite.
    await page.evaluate(()=>document.addEventListener('mousedown',event=>{if(event.target.closest('.dropdown-menu')){event.preventDefault();event.stopPropagation();}},true));
    await page.waitForTimeout(100);
    const clickText=text=>page.locator('a,button').filter({hasText:new RegExp('^\\s*'+text+'\\s*$')}).first().click();
    if(scene==='quota-students')await clickText('Students');
    if(scene==='quota-admins')await clickText('Schooladmins');
    if(scene==='quota-classes')await clickText('Classes');
    if(scene==='quota-projects')await clickText('Projects');
    if(['quota-check','quota-checked','quota-check-error'].includes(scene))await clickText('Quota check');
    if(scene==='quota-search')await clickText('Search & add user');
    if(['quota-search','quota-checked','quota-check-error'].includes(scene)){
      const input=page.locator(scene==='quota-search'?'.modal input':'form input');await input.fill('syn');await page.waitForTimeout(30);
      if(scene!=='quota-search')await input.press('Enter');
    }
    if(scene==='groups-objects')await clickText('Objectsfilter');
    if(scene==='groups-sort')await clickText('Groupname');
    if(scene==='details-search'){await clickText('Add user or group');await page.locator('.group-details .modal input[type=text]').first().fill('syn');}
    if(scene==='permissions-sidebar')await clickText('Sidebar');
    if(scene==='permissions-orphan')await clickText('Orphan');
    if(scene==='permissions-scroll'&&name==='after'&&width===390){
      const scroll=page.locator('.c4-table-scroll').first();
      const position=await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;return {left:el.scrollLeft,client:el.clientWidth,scroll:el.scrollWidth};});
      assert.ok(position.left>0&&position.scroll>position.client,'D14 roles reachable by horizontal scroll');
    }
    await page.waitForTimeout(100);
    assert.deepEqual(errors,[],scene);
    // Style probes freeze closing/selection events after the real scene has opened.
    // Vue contract tests independently exercise clicks, selection, blur and payloads.
    await page.evaluate(scene=>{
      document.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
      if(scene==='details-search')document.addEventListener('blur',event=>event.stopImmediatePropagation(),true);
    },scene);
    const states={};
    async function record(key){
      await page.waitForTimeout(200);
      const stylesBefore=await snapshot(page);
      const shot=await page.screenshot({animations:'disabled',path:join(output,scene+'-'+width+'-'+key+'-'+name+'.png')});
      states[key]={stylesBefore,sha256:createHash('sha256').update(shot).digest('hex'),styles:await snapshot(page)};
    }
    if(scene!=='details-search')await page.evaluate(()=>document.activeElement?.blur());
    await page.mouse.move(width-1,height-1);await record('normal');
    // Every new nav link, neutral button, and dropdown item receives pointer + keyboard states.
    if(!process.argv.includes('--normal') && ['quotas','permissions','groups','groups-sort','quota-search','details-project','details-search','apply-done','apply-error'].includes(scene)){
      const topModal=page.locator('.modal').filter({visible:true}).last();
      const surface=await topModal.count()?topModal:page;
      const candidates=surface.locator(scene==='groups-sort'?'.dropdown-menu a':'.nav-tabs a,.btn,.dropdown-menu a').filter({visible:true});
      const count=await candidates.count();
      for(let i=0;i<count;i++){
        const el=candidates.nth(i);
        await el.hover();await record(i+'-hover');
        await page.mouse.move(width-1,height-1);
        // Tab establishes real :focus-visible; target may be an unfocusable legacy anchor.
        let focused=false;
        const keyboardTarget=await el.evaluate(e=>e.matches('button,a[href]')&&!e.closest('.group-details .dropdown-menu'));
        if(keyboardTarget){
        await page.evaluate(()=>document.activeElement?.blur());
        if(await el.evaluate(e=>!!e.closest('.nav-tabs'))){
          for(let j=0;j<60;j++){await page.keyboard.press('Tab');if(await el.evaluate(e=>e===document.activeElement)){focused=true;break;}}
        }else{
          // Search handles Tab as selection; set keyboard modality once, then focus the target.
          await page.keyboard.press('Tab');await el.focus();focused=await el.evaluate(e=>e===document.activeElement);
        }
        }
        if(focused){await record(i+'-focus');await page.keyboard.down(' ');await record(i+'-space');await page.evaluate(()=>document.activeElement?.blur());await page.keyboard.up(' ');}
        await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({left:0,top:0,behavior:'instant'});});
        await page.mouse.move(width-1,height-1);await el.hover();
        // Reboot enables smooth viewport scrolling; settle horizontal alignment immediately on the overflowing legacy grid.
        await el.evaluate(e=>{const r=e.getBoundingClientRect(),center=r.x+scrollX+r.width/2;window.scrollTo({left:center>innerWidth?center-innerWidth/2:0,top:scrollY,behavior:'instant'});});
        await el.evaluate(e=>e.focus({preventScroll:true}));
        const point=await el.boundingBox();const px=point.x+point.width/2,py=point.y+point.height/2;
        await page.mouse.move(px,py);await page.mouse.down();await page.waitForTimeout(150);
        // Keep the pointer inside the overlap of original and pressed bounds while layout settles.
        let activeProbe;
        for(let attempt=0;attempt<3;attempt++){
          const pressed=await el.evaluate(e=>e.getBoundingClientRect().toJSON());
          assert.ok(pressed.width>0&&pressed.height>0,'Pressed target remains visible');
          const activeX=(Math.max(point.x,pressed.x)+Math.min(point.x+point.width,pressed.right))/2;
          const activeY=(Math.max(point.y,pressed.y)+Math.min(point.y+point.height,pressed.bottom))/2;
          await page.mouse.move(activeX,activeY);await page.waitForTimeout(50);
          activeProbe=await el.evaluate((e,point)=>({active:e.matches(':active'),hover:e.matches(':hover'),scrollX,scrollY,rect:e.getBoundingClientRect().toJSON(),point,hit:document.elementFromPoint(point[0],point[1])?.outerHTML.slice(0,150)}),[activeX,activeY]);
          if(activeProbe.active&&activeProbe.hover)break;
        }
        assert.ok(activeProbe.active&&activeProbe.hover,JSON.stringify(activeProbe));
        await record(i+'-active');
        // Release away from the target to avoid state-changing clicks.
        await page.mouse.move(width-1,height-1);await page.mouse.up();await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo({left:0,top:0,behavior:'instant'});});
      }
    }
    await page.waitForTimeout(200);
    const mobile=await page.evaluate(()=>({viewport:innerWidth,tiles:[...document.querySelectorAll('.membership-item')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}),buttons:[...document.querySelectorAll('floating-toolbar .btn')].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};}),scrolls:[...document.querySelectorAll('.c4-table-scroll')].map(e=>({client:e.clientWidth,scroll:e.scrollWidth}))}));
    const requests=await page.evaluate(()=>window.fixture.requests);
    assert.ok(requests.every(r=>r.method==='get'||r.url.includes('/ldap-search')||r.url.includes('/find/')||(scene.startsWith('apply')&&r.url.endsWith('/quota/apply'))),'Style probes must not invoke mutations');
    if(name==='after'&&width===390){
      assert.ok([...mobile.tiles,...mobile.buttons].every(r=>r.x>=0&&r.right<=390),'D02/D07/D14 mobile controls must fit');
    }
    observations[name]={states,mobile,requests};
    await page.evaluate(()=>window.fixture.dispose());await page.close();
   }
   for(const key of Object.keys(observations.before.states)){
     const b=observations.before.states[key],a=observations.after.states[key];
     results.push({scene,width,state:key,equal:b.sha256===a?.sha256,geometryEqual:JSON.stringify(b.styles)===JSON.stringify(a?.styles),before:b.styles,after:a?.styles});
   }
   await writeFile(join(output,scene+'-'+width+'-metadata.json'),JSON.stringify(observations,null,2)+'\n');
  }
 }
}finally{await browser.close();}
await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2)+'\n');
await writeFile(join(output,'metadata.json'),JSON.stringify({reference,cssSha256:Object.fromEntries(Object.entries(css).map(([k,v])=>[k,createHash('sha256').update(v).digest('hex')]))},null,2)+'\n');
console.log(results.filter(r=>r.equal).length+'/'+results.length+' PNG pairs identical; '+results.filter(r=>r.geometryEqual).length+' identical style/geometry snapshots');
// Differences include explicitly intended mobile fixes. Classify comparison.json before handoff.
