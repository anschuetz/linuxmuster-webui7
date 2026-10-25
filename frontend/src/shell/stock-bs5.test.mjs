import { afterEach, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { reactive } from 'vue';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import Dashboard from './Dashboard.vue';
import Widget from './Widget.vue';
import SessionList from './SessionList.vue';
import StockSettings from './StockSettings.vue';
import Field from './SettingsField.vue';
import { StaticPage } from './static-pages.mjs';
const wrappers = [];
afterEach(() => wrappers.splice(0).forEach(ui => ui.unmount()));
const aj = { gettext: x => x, identity: { isSuperuser: true } };
function render(component, props, adapter = aj) {
    const ui = mount(component, { props, global: { provide: { aj: adapter } } });
    wrappers.push(ui); return ui;
}
it('puts Vue-owned dashboard active state on BS5 nav links and retains masking anchors', async () => {
    const state = reactive({ ready: true, activeTabIndex: 0, availableWidgets: [], values: { clock: '12:34' }, sessions: {},
        userConfig: { dashboard: { tabs: [{ name: 'First', width: 1, widgetsLeft: [{ id: 'clock', typeId: 'datetime' }], widgetsRight: [] }, { name: 'Second', widgetsLeft: [], widgetsRight: [] }] } } });
    const ui = render(Dashboard, { model: { state, customization: { allowAdd: true }, dispose: vi.fn() } });
    expect(ui.get('li.nav-item > [data-tab="0"]').classes()).toContain('nav-link');
    expect(ui.get('[data-tab="0"]').classes()).toContain('active');
    expect(ui.get('li.nav-item').classes()).not.toContain('active');
    await ui.get('[data-tab="1"]').trigger('click');
    expect(ui.get('[data-tab="1"]').classes()).toContain('active');
    expect(ui.get('[data-tab="0"]').classes()).not.toContain('active');
    await ui.get('[data-tab="0"]').trigger('click');
    expect(ui.get('.widget-header').text()).toBe('Date Time');
    expect(ui.get('.widget-value').text()).toBe('12:34');
    expect(ui.get('[data-action="add-tab"]').classes()).toContain('btn-light');
});
it('resolves widget grid, warning and session status to BS5 classes', () => {
    for (const type of ['hostname', 'uptime', 'loadavg', 'cpu', 'memory', 'disk', 'datetime', 'sessions']) {
        const value = type === 'cpu' ? [1, 1] : ['memory', 'disk'].includes(type) ? { used: 99, total: 100 } : undefined;
        const ui = render(Widget, { widget: { typeId: type }, value, sessions: { test: { identity: 'synthetic', client_info: { address: '192.0.2.1' } } } });
        expect(ui.find('[class*="col-xs-"], .label, .pull-right').exists()).toBe(false);
        if (['cpu', 'memory', 'disk'].includes(type)) expect(ui.get('.badge.bg-danger').exists()).toBe(true);
        if (type === 'loadavg') expect(ui.findAll('.col-4')).toHaveLength(3);
    }
    const ui = render(SessionList, { model: { aj, state: { number: 1, sessions: { test: { identity: 'synthetic', timestamp: 1700000000, client_info: { address: '192.0.2.1' } } }, session_max_time: 3600 }, dispose: vi.fn() } });
    expect(ui.findAll('tbody tr')).toHaveLength(1);
    expect(ui.get('.badge.bg-info').text()).toBe('synthetic');
    expect(ui.get('.badge.bg-danger').text()).toBe('192.0.2.1');
});
it('keeps select updates, password masking and settings active tab selection', async () => {
    const field = render(Field, { modelValue: 'one', label: 'Choice', options: ['one', 'two'] });
    expect(field.get('select').classes()).toContain('form-select');
    expect(field.find('.form-group').exists()).toBe(false);
    await field.get('select').setValue('two');
    expect(field.emitted('update:modelValue')).toEqual([['two']]);
    expect(render(Field, { modelValue: 'synthetic', label: 'Password', type: 'password' }).get('input').attributes('type')).toBe('password');
    const state = reactive({ config: { email: { enable: false } }, tab: '2FA', tfaList: [] });
    const ui = render(StockSettings, { model: { state, start: vi.fn(), dispose: vi.fn(), getSmtpConfig: vi.fn() } });
    expect(ui.get('[data-tab="2FA"]').classes()).toContain('active');
    await ui.get('[data-tab="Smtp relay"]').trigger('click');
    expect(ui.get('[data-tab="Smtp relay"]').classes()).toContain('active');
    expect(ui.get('[data-tab="2FA"]').classes()).not.toContain('active');
});
it('preserves denied root access and error/static contexts without legacy buttons', () => {
    const denied = { ...aj, identity: { isSuperuser: false } };
    for (const component of [SessionList, StockSettings]) {
        const ui = render(component, { model: { aj: denied, state: {}, start: vi.fn(), dispose: vi.fn() } }, denied);
        expect(ui.get('.root-access-blocker').text()).toContain('Superuser access required');
        expect(ui.find('table, input, [data-action]').exists()).toBe(false);
    }
    const props = { prefix: '', route: { fullPath: '/missing' }, gettext: x => x };
    expect(render(StaticPage, { ...props, kind: 'configuration-error' }).get('[role=alert]').classes()).toContain('alert-danger');
    expect(render(StaticPage, props).get('.alert-danger').text()).toContain('/missing');
    for (const kind of ['ui-test', 'quotas-disabled']) expect(render(StaticPage, { ...props, kind }).find('.btn-default').exists()).toBe(false);
});
it('checks stock appearance in the built CSS', () => {
    const css = postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', 'utf8'));
    const declarations = selector => { const values = {}; css.walkRules(rule => { if (rule.selector.split(',').map(x => x.trim()).includes(selector)) rule.walkDecls(d => { values[d.prop] = d.value; }); }); return values; };
    expect(declarations('.btn.shell-stock-button')['--bs-btn-focus-box-shadow']).toBe('none');
    expect(declarations('.shell-stock-label.bg-danger')['--bs-danger-rgb']).toBe('244, 67, 54');
    expect(declarations('.shell-stock-select')['background-image']).toBe('none');
    expect(declarations('.shell-stock-field')['margin-bottom']).toBe('30px');
});
