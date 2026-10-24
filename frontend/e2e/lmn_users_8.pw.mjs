import { test, expect } from '@playwright/test';
import { settings } from './playwright.config.mjs';
import { rows } from './fixtures/users_7.mjs';
import { result } from './fixtures/users_3.mjs';
const vue=process.env.P124_UI==='vue';
const roles=[settings.roles[0],{name:'school-admin',login:'pgmadmin',pw:settings.roles[0].pw},settings.roles[1],{name:'student',login:'serdarje',pw:settings.roles[0].pw}];
const modal=p=>p.locator('.modal:visible').last();
const footer=(p,re)=>modal(p).locator('.modal-footer :is(button,a)').filter({hasText:re});
const clean=s=>{expect(s.blocked).toEqual([]);expect(s.errors).toEqual([]);};
test.afterEach(async({page})=>{await page.request.post('/api/core/logout');});
async function setup(p,context,role=roles[0]){
 const checkResult=result();checkResult.CHECK_RESULT.ERRORLIST=['p119-error'];
 const s={writes:[],gets:[],blocked:[],errors:[],fail:'',lists:{},uploads:[],finishes:[],imports:[],answer:['LOG','fixture-imported'],columns:Array.from({length:6},(_,i)=>({coloumn:i,data:['cell-'+i,'next-'+i]})),school:'school-x',checks:0,checkResult};
 p.on('pageerror',e=>{if(!(s.hadFailure&&s.fail==='/api/filesystem/finish-upload'&&e.message==='Object'))s.errors.push(e.message);});p.on('console',m=>{if(m.type()==='error'&&!/401.*\((Unauthorized|Unauthenticated)\)/.test(m.text())&&!(s.hadFailure&&/400|403|500|Possibly unhandled rejection/.test(m.text())))s.errors.push(m.text());});
 await context.route('**/api/**',r=>{const q=r.request(),path=new URL(q.url()).pathname;if(path.startsWith('/api/lmn/users/lists/')||path.startsWith('/api/filesystem/')||(!['GET','HEAD','OPTIONS'].includes(q.method())&&path.startsWith('/api/lmn/'))){s.blocked.push([q.method(),path]);return r.abort();}return r.continue();});
 await p.route('**/api/**',async r=>{
  const q=r.request(),url=new URL(q.url()),path=url.pathname,method=q.method();let data;
  if(path==='/api/filesystem/upload'){
   const form=method==='POST'?await new Response(q.postDataBuffer(),{headers:{'content-type':q.headers()['content-type']}}).formData():null;
   const params={...Object.fromEntries(url.searchParams),...Object.fromEntries(form?[...form.entries()].filter(([key])=>key!=='file'):[])};s.uploads.push({method,params,bytes:form?.get('file')?.size||0});
   if(s.fail===path&&method==='POST'){s.hadFailure=true;return r.fulfill({status:500,body:'fixture chunk error'});}
   return r.fulfill({status:method==='GET'?204:200,body:''});
  }else if(path==='/api/filesystem/finish-upload'){s.finishes.push(q.postDataJSON());if(s.holdFinish)await new Promise(resolve=>s.releaseFinish=resolve);data=[];
  }else if(path==='/api/lmn/users/lists/import'||path==='/api/lmn/users/lists/csv'){
   const payload=q.postDataJSON();s.imports.push([path,payload]);data=payload.action==='get'?structuredClone(s.columns):s.answer;
  }else if(path==='/api/lmn/activeschool')data=s.school;
  else if(path==='/api/lmn/users/schoolconf')data={'userfile.teachers.csv':{SURNAME_CHARS:0,FIRSTNAME_CHARS:0}};
  else if(/^\/api\/lmn\/users\/lists\/(students|parents|staff|teachers|extrastudents|extraclasses)$/.test(path)){
   const kind=path.split('/').at(-1);if(method==='GET'){s.gets.push(path+url.search);data=s.lists[kind]||rows();}else{s.writes.push([method,path+url.search,q.postDataJSON()]);data={};}
  }else if(path==='/api/lmn/users/lists/check'){s.checks++;data=s.checkResult;}
  else if(path==='/api/lmn/users/lists/apply'){s.writes.push([method,path,q.postDataJSON()]);data={};}
  else if(path.startsWith('/api/lmn/log/tmp/'))return r.fulfill({body:'p123 synthetic log\n'});
  else if(path.startsWith('/api/filesystem/read/')){s.gets.push(path+url.search);return r.fulfill({body:path.includes('.bak.')?'p123-backup':'p123-csv'});}
  else if(path.startsWith('/api/filesystem/write/')){s.writes.push([method,path+url.search,q.postData()]);data={};}
  else if(path.startsWith('/api/filesystem/list/')){s.gets.push(path);data={items:[{name:'.school-x.students.csv.bak.1700000000'},{name:'.school-x.undefined.csv.bak.1700000000'}]};}
  else if(path==='/api/lmn/diff'){s.writes.push([method,path,q.postDataJSON()]);data=['-csv','+backup'];}
  else if(path==='/api/lmn/remove-file'){s.writes.push([method,path,q.postDataJSON()]);data={};}
  else return r.fallback();
  if(s.fail===path&&(!s.failAction||q.postDataJSON()?.action===s.failAction)){s.hadFailure=true;return r.fulfill({status:s.status||400,json:{message:'p123 fixture failure'}});}return r.fulfill({json:data});
 });
 await p.goto('/');await p.locator('input[ng\\:model=username]').fill(role.login);await p.locator('input[type=password][ng\\:model=password]').fill(role.pw);await p.locator('a[ng\\:click^=login]').click();await p.waitForURL('**/view/**');await p.waitForLoadState('networkidle');
 const catalog=await(await p.request.get('/resources/all.locale.js?lang=de')).json();expect(catalog['Save']).toBe('Speichern');s.catalog=catalog;
 await p.evaluate(c=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>{const g=i.get('gettextCatalog');g.setStrings('de',c);g.setCurrentLanguage('de');});},catalog);return s;
}

