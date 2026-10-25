import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { mount, flushPromises } from '@vue/test-utils';
import { buildStyles } from './static-assets.mjs';
import { createMockAj } from './src/adapter/mock.mjs';
import ImageDialog from './src/plugins/lmn_linbo4/ImageDialog.vue';
import ImagesTab from './src/plugins/lmn_linbo4/ImagesTab.vue';
import AcceptDialog from './src/plugins/lmn_linbo4/AcceptDialog.vue';
import LinboSync from './src/plugins/lmn_linbo_sync/components/LinboSync.vue';
import { groups } from './e2e/fixtures/linboSync.mjs';
const wrappers=[];
afterEach(()=>{for(const w of wrappers)w.unmount();wrappers.length=0;});
function render(component,props={},http=async()=>({data:[]})) {const w=mount(component,{props,global:{provide:{aj:createMockAj({http})}}});wrappers.push(w);return w;}
it('C9 removes legacy classes from its eight components',()=>{
 for(const path of ['lmn_linbo4/ImagesTab','lmn_linbo4/ImageDialog','lmn_linbo4/ImageBackupsDialog','lmn_linbo4/ImportDialog','lmn_linbo4/AcceptDialog','lmn_linbo_sync/components/ActionButton','lmn_linbo_sync/components/LinboSync','lmn_linbo_sync/components/SyncGroup']) {
 const source=readFileSync(`src/plugins/${path}.vue`,'utf8');
 expect(source).not.toMatch(/\b(?:btn-default|pull-right|form-group|label-success)\b/);
 expect(source).not.toMatch(/\{open:/);
 }
});
it('C9 image tabs and dropdown retain active/show, copy and Escape states',async()=>{
 const w=render(ImageDialog,{image:{name:'fixture',desc:'original'},images:[{name:'source',reg:'  script\n'}]});await flushPromises();
 expect(w.findAll('.nav-item.active')).toHaveLength(0);expect(w.get('.nav-link.active').text()).toBe('General');
 await w.get('[data-tab="reg"]').trigger('click');expect(w.get('.nav-link.active').attributes('data-tab')).toBe('reg');
 await w.get('[data-image-copy] button').trigger('click');expect(w.get('.dropdown-menu').classes()).toContain('show');
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await flushPromises();expect(w.get('.dropdown-menu').classes()).not.toContain('show');
 await w.get('[data-image-copy] button').trigger('click');await w.get('[data-source="reg:source"]').trigger('click');
 expect(w.get('[data-model="image.reg"]').element.value).toBe('  script\n');expect(w.get('.dropdown-menu').classes()).not.toContain('show');
 await w.get('[data-action="cancel"]').trigger('click');expect(w.emitted('cancel')).toEqual([[]]);expect(w.emitted('close')).toBeUndefined();
});
it('C9 image errors, badges and accept cancellation retain their contract',async()=>{
 const w=render(ImagesTab,{images:[{name:'bad',error:true,used_in:['fixture']}]});
 expect(w.get('.badge.bg-success').text()).toBe('fixture');expect(w.find('[data-action="edit"]').exists()).toBe(false);
 const accept=render(AcceptDialog,{partition:'sda1',disk:{}});await accept.get('[data-action="cancel"]').trigger('click');
 expect(accept.emitted('cancel')).toEqual([[]]);expect(accept.emitted('close')).toBeUndefined();
});
it('C9 sync tabs and mobile wrappers retain active pane and command state',async()=>{
 const w=render(LinboSync,{},async({url})=>({data:url.endsWith('activeschool')?'fixture':groups()}));await flushPromises();
 expect(w.findAll('.nav-item.active')).toHaveLength(0);expect(w.get('.nav-link.active').text()).toBe('p52group');
 expect(w.findAll('.c9-sync-table')).toHaveLength(2);expect(w.findAll('.c9-command-row').length).toBeGreaterThan(0);
 await w.findAll('[role="tab"]')[1].trigger('click');expect(w.get('.nav-link.active').text()).toBe('second');expect(w.get('.tab-pane.active h1').text()).toBe('second');
});
it('C9 built CSS retains focus tokens, customized tabs, badges and mobile-only D06',async()=>{
 const css=postcss.parse(await buildStyles(process.cwd()));
 const decl=selector=>{const out={};css.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(d=>out[d.prop]=d.value);});return out;};
 expect(decl('.btn.c9-button')['--bs-btn-focus-box-shadow']).toBe('none');
 expect(decl('.c9-tabs > .nav-item > .nav-link:focus-visible')['box-shadow']).toBe('none');
 expect(decl('html body.customized .c9-tabs > .nav-item > .nav-link.active').color).toBe('#233c4c');
 expect(decl('.c9-label.bg-success')['--bs-success-rgb']).toBe('76, 175, 80');
 expect(decl('.c9-field')['margin-bottom']).toBe('30px');
 let mobile=false;css.walkAtRules('media',r=>{if(r.params==='(max-width: 767px)'&&r.toString().includes('.c9-command-row'))mobile=true;});expect(mobile).toBe(true);
 expect(decl('.c9-sync-table')['overflow-x']).toBe('auto');
 expect(css.toString()).not.toMatch(/body\.global-color-\w+ \.c9-tabs/);
});
