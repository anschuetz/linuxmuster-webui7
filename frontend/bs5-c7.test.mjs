import { afterEach, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import postcss from 'postcss';
import { mount, flushPromises } from '@vue/test-utils';
import { buildStyles } from './static-assets.mjs';
import { createMockAj } from './src/adapter/mock.mjs';
import Docker from './src/plugins/lmn_docker/components/Docker.vue';
import Administration from './src/plugins/lmn_vdi_administration/Administration.vue';
import CreateSession from './src/plugins/lmn_websession/components/CreateSession.vue';
import GroupInfo from './src/plugins/lmn_vdi_administration/GroupInfo.vue';
import MasterInfo from './src/plugins/lmn_vdi_administration/MasterInfo.vue';
let wrapper;
afterEach(() => wrapper?.unmount());
const global = { provide: { aj: createMockAj({ http: async () => ({ data: [] }) }) } };
it('C7 removes BS3 panel/neutral/float structure and uses Vue-controlled dropdown visibility', () => {
    for (const plugin of ['websession', 'docker', 'vdi_dashboard', 'vdi_administration']) {
        const root = `src/plugins/lmn_${plugin}`;
        for (const file of readdirSync(root, { recursive: true }).filter(f => f.endsWith('.vue'))) {
            const source = readFileSync(`${root}/${file}`, 'utf8');
            expect(source, file).not.toMatch(/\b(?:panel(?:-info|-heading|-body)?|btn-default|pull-right|pull-left|label-\w+|progress-bar-\w+)\b/);
        }
    }
    const source = readFileSync('src/plugins/lmn_websession/components/CreateSession.vue', 'utf8');
    expect(source).toContain('dropdown-menu show');
    expect(source).not.toContain('display:block');
    expect(source).toContain('card c7-session-card');
});
it.each([Docker, Administration])('C7 tabs put active state on nav-link and preserve tab selection', async component => {
    wrapper = mount(component, { global });
    await flushPromises();
    expect(wrapper.findAll('.nav-item')).toHaveLength(2);
    const tabs = wrapper.findAll('.nav-link');
    expect(tabs[0].classes()).toContain('active');
    expect(tabs[1].classes()).not.toContain('active');
    await tabs[1].trigger('click'); await flushPromises();
    expect(tabs[1].classes()).toContain('active');
    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(tabs[0].classes()).not.toContain('active');
    expect(wrapper.findAll('.nav-item.active')).toHaveLength(0);
});
it.each([
    [CreateSession, {}, '[data-action="close"]'],
    [GroupInfo, { masterGroupData: {} }, '.c7-button'],
    [MasterInfo, { masterVM: '101', masterVMData: {} }, '.c7-button'],
])('C7 dialog neutral close retains cancel event', async (component, props, selector) => {
    wrapper = mount(component, { props, global });
    await wrapper.get(selector).trigger('click');
    expect(wrapper.emitted('cancel')).toEqual([[]]);
});
it('C7 session validation keeps the dialog open without adding a synthetic error state', async () => {
    wrapper = mount(CreateSession, { global });
    await wrapper.get('[data-action="create"]').trigger('click');
    expect(wrapper.emitted('cancel')).toBeUndefined();
    expect(wrapper.find('.is-invalid').exists()).toBe(false);
    expect(wrapper.get('.card-body .alert-info').text()).toContain('No users selected');
});
it('C7 built CSS keeps card geometry, neutral focus tokens and nav keyboard focus', async () => {
    const css = postcss.parse(await buildStyles(process.cwd()));
    const declarations = selector => {
        const result = {};
        css.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(decl => { result[decl.prop] = decl.value; }); });
        return result;
    };
    expect(declarations('.btn.c7-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(declarations('.btn.c7-button:where(:not(.btn-flat))')['background-color']).toBe('#fff');
    expect(declarations('.c7-button:focus')['border-color']).toBe('#aeaeae');
    expect(declarations('.c7-button:disabled')['background-color']).toBe('transparent');
    expect(declarations('.c7-button:disabled')['border-color']).toBe('currentColor');
    expect(declarations('.c7-button:active:focus')['background-color']).toBe('#d4d4d4');
    expect(declarations('.c7-tabs > .nav-item > .nav-link:focus-visible')['box-shadow']).toBe('none');
    expect(declarations('.c7-session-card > .card-body')['padding']).toBe('20px');
    expect(declarations('.c7-session-card > .card-header')['padding']).toBe('1px 15px');
});
