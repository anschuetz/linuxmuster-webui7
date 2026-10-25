import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import Landingpage from './Landingpage.vue';
import CustomFields from './CustomFields.vue';
import WebappQR from './WebappQR.vue';
import Links from '../lmn_links/components/Links.vue';
import SchoolSwitcher from '../lmn_common/components/SchoolSwitcher.vue';
const wrappers = [];
const render = async (component, props = {}) => {
    const aj = createMockAj({ identity: {user:'fixture',profile:{givenName:'Synthetic',sn:'User',sophomorixRole:'teacher',memberOf:[],school_show:true}}, http: async ({url}) => ({data:
        url.endsWith('display_options') ? {show_webdav:true} : url.endsWith('customfields') ? [] : url.includes('/quota/') ? {low:{used:20,hard_limit:100},medium:{used:70,hard_limit:100},high:{used:90,hard_limit:100},error:{ERROR:true}} : url.endsWith('/links') ? {status:'success',data:{one:{title:'Synthetic',description:'Example',permissions:{teacher:true}}}} : url.endsWith('list-schools') ? [] : ''}) });
    const w = mount(component,{props,global:{provide:{aj}}}); wrappers.push(w); await flushPromises(); return w;
};
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
it.each([Landingpage, Links, SchoolSwitcher])('renders C1 cards with BS5 structure',async component => {
    const w=await render(component);
    expect(w.find('.card.c1-card > .card-header').exists()).toBe(true);
    expect(w.find('.card.c1-card > .card-body').exists()).toBe(true);
    expect(w.find('.panel, .panel-heading, .panel-body, .pull-right, .btn-default, .label').exists()).toBe(false);
});
it('uses explicit quota colors and retains progress values including errors', async () => {
    const w=await render(Landingpage);
    expect(w.findAll('[role=progressbar]').map(bar=>bar.classes().filter(c=>c.startsWith('bg-')))).toEqual([['bg-success'],['bg-warning'],['bg-danger'],['bg-danger']]);
    expect(w.findAll('[role=progressbar]').map(bar=>bar.attributes('aria-valuenow'))).toEqual(['20','70','90','0']);
    expect(w.get('.badge.c1-badge.bg-danger').exists()).toBe(true);
});
it.each([CustomFields,WebappQR])('keeps Close cancel and replaces neutral button/labels',async component=>{
    const w=await render(component,component===CustomFields ? {user:{},fields:[{attr:'sophomorixCustomMulti1',value:['Synthetic'],editable:false}]} : {});
    expect(w.find('.btn-default, .label, .pull-right').exists()).toBe(false);
    await w.get('.btn-light.c1-button').trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
});
it('uses built C1 CSS for card geometry, badges, neutral focus and mobile width',()=>{
    const css=postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css','utf8'));
    const declarations=selector=>{const out={};css.walkRules(r=>{if(r.selectors.includes(selector))r.walkDecls(d=>{out[d.prop]=d.value;});});return out;};
    expect(declarations('.btn.c1-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(declarations('.c1-card .c1-button')['border-color']).toBe('#eee');
    expect(declarations('.c1-card > .card-body').padding).toBe('20px');
    expect(declarations('.badge.c1-badge').padding).toBe('0.4em 0.6em 0.3em');
    const mobile=[];css.walkAtRules('media',r=>{if(r.params==='(max-width: 767px)')r.walkRules('.c1-landing > .c1-card',rule=>rule.walkDecls('width',d=>mobile.push(d.value)));});
    expect(mobile).toContain('calc(100% - 20px)');
});
