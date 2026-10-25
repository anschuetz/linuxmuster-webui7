import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { TaskSidebar, PluginsPage } from './task-components.mjs';
import { ShellNavigation } from './navigation-components.mjs';
import { Login } from './auth-components.mjs';
import PasswordChange from '../plugins/lmn_auth/PasswordChange.vue';
import { createNavigation } from './navigation.mjs';
const cleanups = [];
afterEach(() => cleanups.splice(0).reverse().forEach(fn => fn()));
function render(component, props) { const ui = mount(component, { props }); cleanups.push(() => ui.unmount()); return ui; }
it('resolves task progress and repository badges to BS5 while retaining Close and root blocking', async () => {
    const task = render(TaskSidebar, { aj: { tasks: { state: { tasks: [{ id: 1, name: 'Task', progress: { done: 1, total: 2, message: 'Half' } }, { id: 2, name: 'Wait' }] } } } });
    expect(task.find('.pull-left, .progress-bar-warning').exists()).toBe(false);
    expect(task.get('[role=progressbar]').classes()).toContain('bg-warning');
    expect(task.get('[role=progressbar]').attributes('aria-valuenow')).toBe('1');
    expect(task.get('.indeterminate').exists()).toBe(true);
    const plugin = { type: 'official', name: 'test', title: 'Test', version: '1', crash: { cls: 'Fixture', message: 'Synthetic' } };
    const state = reactive({ allowed: true, repoList: [plugin], installedPlugins: [plugin], selectedInstalledPlugin: plugin });
    const owner = { state, isAnythingUpgradeable: () => false, isUninstallable: () => false, getUpgrade: () => ({ version: '2' }), isInstalled: () => true };
    const ui = render(PluginsPage, { owner });
    expect(ui.find('.btn-default, .form-group, .label').exists()).toBe(false);
    expect(ui.findAll('.shell-rest-field')).toHaveLength(5);
    expect(ui.findAll('.badge.bg-info')).toHaveLength(2);
    expect(ui.get('.badge.bg-danger').text()).toBe('Loading error');
    expect(ui.get('[data-action=close]').classes()).toContain('btn-light');
    await ui.get('[data-action=close]').trigger('click'); expect(state.selectedInstalledPlugin).toBeNull();
    state.allowed = false; await ui.vm.$nextTick(); expect(ui.find('button').exists()).toBe(false);
});
it('retains navigation actions and Vue-owned dropdown state without BS3 button/float classes', async () => {
    const aj = { gettext: x => x, identity: { user: 'fixture', profile: {}, isSuperuser: true }, forceRestart: vi.fn() };
    const nav = createNavigation({ aj, storage: {}, navigate: vi.fn(), logout: vi.fn() }); cleanups.push(nav.dispose);
    const ui = render(ShellNavigation, { nav, aj, devMode: true });
    expect(ui.find('.btn-default, .pull-right, .navbar-btn').exists()).toBe(false);
    expect(ui.get('.profile-button').classes()).toContain('btn-light');
    await ui.get('.profile-button').trigger('click'); expect(ui.get('.dropdown-menu').classes()).toContain('show');
    expect(ui.get('.profile-button').attributes('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await ui.vm.$nextTick();
    expect(ui.get('.profile-button').attributes('aria-expanded')).toBe('false');
    await ui.get('[data-action=restart-panel]').trigger('click'); expect(aj.forceRestart).toHaveBeenCalledOnce();
});
it('preserves field spacing and neutral focus tokens in built CSS', () => {
    const css = postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', 'utf8'));
    function values(selector) { const out = {}; css.walkRules(rule => { if (rule.selector.split(',').map(s => s.trim()).includes(selector)) rule.walkDecls(d => { out[d.prop] = d.value; }); }); return out; }
    expect(values('.shell-rest-field')['margin-bottom']).toBe('30px');
    expect(values('.btn.shell-rest-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(values('.shell-rest-button:focus')['background-color']).toBe('#e6e6e6');
});

it('uses BS5 auth column names while preserving labels and password controls', () => {
    const ui = render(Login, { model: { state: { mode: 'normal' }, gettext: x => x, dispose() {} }, customization: {} });
    expect(ui.findAll('.auth-layout-column')).toHaveLength(3);
    expect(ui.find('.col-sm-4').exists()).toBe(false);
    const aj = { gettext: x => x, pageTitle: { set() {} } };
    const password = mount(PasswordChange, { global: { provide: { aj } } }); cleanups.push(() => password.unmount());
    expect(password.findAll('.auth-change-quarter.col-lg-3')).toHaveLength(2);
    expect(password.get('.auth-change-half.col-lg-6').exists()).toBe(true);
    expect(password.find('.pull-left, .col-md-3, .col-md-6').exists()).toBe(false);
});
