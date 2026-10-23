import { expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import Permissions from './Permissions.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
import { mount as mountPermissions } from '../entry.mjs';
import { cycle, iconify, colorize, provider, logo, methodClass, matchesPlugin, matchesApi, matchesSidebar } from '../matrix.mjs';

const data = () => [{
    z_plugin: { provider: 'Netzint', lmn: [], methods: {} },
    lmn_settings: { provider: 'Linuxmuster.net', lmn: ['lm:schoolsettings'], methods: {
        '/api/lmn/settings': [ { permission_id: 'lm:schoolsettings', method: 'get', auth: true, api: true, doc: 'Settings' }, { method: 'post', page: true } ],
    } },
}, { 'lm:schoolsettings': { name: 'Settings', default: false, teacher: 'false', globaladministrator: 'true' }, orphan: { name: 'NO DESCRIPTION', default: false } }, {
    '/view/settings': { plugin: 'lmn_settings', default: false, teacher: 'true' },
    '/view/orphan': { plugin: 'NOT IMPLEMENTED', default: false },
}];
const render = (http) => mount(Permissions, { global: { provide: { aj: createMockAj({ identity: { user: 'admin' }, http }) } } });

it('preserves the legacy three-state cycle, including boolean defaults', () => {
    expect([cycle(undefined), cycle('false'), cycle('true'), cycle(false), cycle(true)]).toEqual(['false', 'true', undefined, undefined, undefined]);
    expect([undefined, false, 'false', true, 'true'].map(iconify)).toEqual(['question', 'times', 'times', 'check', 'check']);
    expect([undefined, false, 'true'].map(colorize)).toEqual(['', 'color:red', 'color:green']);
});
it('matches provider logos and method labels', () => {
    expect(['/api/lmn/x', '/api/ni/x', '/api/core'].map(provider)).toEqual(['Linuxmuster.net', 'Netzint', 'Ajenti']);
    expect(['Linuxmuster.net', 'Netzint', 'Ajenti'].map(logo)).toEqual(['logo-x.png', 'logo-ni.png', 'logo-ajenti.png']);
    expect(['get', 'post', 'put', 'delete', 'patch', 'url'].map(methodClass)).toEqual(['success', 'primary', 'info', 'danger', 'danger', 'default']);
});
it('filters names, URLs and explicit role strings like Angular', () => {
    const [,api,sidebar] = data();
    expect(matchesPlugin('lmn_settings', 'settings')).toBe(true);
    expect(matchesPlugin('lmn_settings', 'absent')).toBe(false);
    expect(matchesPlugin('lmn_settings', 'teacher')).toBe(true);
    expect(matchesApi({}, 'teacher', api)).toBe(false);
    expect(matchesApi({ permission_id: 'lm:schoolsettings' }, 'teacher', api)).toBe(false);
    expect(matchesApi({ permission_id: 'lm:schoolsettings' }, 'globaladministrator', api)).toBe(true);
    expect(matchesApi({}, '', api)).toBe(true);
    expect(matchesSidebar('/view/settings', 'teacher', sidebar)).toBe(true);
    expect(matchesSidebar('/view/orphan', 'teacher', sidebar)).toBe(false);
    expect(matchesSidebar('/view/settings', 'settings', sidebar)).toBe(true);
});
it('renders API and default columns, cycles values, exports the full payload without changing the response', async () => {
    const original = data();
    const snapshot = structuredClone(original);
    const http = vi.fn(async ({ method }) => ({ data: method === 'get' ? original : null }));
    const wrapper = render(http);
    await flushPromises();
    const table = wrapper.get('#table_lmn_settings');
    expect(table.findAll('th').map(x => x.text())).toEqual(['URL', 'GlobalAdmin', 'SchoolAdmin', 'Teacher', 'Student', 'Def.']);
    expect(table.text()).toContain('No authorization set for this method.');
    const cell = table.findAll('tr')[2].findAll('td')[3];
    await cell.trigger('click');
    expect(cell.find('.fa-check').exists()).toBe(true);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    const expected = structuredClone(snapshot);
    expected[1]['lm:schoolsettings'].teacher = 'true';
    expect(http).toHaveBeenLastCalledWith({ method: 'post', url: '/api/lmn/permissions/export', data: { api: expected[1], sidebar: expected[2], pluginDict: expected[0] }, cfg: undefined });
    expect(original).toEqual(snapshot);
    await table.findAll('th')[3].trigger('click');
    expect(wrapper.get('input').element.value).toBe('teacher');
    await table.findAll('th')[3].trigger('click');
    expect(wrapper.get('input').element.value).toBe('');
    await wrapper.get('input').setValue('absent');
    expect(wrapper.find('#table_lmn_settings').exists()).toBe(false);
    wrapper.unmount();
});
it('shows sidebar and orphan matrices and exports sidebar changes', async () => {
    const response = data();
    const http = vi.fn(async () => ({ data: response }));
    const wrapper = render(http);
    await flushPromises();
    await wrapper.findAll('.nav-tabs a')[1].trigger('click');
    await wrapper.get('input').setValue('settings');
    const cells = wrapper.findAll('table tr')[1].findAll('td');
    await cells[3].trigger('click'); // true -> undefined
    expect(cells[3].find('.fa-question').exists()).toBe(true);
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(http.mock.calls.at(-1)[0].data.sidebar['/view/settings'].teacher).toBeUndefined();
    await wrapper.findAll('.nav-tabs a')[2].trigger('click');
    expect(wrapper.findAll('.alert-warning').map(x => x.text()).join()).toContain('/view/orphan');
    expect(wrapper.text()).toContain('orphan');
    wrapper.unmount();
});
it('keeps empty and orphan success messages absent while loading and on rejection', async () => {
    let reject;
    const wrapper = render(() => new Promise((resolve, fail) => { reject = fail; }));
    await nextTick();
    await wrapper.findAll('.nav-tabs a')[2].trigger('click');
    expect(wrapper.find('.alert-success').exists()).toBe(false);
    reject(new Error('HTTP 500'));
    await flushPromises();
    expect(wrapper.find('.alert-success').exists()).toBe(false);
    expect(wrapper.find('table').exists()).toBe(false);
    wrapper.unmount();
});
it('handles rejected export through the adapter without an unhandled rejection', async () => {
    const wrapper = render(async ({ method }) => {
        if (method === 'post') throw new Error('HTTP 500');
        return { data: data() };
    });
    await flushPromises();
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(wrapper.find('#table_lmn_settings').exists()).toBe(true);
    wrapper.unmount();
});
it('waits for identity, translates pageTitle, shows loaded orphan success and unmounts', async () => {
    const set = vi.fn();
    const http = vi.fn(async () => ({ data: [{}, {}, {}] }));
    const aj = createMockAj({ http, pageTitle: { set }, gettext: s => `DE: ${s}` });
    const host = document.createElement('div');
    const unmount = mountPermissions(host, aj);
    expect(http).not.toHaveBeenCalled();
    expect(set).toHaveBeenCalledWith('DE: List all permissions');
    aj.identity.user = 'admin';
    await flushPromises();
    host.querySelectorAll('.nav-tabs a')[2].click();
    await nextTick();
    expect(host.querySelectorAll('.alert-success')).toHaveLength(2);
    unmount();
    expect(host.textContent).toBe('');
});
