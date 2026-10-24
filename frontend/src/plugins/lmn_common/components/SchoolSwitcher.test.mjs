import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import SchoolSwitcher from './SchoolSwitcher.vue';
import { mount as mountSchool } from '../entry.mjs';
import { createMockAj } from '../../../adapter/mock.mjs';

const schools = [
    { school: 'z-school', schoolname: 'Zulu Schule', $hidden: 'secret' },
    { school: 'a-school', schoolname: 'Alpha Campus' },
    { school: 'b-school', schoolname: null },
];
const wrappers = [];
function setup({ identity = { user: 'global-admin', profile: { school_show: true } }, http, result = true } = {}) {
    const calls = [], notify = vi.fn(), set = vi.fn();
    const aj = createMockAj({ identity, notify, pageTitle: { set }, gettext: text => `DE: ${text}`, http: http ?? (async request => {
        calls.push(request);
        return { data: request.url.endsWith('/activeschool') ? 'z-school' : request.url.endsWith('/get-schoolname') ? 'Zulu Schule' : request.url.endsWith('/list-schools') ? schools : result };
    }) });
    const wrapper = mount(SchoolSwitcher, { global: { provide: { aj } } });
    wrappers.push(wrapper);
    return { wrapper, aj, calls, notify, set };
}
const request = (method, path, data) => ({ method, url: `/api/lmn/${path}`, data, cfg: undefined });
afterEach(() => wrappers.splice(0).forEach(w => w.unmount()));
it('loads both independent branches, publishes active context and preserves list order', async () => {
    const { wrapper, aj, calls, set } = setup(); await flushPromises();
    expect(calls).toEqual([request('get', 'activeschool'), request('get', 'list-schools'), request('post', 'get-schoolname', { school: 'z-school' })]);
    expect(aj.identity.profile).toEqual({ school_show: true, activeSchool: 'z-school', schoolname: 'Zulu Schule' });
    expect(wrapper.findAll('.school-item').map(w => w.text())).toEqual(['z-school - Zulu Schule', 'a-school - Alpha Campus', 'b-school -']);
    expect(wrapper.get('.list-group-item').text()).toEqual('DE: Current: z-school - Zulu Schule');
    expect(set.mock.calls).toEqual([['Schoolswitcher']]);
});
it.each([false, undefined])('uses school_show=%s as UI gate but still loads as Angular does', async school_show => {
    const { wrapper, calls } = setup({ identity: { user: 'student', profile: { school_show } } }); await flushPromises();
    expect(wrapper.get('.alert-info').isVisible()).toEqual(true);
    expect(wrapper.get('.info-cards').isVisible()).toEqual(false);
    expect(calls.length).toEqual(3);
});
it('shows identity spinner and reacts to identity visibility', async () => {
    const { wrapper, aj } = setup({ identity: { user: null, profile: { school_show: true } } });
    expect(wrapper.get('.school-spinner').isVisible()).toEqual(true);
    expect(wrapper.get('.info-cards').isVisible()).toEqual(false);
    aj.identity.user = 'global-admin'; await nextTick();
    expect(wrapper.get('.school-spinner').element.style.display).toEqual('none');
    expect(wrapper.get('.info-cards').element.style.display).toEqual('');
});
it('matches Angular filter strings: any field, case, null, negation, $$ exclusion, ngTrim and inner spaces', async () => {
    const { wrapper } = setup(); await flushPromises();
    const input = wrapper.get('input');
    for (const [query, expected] of [['CAMPUS', ['a-school - Alpha Campus']], ['!campus', ['z-school - Zulu Schule', 'b-school -']], ['!!campus', ['a-school - Alpha Campus']], ['secret', []], ['!school', []], ['', ['z-school - Zulu Schule', 'a-school - Alpha Campus', 'b-school -']]]) {
        await input.setValue(query);
        expect(wrapper.findAll('.school-item').map(w => w.text())).toEqual(expected);
    }
    let typed = '';
    for (const character of '  Alpha Campus  ') { typed += character; input.element.value = typed; await input.trigger('input'); }
    expect(wrapper.findAll('.school-item').map(w => w.text())).toEqual(['a-school - Alpha Campus']);
});
it.each([true, false])('switch result %s notifies with original untranslated text then reloads', async result => {
    const { wrapper, calls, notify } = setup({ result }); await flushPromises();
    await wrapper.findAll('.school-item')[1].trigger('click'); await flushPromises();
    expect(calls.slice(3)).toEqual([request('post', 'change-school', { school: 'a-school' }), request('get', 'activeschool'), request('get', 'list-schools'), request('post', 'get-schoolname', { school: 'z-school' })]);
    expect(notify.mock.calls).toEqual([[result ? 'success' : 'error', result ? 'School changed successfully' : 'Failed to change school!', undefined]]);
});
it('keeps list unset while loading and after request rejection; adapter owns error policy', async () => {
    let reject;
    const { wrapper } = setup({ http: () => new Promise((_, r) => { reject = r; }) });
    expect(wrapper.findAll('.school-item')).toEqual([]);
    reject(new Error('503')); await flushPromises();
    expect(wrapper.findAll('.school-item')).toEqual([]);
    expect(wrapper.findAll('.alert-danger')).toEqual([]);
});
it('does not reload or notify on rejected switch', async () => {
    const { wrapper, aj, calls, notify } = setup(); await flushPromises();
    aj.http.post = vi.fn(async () => { throw new Error('503'); });
    await wrapper.findAll('.school-item')[0].trigger('click'); await flushPromises();
    expect(calls.length).toEqual(3); expect(notify.mock.calls).toEqual([]);
});
it('mounts school view and releases it', async () => {
    const host = document.createElement('div');
    const dispose = mountSchool(host, createMockAj()); await flushPromises();
    expect(host.textContent.includes('This is not a multi-school setup')).toEqual(true);
    dispose(); expect(host.textContent).toEqual('');
});
it.each(['activeschool', 'get-schoolname', 'list-schools'])('retains original partial results when %s rejects', async endpoint => {
    const { wrapper, aj } = setup({ http: async ({ url }) => {
        if (url.endsWith(`/${endpoint}`)) throw new Error('503');
        return { data: url.endsWith('/activeschool') ? 'z-school' : url.endsWith('/list-schools') ? schools : null };
    } });
    await flushPromises();
    expect(wrapper.findAll('.school-item').length).toEqual(endpoint === 'list-schools' ? 0 : 3);
    expect(aj.identity.profile.activeSchool).toEqual(endpoint === 'activeschool' ? undefined : 'z-school');
    expect(aj.identity.profile.schoolname).toEqual(endpoint === 'list-schools' ? null : undefined);
});
