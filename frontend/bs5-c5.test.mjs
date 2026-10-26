import { afterEach, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { mount, flushPromises } from '@vue/test-utils';
import { buildStyles } from './static-assets.mjs';
import { createMockAj } from './src/adapter/mock.mjs';
import ImportDialog from './src/plugins/lmn_wireguard/components/ImportDialog.vue';
let wrapper;
afterEach(() => wrapper?.unmount());
it('C5 removes legacy variants without changing custom selection or the grid breakpoint', () => {
    const shares = readFileSync('src/plugins/lmn_samba_shares/SambaShares.vue', 'utf8');
    const wireguard = readFileSync('src/plugins/lmn_wireguard/components/Wireguard.vue', 'utf8');
    const dialog = readFileSync('src/plugins/lmn_wireguard/components/ImportDialog.vue', 'utf8');
    for (const source of [shares, wireguard, dialog]) expect(source).not.toMatch(/\b(?:btn-default|pull-left|pull-right|progress-bar-warning)\b/);
    expect(shares).toContain('progress-bar bg-warning c5-progress');
    expect(shares).toContain('list-group-addon float-start');
    expect(shares).toContain(':class="{ active: item.selected }"');
    expect(shares).toContain("sidebar ? 'aj-theme-toolbar-main' : 'aj-theme-toolbar-full'");
    expect(wireguard).toContain('btn btn-danger float-end');
    expect(dialog).toContain('btn c5-button');
});
it('C5 import close retains cancellation and disabled controls with the neutral variant', async () => {
    wrapper = mount(ImportDialog, { props: { peers: [] }, global: { provide: { aj: createMockAj({ http: async () => ({ data: [] }) }) } } });
    await flushPromises();
    expect(wrapper.findAll('.btn-success').every(button => button.element.disabled)).toBe(true);
    await wrapper.get('.c5-button').trigger('click');
    expect(wrapper.emitted('close')).toEqual([[true]]);
});
it('C5 built CSS retains focus tokens, flat precedence and warning progress color', async () => {
    const css = postcss.parse(await buildStyles(process.cwd()));
    const declarations = selector => {
        const result = {};
        css.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(decl => { result[decl.prop] = decl.value; }); });
        return result;
    };
    expect(declarations('.btn.c5-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(declarations('.btn.c5-button:where(:not(.btn-flat))')['background-color']).toBe('#fff');
    expect(declarations('.c5-button:focus')['border-color']).toBe('#aeaeae');
    expect(declarations('.c5-button:active:focus')['background-color']).toBe('#d4d4d4');
    expect(declarations('.c5-button[disabled]:hover')['background-color']).toBe('#fff');
    expect(declarations('.progress-bar.c5-progress.bg-warning')['background-color']).toBe('#ffc107');
    expect(declarations('html body.customized smart-progress .progress .c5-progress.bg-warning')['background-color']).toBe('#ffab40');
});
