import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { mount, flushPromises } from '@vue/test-utils';
import { buildStyles } from './static-assets.mjs';
import { createMockAj } from './src/adapter/mock.mjs';
import GroupsTab from './src/plugins/lmn_linbo4/GroupsTab.vue';
import ConfigDialog from './src/plugins/lmn_linbo4/ConfigDialog.vue';
import PartitionDialog from './src/plugins/lmn_linbo4/PartitionDialog.vue';
import { editorConfig, editorVDI } from './e2e/fixtures/linbo4-editor.mjs';
const wrappers=[];
afterEach(()=>{for(const w of wrappers)w.unmount();wrappers.length=0;});
function render(component,props){const w=mount(component,{props,global:{provide:{aj:createMockAj({http:async()=>({data:[]})})}}});wrappers.push(w);return w;}
it('C8 replaces legacy structure and dynamic variants in the five core components',()=>{
 for(const name of ['LinboPage','GroupsTab','ConfigDialog','PartitionDialog','ScriptEditor']){
 const source=readFileSync(`src/plugins/lmn_linbo4/${name}.vue`,'utf8');
 expect(source).not.toMatch(/\b(?:panel(?:-default|-heading|-body)?|form-group|btn-default|pull-right|label-info|label-default|dropdown-menu-right|btn-block)\b/);
 expect(source).not.toMatch(/\{ open:/);
 }
});
it('C8 group badges and Vue dropdown show state retain selection and Escape behavior',async()=>{
 const w=render(GroupsTab,{configs:[{file:'start.conf.fixture',images:['linux.qcow2','legacy.cloop']}],examples:['fixture.conf']});
 expect(w.findAll('.badge').map(n=>n.classes().filter(c=>c.startsWith('bg-'))[0])).toEqual(['bg-info','bg-secondary']);
 await w.get('[data-action="create"]').trigger('click');expect(w.get('.dropdown-menu').classes()).toContain('show');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await flushPromises();expect(w.get('.dropdown-menu').classes()).not.toContain('show');
 await w.get('[data-action="create"]').trigger('click');await w.get('[data-example="fixture.conf"]').trigger('click');
 expect(w.emitted('create-config')).toEqual([['fixture.conf']]);expect(w.get('.dropdown-menu').classes()).not.toContain('show');
});
it('C8 nested tabs put active on links and retain conditional VDI cards and partition colors',async()=>{
 const w=render(ConfigDialog,{config:editorConfig(),vdiconfig:editorVDI()});await flushPromises();
 expect(w.findAll('.nav-item.active')).toHaveLength(0);expect(w.get('.nav-link.active').attributes('data-tab')).toBe('general');
 await w.get('[data-tab="vdi"]').trigger('click');expect(w.get('.nav-link.active').attributes('data-tab')).toBe('vdi');
 expect(w.findAll('.card.c8-card')).toHaveLength(3);
 await w.get('[data-tab="partitions"]').trigger('click');
 expect(w.get('[data-kind="EFI"]').classes()).toContain('c8-button');expect(w.get('[data-kind="Linux"]').classes()).toContain('btn-info');
 await w.get('[data-action="cancel"]').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);expect(w.emitted('close')).toBeUndefined();
});
it('C8 partition validation and cancellation retain the detached input contract',async()=>{
 const source=editorConfig(),w=render(PartitionDialog,{partition:source.partitions[1],os:source.os[0]});await flushPromises();
 expect(w.get('.nav-link.active').text()).toBe('Partition');
 const input=w.get('[data-model="partition.Label"]');await input.setValue('invalid label');
 expect(input.element.value).toBe('');expect(source.partitions[1].Label).toBe('Linux');
 await w.get('[data-action="cancel"]').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);expect(w.emitted('close')).toBeUndefined();
});
it('C8 built CSS retains neutral focus tokens, tab focus reset, cards and mobile menu limits',async()=>{
 const css=postcss.parse(await buildStyles(process.cwd()));
 const decl=selector=>{const out={};css.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(d=>out[d.prop]=d.value);});return out;};
 expect(decl('.btn.c8-button')['--bs-btn-focus-box-shadow']).toBe('none');
 expect(decl('.c8-tabs > .nav-item > .nav-link:focus-visible')['box-shadow']).toBe('none');
 expect(decl('.c8-field')['margin-bottom']).toBe('30px');
 expect(decl('.c8-card > .card-body').padding).toBe('15px');
 expect(decl('.dropup.c8-create-menu').position).toBe('static');
 expect(decl('.c8-create-menu > .dropdown-menu')['max-width']).toBe('calc(100vw - 40px)');
 let mobile=false;css.walkAtRules('media',r=>{if(r.params==='(max-width: 767px)'&&r.toString().includes('.c8-create-menu > .dropdown-menu'))mobile=true;});expect(mobile).toBe(true);
});
