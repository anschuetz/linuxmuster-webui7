import {afterEach,expect,it} from 'vitest';
import {readFileSync,readdirSync} from 'node:fs';
import {mount,flushPromises} from '@vue/test-utils';
import postcss from 'postcss';
import {buildStyles} from './static-assets.mjs';
import {createMockAj} from './src/adapter/mock.mjs';
import FileDialog from './src/plugins/lmn_settings/FileDialog.vue';
import PathSelector from './src/plugins/lmn_settings/PathSelector.vue';
import SchoolSettings from './src/plugins/lmn_settings/SchoolSettings.vue';
import {responses} from './src/plugins/lmn_settings/fixtures.test-data.mjs';
let wrapper;
afterEach(()=>wrapper?.unmount());
it('C13 replaces school legacy structure and moves active onto the tab link',()=>{
 for(const file of readdirSync('src/plugins/lmn_settings').filter(f=>/^School.*\.vue$/.test(f))) expect(readFileSync('src/plugins/lmn_settings/'+file,'utf8')).not.toMatch(/\b(?:btn-default|pull-right|form-group)\b/);
 const source=readFileSync('src/plugins/lmn_settings/SchoolSettings.vue','utf8');
 expect(source).toContain('class="nav-item"');
 expect(source).toContain('class="nav-link" :class="{ active: s.activetab === index }"');
});
it('C13 switches tabs and preserves holiday validation and local edits without writes',async()=>{
 const data=responses(),requests=[];data['/api/lmn/holidays']=[{name:'Synthetic',start:'invalid',end:'01.01.2027'}];
 const aj=createMockAj({http:async r=>{requests.push(r);return {data:structuredClone(data[r.url]),status:200};}});
 wrapper=mount(SchoolSettings,{global:{provide:{aj}}});await flushPromises();
 expect(wrapper.findAll('.nav-link.active')).toHaveLength(1);
 await wrapper.findAll('.nav-link')[5].trigger('click');await flushPromises();
 expect(wrapper.findAll('.nav-link')[5].classes()).toContain('active');
 expect(wrapper.get('.tab-pane.active').findAll('.c13-date-invalid')).toHaveLength(1);
 const panel=wrapper.get('.tab-pane.active');await panel.get('button').trigger('click');
 expect(panel.findAll('input')).toHaveLength(0);
 await panel.findAll('button').at(-1).trigger('click');expect(panel.findAll('input')).toHaveLength(3);
 expect(requests.every(r=>r.method==='get')).toBe(true);
});
it('C13 built CSS keeps neutral focus, tab focus and contextual colors',async()=>{
 const css=postcss.parse(await buildStyles(process.cwd()));
 const declarations=selector=>{const result={};css.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(d=>{result[d.prop]=d.value;});});return result;};
 expect(declarations('.btn.c13-button')['--bs-btn-focus-box-shadow']).toBe('none');
 expect(declarations('.c13-tabs > .nav-item > .nav-link:focus-visible')['box-shadow']).toBe('none');
 expect(declarations('body.global-color-red .c13-tabs > .nav-item > .nav-link.active').color).toBeUndefined();
 expect(declarations('html body.customized .c13-tabs > .nav-item > .nav-link.active').color).toBe('#233c4c');
 expect(declarations('.c13-field')['margin-bottom']).toBe('30px');
 expect(declarations('.c13-date-invalid .form-control')['border-color']).toBe('red');
 expect(declarations('.c13-date-invalid .form-control:focus')['border-color']).toBe('#843534');
});

it('C13 plugin aliases retain dialog cancel and the selected path on cancellation',async()=>{
 const aj=createMockAj({http:async()=>({data:{parent:null,items:[]},status:200}),modal:{open:async()=>{throw new Error('cancel');}}});
 wrapper=mount(PathSelector,{props:{modelValue:'/Synthetic.txt'},global:{provide:{aj}}});await flushPromises();
 await wrapper.get('[role=button]').trigger('click');await flushPromises();
 expect(wrapper.get('input').element.value).toBe('/Synthetic.txt');
 expect(wrapper.emitted('update:modelValue')).toBeUndefined();wrapper.unmount();
 wrapper=mount(FileDialog,{global:{provide:{aj}}});await flushPromises();
 await wrapper.get('.modal-footer button').trigger('click');
 expect(wrapper.emitted('cancel')).toEqual([[]]);expect(wrapper.emitted('close')).toBeUndefined();
});
