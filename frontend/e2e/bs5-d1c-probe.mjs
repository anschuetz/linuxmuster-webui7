// Instrument only screenshots. A match proves reachability, not that a declaration wins the cascade.
import {chromium as engine} from '@playwright/test';
import {readFile,writeFile} from 'node:fs/promises';
const rules=JSON.parse(await readFile(new URL('./p175-rules.json',import.meta.url)));
const observations={browser:null,motion:'frozen identically on both sides; caret hidden',snapshots:{}};
export const chromium={async launch(options){
 const browser=await engine.launch(options);observations.browser=browser.version();
 const newPage=browser.newPage.bind(browser);
 browser.newPage=async(...args)=>{
  const page=await newPage(...args),shot=page.screenshot.bind(page),addStyle=page.addStyleTag.bind(page);
  page.addStyleTag=options=>addStyle(options.content?{...options,content:options.content+'\n*,*::before,*::after {animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}'}:options);
  page.screenshot=async(options={})=>{
   const hits=await page.evaluate(rules=>rules.flatMap(rule=>{
    if(!rule.media.every(query=>matchMedia(query).matches))return [];
    // Remove pseudo-elements only; dynamic :hover/:focus/:checked states remain real.
    const selector=rule.selector.replace(/::[\w-]+|:before\b|:after\b|:-ms-input-placeholder\b/g,'');
    try{const elements=[...document.querySelectorAll(selector)];
     return elements.length?[{id:rule.id,count:elements.length,sample:elements.slice(0,3).map(e=>({tag:e.tagName,classes:e.className,action:e.getAttribute('data-action')}))}]:[];
    }catch(error){return [{id:rule.id,error:error.message}];}
   }),rules);
   observations.snapshots[options.path||String(Object.keys(observations.snapshots).length)]=hits;
   await writeFile(process.env.P175_HITS,JSON.stringify(observations));
   return shot(options);
  };return page;
 };return browser;
}};
