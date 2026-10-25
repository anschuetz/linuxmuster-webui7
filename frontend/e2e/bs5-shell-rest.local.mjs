// P174: actual task/plugin renderers, synthetic data, offline pixel and geometry comparison.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2]; assert.ok(output, 'Pass evidence directory'); await mkdir(output, { recursive: true });
const reference = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference') + 1] : '98f6abcaf';
const previous = path => execFileSync('git', ['show', `${reference}:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const entry = `import {createApp,h,reactive} from 'vue';import {PluginsPage,TaskSidebar} from 'fixture-components';import {ShellServices} from 'fixture-presentation';
const plugin={type:'official',title:'Synthetic plugin',name:'fixture',version:'1.0',path:'/synthetic',author:'Fixture',crash:{cls:'Fixture',message:'Synthetic error'}};
const state=reactive({allowed:window.scene!=='denied',repoList:[plugin],installedPlugins:[plugin],selectedInstalledPlugin:window.scene.startsWith('details')?plugin:null,version:'fixture'});
const owner={state,isAnythingUpgradeable:()=>false,isUninstallable:()=>false,getUpgrade:()=>({version:'2.0'}),isInstalled:()=>true};
const aj={tasks:{state:{tasks:[{id:1,name:'Synthetic task',progress:{done:1,total:2,message:'Half'}},{id:2,name:'Waiting',progress:{message:'Wait'}}]}}};
const services={state:{toasts:[],messages:[{id:1,title:'Synthetic confirmation',text:'Continue?',positive:'Yes',negative:'No'}]},gettext:x=>x,dispose(){},answerMessage(id,positive){window.answer={id,positive};}};
const app=createApp({render:()=>window.scene.startsWith('message')?h(ShellServices,{services}):window.scene==='tasks'?h(TaskSidebar,{aj}):h(PluginsPage,{owner})});app.mount('#fixture');window.fixture={state,dispose:()=>app.unmount()};`;
const bundles = {};
for (const name of ['before','after']) {
    const result = await build({root:frontend,configFile:false,logLevel:'error',plugins:[{name:'rest-fixture',resolveId(id){if(id==='fixture-presentation')return join(frontend,'src/shell/presentation.mjs');if(id==='./plugins.mjs')return join(frontend,'src/shell/plugins.mjs');if(id.startsWith('fixture-'))return '\0'+id;},load(id){if(id===join(frontend,'src/shell/presentation.mjs'))return name==='before'?previous('frontend/src/shell/presentation.mjs'):readFile(id,'utf8');if(id==='\0fixture-entry')return entry;if(id==='\0fixture-components')return name==='before'?previous('frontend/src/shell/task-components.mjs'):readFile(join(frontend,'src/shell/task-components.mjs'),'utf8');}}],build:{write:false,target:'esnext',minify:false,rolldownOptions:{input:'fixture-entry',output:{format:'es',inlineDynamicImports:true}}}});
    bundles[name]=result.output[0].code;
}
const browser=await chromium.launch({headless:true}), results=[];
try {
    for(const scene of ['plugins','details','details-focus','denied','tasks','message','message-focus']) for(const [width,height] of [[1440,900],[768,1024],[390,844]]) {
        const shots=[], states=[];
        for(const name of ['before','after']) {
            const page=await browser.newPage({viewport:{width,height}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
            await page.route('**/*',r=>r.abort()); await page.setContent('<!doctype html><body class="customized"><main id="fixture"></main></body>');
            await page.addStyleTag({content:css[name]});await page.evaluate(value=>{window.scene=value;},scene);
            await page.addScriptTag({type:'module',content:bundles[name]});await page.waitForFunction(()=>window.fixture);
            await page.waitForTimeout(350);await page.mouse.move(width-1,height-1);
            if(scene.endsWith('-focus')) {await page.keyboard.press('Tab');await page.locator(scene==='details-focus'?'[data-action=close]':'.positive').focus();await page.waitForTimeout(350);}
            shots.push(await page.screenshot({path:join(output,`${scene}-${width}-${name}.png`)}));
            states.push(await page.evaluate(()=>[...document.querySelectorAll('button,.modal-body > div,.progress-bar')].map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,marginBottom:s.marginBottom,color:s.color,background:s.backgroundColor,outline:s.outline,boxShadow:s.boxShadow};})));
            if(scene.startsWith('message')) {await page.locator('.negative').click();assert.deepEqual(await page.evaluate(()=>window.answer),{id:1,positive:false});}
            assert.deepEqual(errors,[]);await page.evaluate(()=>window.fixture.dispose());await page.close();
        }
        results.push({scene,width,identical:shots[0].equals(shots[1]),before:states[0],after:states[1]});
        await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2)+'\n');
    }
} finally {await browser.close();}
console.log(`${results.filter(r=>r.identical).length}/${results.length} PNG pairs identical`);
assert.ok(results.every(r=>r.identical),'Inspect comparison.json and PNG pairs');
