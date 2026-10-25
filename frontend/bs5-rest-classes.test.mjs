// @vitest-environment node
import {beforeAll,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {parse} from '@vue/compiler-sfc';
import {baseParse,parserOptions} from '@vue/compiler-dom';
import {controlContractHash,templateElements} from './test-fixtures/bs5-rest-contracts.mjs';
import postcss from 'postcss';
import {buildStyles} from './static-assets.mjs';
const {cases,contracts}=JSON.parse(readFileSync('test-fixtures/bs5-rest-contracts.json','utf8'));
let css;
beforeAll(async()=>{css=postcss.parse(await buildStyles(process.cwd()));});
function declarations(selector){const result={};css.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(d=>result[d.prop]=d.value);});return result;}
it.each(cases)('$file: $old #$ordinal preserves control contracts and uses its built BS5 styling',test=>{
 const template=parse(readFileSync(test.file,'utf8')).descriptor.template.content;
 const hash=controlContractHash(template);
 expect(hash,'bindings, visibility, events, name/id/aria and data-action survive').toBe(contracts[test.file]);
 const nodes=templateElements(baseParse(template,parserOptions));
 const classes=n=>n.props.find(p=>p.type===6&&p.name==='class')?.value?.content.split(/\s+/)||[];
 expect(nodes.some(n=>classes(n).includes(test.old)),'obsolete class removed').toBe(false);
 const node=nodes.filter(n=>classes(n).includes(test.hook))[test.ordinal];
 expect(node?.tag).toBe(test.tag);expect(classes(node)).toContain(test.bs5);
 if(test.old==='caret'){
  expect(declarations('.aj-dropdown-marker').display).toBe('contents');
  expect(declarations('.dropdown-toggle.aj-dropdown-marker::after')).toMatchObject({'margin-left':'0','vertical-align':'middle','border-top':'4px dashed','border-right':'4px solid transparent','border-left':'4px solid transparent'});
  expect(declarations('.dropup .dropdown-toggle.aj-dropdown-marker::after')).toMatchObject({'border-top':'0','border-bottom':'4px dashed'});
 }else if(test.old==='checkbox'){
  expect(declarations('label.form-check.aj-native-check')).toMatchObject({'padding-left':'0','min-height':'0','margin-top':'10px','margin-bottom':'10px'});
  expect(declarations('label.form-check.aj-native-check + label.form-check.aj-native-check')['margin-top']).toBe('-5px');
  expect(declarations('.aj-native-check > input[type="checkbox"]')).toMatchObject({position:'absolute','margin-left':'-20px'});
 }else if(test.old==='checkbox-inline'){
  expect(declarations('label.form-check.aj-native-check-inline')).toMatchObject({display:'inline-block','padding-left':'20px','margin-right':'0','margin-bottom':'0'});
  expect(declarations('.aj-native-check-inline > input[type="checkbox"]')).toMatchObject({position:'absolute','margin-left':'-20px'});
 }else if(test.old==='btn-xs'){
  expect(declarations('.btn.btn-sm.aj-image-action-compact')).toMatchObject({padding:'1px 5px','font-size':'12px','line-height':'1.5'});
  expect(declarations('.btn.btn-sm').padding).toBe('5px 10px');
 }else if(test.old==='table-condensed'){
  expect(declarations('.table.table-sm.aj-table-compact > :not(caption) > * > *').padding).toBe('5px');
 }else{
  expect(declarations('.visually-hidden')).toMatchObject({width:'1px',height:'1px',clip:'rect(0, 0, 0, 0)'});
  expect(declarations('.visually-hidden:not(caption)').position).toBe('absolute');
 }
});
