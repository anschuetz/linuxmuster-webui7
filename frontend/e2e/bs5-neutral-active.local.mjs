// R1 diagnostic: first-child pointer/keyboard active palette, all neutral focus-token variants.
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import postcss from 'postcss';
import { chromium } from '@playwright/test';
import { buildStyles } from '../static-assets.mjs';
const output=process.argv[2];assert.ok(output);await mkdir(output,{recursive:true});
const css=await buildStyles(new URL('..',import.meta.url).pathname),root=postcss.parse(css),variants=new Set();
root.walkRules(r=>{if(r.nodes.some(d=>d.prop==='--bs-btn-focus-box-shadow'))for(const s of r.selectors){const m=s.match(/^\.btn\.([\w-]+)$/);if(m&&!m[1].includes('profile'))variants.add(m[1]);}});
const browser=await chromium.launch({headless:true}),results=[];
try{
 for(const variant of variants)for(const flat of [false,true])for(const state of ['pointer','keyboard']){
  const states=[];
  for(const classes of ['btn btn-default','btn btn-light '+variant]){
   const page=await browser.newPage();await page.route('**/*',r=>r.abort());await page.setContent('<!doctype html><body class="customized"><main><button class="'+classes+(flat?' btn-flat':'')+'">Synthetic</button></main></body>');await page.addStyleTag({content:css});
   const button=page.locator('button');
   if(state==='pointer'){await button.hover();await page.mouse.down();}else{await page.keyboard.press('Tab');await page.keyboard.down('Space');}
   await page.waitForTimeout(250);
   states.push(await button.evaluate(el=>{const s=getComputedStyle(el);return {active:el.matches(':active'),background:s.backgroundColor,color:s.color,border:s.borderColor,shadow:s.boxShadow};}));await page.close();
  }
  results.push({variant,flat,state,equal:JSON.stringify(states[0])===JSON.stringify(states[1]),before:states[0],after:states[1]});
 }
 await writeFile(join(output,'comparison.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({variants:[...variants],comparisons:results.length,differences:results.filter(x=>!x.equal).map(({variant,flat,state})=>({variant,flat,state}))}));
}finally{await browser.close();}