async function navigate(p){
 await p.evaluate(()=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/users/listmanagement'));});await p.waitForLoadState('networkidle');
 if(vue)await expect(p.locator('lmn-vue-mount')).toHaveAttribute('entry','LmnVue_lmn_users');
}
async function open(p,kind='students'){
 const labels={students:'Schüler',teachers:'Lehrer',parents:'Eltern',staff:'Mitarbeitende'};
 await p.locator('.nav-tabs:visible a').filter({hasText:new RegExp('^'+labels[kind]+'$')}).click();await p.waitForLoadState('networkidle');
 await p.locator('floating-toolbar:visible button').filter({hasText:/^CSV/}).click();
 await p.locator('floating-toolbar:visible a').filter({hasText:/^CSV laden$/}).click();
 await expect(modal(p)).toContainText('CSV laden');
}
async function upload(p,check=true,size=20){
 const inputs=modal(p).locator('input[type=file]');await expect(inputs).toHaveCount(2);
 await inputs.nth(check?1:0).setInputFiles({name:'p124.csv',mimeType:'text/csv',buffer:Buffer.alloc(size,65)});
}
function mapping(p){return vue?modal(p).locator('[data-column-title]'):modal(p).locator('[sv\\:element]');}
for(const role of roles)test(role.name+': sidebar and separated import rights (fixtures only)',async({page:p,context})=>{
 const s=await setup(p,context,role);const admin=['global-admin','school-admin'].includes(role.name);
 await expect(p.locator('a[href="/view/lmn/users/listmanagement/"]:visible')).toHaveCount(admin?1:0);
 // Real identity ACL snapshot, no import endpoint is sent to the backend (even get writes).
 const acl=await p.evaluate(()=>angular.element(document).injector().get('identity').profile.permissions);
 expect(acl).toBeDefined();
 for(const [right,payload] of [['lm:users:students:read',{action:'get',path:'/tmp/p124.csv',userlist:'students.csv'}],['lm:users:students:write',{action:'save',data:s.columns,userlist:'students.csv'}],['lm:users:teachers:write',{action:'save',data:s.columns,userlist:'teachers.csv'}],['lm:users:passwords',{tmp_path:'/tmp/p124.csv',userlist:'students.csv'}]]){
  const path=payload.tmp_path?'/api/lmn/users/lists/csv':'/api/lmn/users/lists/import';
  await p.route('**'+path,r=>r.fulfill({status:!!acl[right]?200:403,json:!!acl[right]?['LOG','fixture']: {message:'fixture denied'}}));
  const status=await p.evaluate(async({path,payload})=>(await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})).status,{path,payload});
  expect(status).toBe(!!acl[right]?200:403);
 }
 // Fixture 403 console lines are browser diagnostics, not application exceptions.
 expect(s.blocked).toEqual([]);
});
test('close without file does nothing',async({page:p,context})=>{const s=await setup(p,context);await navigate(p);await open(p);await footer(p,/^Schließen$/).click();expect(s.uploads).toEqual([]);expect(s.imports).toEqual([]);clean(s);});
test('single-file Flow chunks, tmp finish, direct LOG reload',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await open(p);const count=s.gets.length;await upload(p,false,2*1024*1024+123);
 await expect.poll(()=>s.imports.length).toBe(1);await expect.poll(()=>s.gets.length).toBe(count+1);
 const posts=s.uploads.filter(x=>x.method==='POST');expect(posts).toHaveLength(2);
 expect(posts.map(x=>+x.params.flowChunkSize)).toEqual([1048576,1048576]);expect(posts.map(x=>+x.params.flowCurrentChunkSize).sort((a,b)=>a-b)).toEqual([1048576,1048699]);expect(posts.map(x=>x.bytes).sort((a,b)=>a-b)).toEqual([1048576,1048699]);
 expect(posts.map(x=>+x.params.flowChunkNumber).sort()).toEqual([1,2]);expect(posts.every(x=>+x.params.flowTotalChunks===2&&x.params.flowFilename==='p124.csv'&&+x.params.flowTotalSize===2097275)).toBe(true);
 expect(s.finishes).toEqual([[{id:posts[0].params.flowIdentifier,path:'/tmp/',name:'p124.csv'}]]);
 expect(s.imports).toEqual([['/api/lmn/users/lists/csv',{tmp_path:'/tmp/p124.csv',userlist:'students.csv'}]]);await expect(p.getByText(s.catalog.Uploaded,{exact:true})).toBeVisible();clean(s);
});
for(const kind of ['students','teachers'])test(kind+': check columns, custom, unused, reorder, save LOG',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await open(p,kind);const before=s.gets.length;await upload(p);
 await expect(modal(p)).toContainText('Sortierung akzeptieren');expect(s.imports[0]).toEqual(['/api/lmn/users/lists/import',{action:'get',path:'/tmp/p124.csv',userlist:kind+'.csv'}]);
 await expect(mapping(p)).toHaveCount(6);const custom=vue?modal(p).locator('input[type=checkbox]'):modal(p).locator('[checkbox]:visible');await custom.click();await expect(mapping(p)).toHaveCount(7);
 // Use actual drag gesture on the column headers; the CSV samples stay in place.
 const a=mapping(p).nth(0),b=mapping(p).nth(1);if(vue)await a.dragTo(b);else {const x=await a.boundingBox(),y=await b.boundingBox();await p.mouse.move(x.x+x.width/2,x.y+x.height/2);await p.mouse.down();await p.waitForTimeout(250);await p.mouse.move(x.x+x.width/2+12,x.y+x.height/2,{steps:4});await p.mouse.move(y.x+y.width-3,y.y+y.height/2,{steps:15});await p.mouse.up();}
 await expect(mapping(p).first()).toHaveText(s.catalog[kind==='students'?'lastname':'firstname']);
 await footer(p,/^Sortierung akzeptieren$/).click();await expect.poll(()=>s.imports.length).toBe(2);await expect.poll(()=>s.gets.length).toBe(before+1);
 const data=s.imports[1][1].data;expect(data.map(c=>c.coloumn)).toEqual(kind==='students'?['lastname','class','firstname','birthday','id',undefined]:['firstname','lastname','birthday','login','password',undefined]);
 expect(s.imports[1][1]).toEqual({action:'save',data:s.columns.map((c,i)=>({...c,...(data[i].coloumn===undefined?{coloumn:undefined}:{coloumn:data[i].coloumn})})),userlist:kind+'.csv'});clean(s);
});
test('sorting abort never saves; custom toggles back to not-used',async({page:p,context})=>{
 const s=await setup(p,context);await navigate(p);await open(p);await upload(p);await expect(mapping(p)).toHaveCount(6);const custom=vue?modal(p).locator('input[type=checkbox]'):modal(p).locator('[checkbox]:visible');await custom.click();await custom.click();await expect(mapping(p)).toHaveCount(6);await footer(p,/^Abbrechen$/).click();expect(s.imports).toHaveLength(1);clean(s);
});
for(const direct of [true,false])test((direct?'direct':'mapped')+' ERROR does not reload',async({page:p,context})=>{
 const s=await setup(p,context);s.answer=['ERROR','p124 fixture ERROR'];await navigate(p);await open(p);const before=s.gets.length;await upload(p,!direct);if(!direct){await expect(mapping(p)).toHaveCount(6);await footer(p,/^Sortierung akzeptieren$/).click();}await expect(p.getByText('p124 fixture ERROR',{exact:true})).toBeVisible();expect(s.gets.length).toBe(before);clean(s);
});
for(const fail of ['/api/lmn/users/lists/import','/api/lmn/users/lists/csv','/api/filesystem/finish-upload'])test('failed '+fail+' stops without reload',async({page:p,context})=>{
 const s=await setup(p,context);s.fail=fail;await navigate(p);await open(p);const before=s.gets.length;await upload(p,fail.endsWith('import'));await expect.poll(()=>s.hadFailure).toBe(true);await p.waitForLoadState('networkidle');expect(s.gets.length).toBe(before);expect(s.imports.filter(([,x])=>x.action==='save')).toEqual([]);clean(s);
});

