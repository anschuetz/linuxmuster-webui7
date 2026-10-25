// Offline diagnostics: F46 customized tabs and C5 pointer/keyboard cascade.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
const output=process.argv[2];assert.ok(output,'Pass evidence directory');await mkdir(output,{recursive:true});
const before=execFileSync('git',['show','8162651c0:usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'],{cwd:new URL('..',import.meta.url),encoding:'utf8'}), tabs=postcss.parse(before), focus=postcss.parse(before), removed=[];
tabs.walkRules(rule=>{if(/body\.global-color-[\w-]+/.test(rule.selector)&&/tabs\s*>/.test(rule.selector)){removed.push(rule.selector);rule.remove();}});
focus.walkRules(rule=>{if(rule.selector==='.c5-button:focus-visible')rule.remove();});
const prefixes=[...new Set(removed.flatMap(s=>[...s.matchAll(/\.([\w-]*tabs)\s*>/g)].map(m=>m[1])))];
const colors=['red','bluegrey','purple','blue','green','deeporange','orange','teal'];
const browser=await chromium.launch({headless:true}),results=[];
function style(el){const s=getComputedStyle(el),r=el.getBoundingClientRect();return {style:Object.fromEntries([...s].map(k=>[k,s.getPropertyValue(k)])),rect:{x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height}};}
try{
 for(const width of [1440,768,390]) for(const state of ['normal','hover','keyboard','pressed']){
  const shots=[],states=[];
  for(const [name,css] of [['before',before],['after',tabs.toString()]]){
   const page=await browser.newPage({viewport:{width,height:900}});await page.route('**/*',r=>r.abort());
   await page.setContent('<!doctype html><body class="customized">'+colors.map(color=>'<section class="color-'+color+'">'+prefixes.map(prefix=>'<ul class="nav nav-tabs '+prefix+'"><li class="nav-item"><a href="#" class="nav-link active">Synthetic '+prefix+'</a></li></ul>').join('')+'</section>').join('')+'</body>');
   await page.addStyleTag({content:css+'\n* { transition: none !important; } html {scroll-behavior:auto!important;}'});
   // Apply each color to body in turn, as production does; collect every active tab.
   const collected=[];if(state==='keyboard')await page.keyboard.press('Tab');
   for(const color of colors){await page.evaluate(c=>{document.body.className='customized global-color-'+c;},color);
    const target=page.locator('.color-'+color+' a').first();
    if(state==='hover'||state==='pressed')await target.hover();
    if(state==='keyboard')await target.evaluate(el=>el.focus({preventScroll:true}));
    if(state==='pressed')await page.mouse.down();await page.evaluate(()=>window.scrollTo(0,0));
    collected.push(await page.locator('.color-'+color+' a').evaluateAll((els,source)=>els.map(el=>(0,eval)('('+source+')')(el)),style.toString()));
    if(state==='pressed')await page.mouse.up();await page.mouse.move(width-1,899);await target.blur();
   }
   states.push(collected);shots.push(await page.screenshot({path:join(output,`tabs-${width}-${state}-${name}.png`)}));await page.close();
  }
  results.push({kind:'tabs',width,state,identical:shots[0].equals(shots[1]),stylesEqual:JSON.stringify(states[0])===JSON.stringify(states[1]), beforeRects:states[0].map(items=>items.map(a=>a.rect)),afterRects:states[1].map(items=>items.map(a=>a.rect)), differences:states[0].flatMap((items,i)=>items.flatMap((a,j)=>Object.keys(a.style).filter(k=>a.style[k]!==states[1][i][j].style[k]).map(k=>({color:colors[i],prefix:prefixes[j],property:k,before:a.style[k],after:states[1][i][j].style[k]}))))});
 }
 const c5=[];
 for(const flat of [false,true])for(const state of ['normal','keyboard','hover-focus','pressed','disabled']){
  const states=[];
  for(const css of [before,focus.toString()]){
   const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent('<!doctype html><body class="customized"><button class="btn btn-light c5-button '+(flat?'btn-flat':'')+'">Synthetic</button></body>');await page.addStyleTag({content:css+'\n* { transition: none !important; } html {scroll-behavior:auto!important;}'});
   const button=page.locator('button');await page.keyboard.press('Tab');
   if(state==='normal')await button.blur();
   if(state==='hover-focus'||state==='pressed')await button.hover();
   if(state==='pressed')await page.mouse.down();
   if(state==='disabled')await button.evaluate(el=>{el.disabled=true;});
   states.push(await button.evaluate(style));await page.close();
  }
  c5.push({flat,state,equal:JSON.stringify(states[0])===JSON.stringify(states[1]),before:states[0],after:states[1]});
 }
 await writeFile(join(output,'cleanup-proof.json'),JSON.stringify({removed,prefixes,tabs:results,c5},null,2)+'\n');
 assert.ok(results.every(x=>x.identical&&x.stylesEqual),'F46 removal must preserve pixels and all computed properties');
 console.log(JSON.stringify({removedTabRules:removed.length,tabComparisons:results.length,c5Differences:c5.filter(x=>!x.equal).map(({flat,state})=>({flat,state}))}));
}finally{await browser.close();}
