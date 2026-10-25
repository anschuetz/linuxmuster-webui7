import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../adapter/mock.mjs';
import FileDialog from './FileDialog.vue';
import FileEditorDialog from './FileEditorDialog.vue';
import FileBackupsDialog from './FileBackupsDialog.vue';
import FileDiffDialog from './FileDiffDialog.vue';
import PathSelector from './PathSelector.vue';
import LmLog from './LmLog.vue';
const wrappers = [];
const render = (component, props = {}, http = async () => ({ data: { items: [], parent: null } })) => {
    const wrapper = mount(component, { props, global: { provide: { aj: createMockAj({ http }) } } });
    wrappers.push(wrapper);
    return wrapper;
};
afterEach(() => wrappers.splice(0).forEach(wrapper => wrapper.unmount()));
it.each([FileDialog, FileEditorDialog, FileBackupsDialog, FileDiffDialog])('uses BS5 dialog titles and buttons while keeping cancellation', async component => {
    const wrapper = render(component, { path: '/fixture/example.csv', lines: [] });
    await flushPromises();
    expect(wrapper.find('.modal-header h4').classes()).toContain('modal-title');
    expect(wrapper.find('.btn-default').exists()).toBe(false);
    const cancel = wrapper.findAll('.modal-footer button').at(-1);
    expect(cancel.classes()).toContain('btn-light');
    await cancel.trigger('click');
    expect(wrapper.emitted('cancel')).toEqual([[]]);
    expect(wrapper.emitted('close')).toBeUndefined();
});
it('uses actionable BS5 file items, a card drop area and a BS5 path addon', async () => {
    const dialog = render(FileDialog, {}, async () => ({ data: { items: [{ name: 'a.txt', path: '/a.txt', isFile: true }] } }));
    await flushPromises();
    expect(dialog.get('[data-path="/a.txt"]').classes()).toContain('list-group-item-action');
    const editor = render(FileEditorDialog, { path: '/a.csv' }, async () => ({ data: 'csv' }));
    await flushPromises();
    expect(editor.get('[data-drop]').classes()).toContain('card');
    expect(editor.find('.well').exists()).toBe(false);
    const path = render(PathSelector, { modelValue: '/existing' });
    expect(path.find('.input-group-text [role=button]').exists()).toBe(true);
    expect(path.find('.input-group-addon').exists()).toBe(false);
    const log = render(LmLog, { path: '/fixture.log' });
    expect(log.find('.form-group').exists()).toBe(false);
    expect(log.find('input[type=checkbox]').exists()).toBe(true);
});
it('binds the migrated appearance to declarations in the built CSS', () => {
    const css = postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', 'utf8'));
    const declarations = selector => {
        const result = {};
        css.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(decl => { result[decl.prop] = decl.value; }); });
        return result;
    };
    expect(declarations('.btn.common-file-button')['background-color']).toBe('#fff');
    expect(declarations('.common-file-drop')['padding']).toBe('19px');
    expect(declarations('.input-group-text.common-path-addon')['display']).toBe('table-cell');
    expect(declarations('.progress-bar.common-file-progress')['background-color']).toBe('#ffc107');
});