test('progress title lives through finish, no messagebox extension',async({page:p,context})=>{
 const s=await setup(p,context);s.holdFinish=true;await navigate(p);await open(p);await upload(p,false);
 await expect.poll(()=>s.finishes.length).toBe(1);await expect(modal(p)).toContainText(vue?'Uploading: 100%':'Uploading: NaN%');s.releaseFinish();await expect.poll(()=>s.imports.length).toBe(1);clean(s);
});
test('permanent chunk failure still completes finish/import like legacy Flow',async({page:p,context})=>{
 const s=await setup(p,context);s.fail='/api/filesystem/upload';await navigate(p);await open(p);const before=s.gets.length;await upload(p,false);await expect.poll(()=>s.hadFailure).toBe(true);await p.waitForLoadState('networkidle');expect(s.finishes).toHaveLength(1);expect(s.imports).toHaveLength(1);expect(s.gets.length).toBe(before+1);if(vue){await expect(modal(p)).toContainText('Serverfehler');await expect(modal(p)).toContainText('/api/filesystem/upload');await footer(p,/^Schließen$/).click();}await expect(p.locator('.modal:visible')).toHaveCount(0);clean(s);
});
for(const [right,kind,action] of [['students:read','students','get'],['students:write','students','save'],['teachers:write','teachers','save'],['passwords','students','direct']])test('independent import permission '+right+' denied by fixture',async({page:p,context})=>{
 const s=await setup(p,context);s.fail=action==='direct'?'/api/lmn/users/lists/csv':'/api/lmn/users/lists/import';s.failAction=action==='direct'?undefined:action;s.status=403;await navigate(p);await open(p,kind);const before=s.gets.length;await upload(p,action!=='direct');if(action==='save'){await expect(mapping(p)).toHaveCount(6);await footer(p,/^Sortierung akzeptieren$/).click();}await expect.poll(()=>s.hadFailure).toBe(true);await p.waitForLoadState('networkidle');expect(s.gets.length).toBe(before);expect(s.imports.map(([,r])=>r.action)).toEqual(action==='direct'?[undefined]:action==='get'?['get']:['get','save']);clean(s);
});
test('all ten existing user routes remain reachable with synthetic read fixtures',async({page:p,context})=>{
 const s=await setup(p,context);await p.route('**/api/lmn/sophomorixUsers/**',r=>r.request().method()==='GET'?r.fulfill({json:[]}):r.fallback());await p.route('**/api/lmn/users/classes',r=>r.fulfill({json:[]}));await p.route('**/api/lmn/schoolsettings/latex-templates',r=>r.fulfill({json:[[],[]]}));
 for(const view of ['students','teachers','parents','staff','extra-students','extra-courses','print-passwords','globaladmins','schooladmins','listmanagement']){
  await p.evaluate(view=>{const i=angular.element(document).injector();i.get('$rootScope').$apply(()=>i.get('$location').path('/view/lmn/users/'+view));},view);await p.waitForLoadState('networkidle');await expect.poll(()=>p.evaluate(()=>angular.element(document).injector().get('$route').current.templateUrl)).toBe('/lmn_users:resources/partial/'+view+'.html');await expect(p.locator('[ng-view],[ng\\:view]')).not.toBeEmpty();
 }
 clean(s);
});
