import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import Crontab from './Crontab.vue';
import { createMockAj } from '../../../adapter/mock.mjs';
import { mount as mountCron } from '../entry.mjs';

const empty = () => ({ normal_tasks: [], special_tasks: [], env_settings: [] });
const job = { minute: '17', hour: '3', day_of_month: '*', month: '*', day_of_week: '*', command: '/bin/true', comment: 'synthetic', school: 'default-school', disable_holiday: true };
const setup = async (tabs = [{ ...empty(), normal_tasks: [job] }, empty()], options = {}) => {
    const http = vi.fn(async ({ method }) => ({ data: method === 'get' ? [...tabs, 'default-school'] : false }));
    const notify = vi.fn();
    const aj = createMockAj({ identity: { user: 'global-admin', profile: { sophomorixRole: 'globaladministrator' } }, http, notify, ...options });
    const wrapper = mount(Crontab, { attachTo: document.body, global: { provide: { aj } } });
    await flushPromises();
    return { wrapper, http, notify, aj };
};
const button = (w, text) => w.findAll('button, [role=tab]').find((b) => b.text() === text);

it('shows both users and all three tabs with fields, school and holidays', async () => {
    const { wrapper: w, http } = await setup();
    expect(http).toHaveBeenCalledWith({ method: 'get', url: '/api/lmn/crontab', data: undefined, cfg: undefined });
    expect(w.text()).toContain('/bin/true');
    expect(w.text()).toContain('default-school');
    expect(w.get('td [role=checkbox]').attributes('aria-checked')).toBe('true');
    expect(w.text()).toContain('17');
    await button(w, 'Special').trigger('click');
    expect(w.text()).toContain('There is no special task.');
    await button(w, 'Environment variables').trigger('click');
    expect(w.text()).toContain('There is no variables environment set.');
    await w.get('select').setValue('root');
    await button(w, 'Jobs').trigger('click');
    expect(w.text()).toContain('There is no cronjob.');
    w.unmount();
});

it.each([
    ['Jobs', { command: '/bin/true', comment: 'normal' }, 'normal_tasks'],
    ['Special', { special: '@daily', command: '/bin/true', comment: 'special' }, 'special_tasks'],
    ['Environment variables', { name: 'P28_TEST', value: 'synthetic', comment: 'env' }, 'env_settings'],
])('adds %s with original defaults and exact save envelope', async (tab, values, type) => {
    const { wrapper: w, http, notify } = await setup([empty(), empty()]);
    await button(w, tab).trigger('click');
    await button(w, 'Add').trigger('click');
    for (const [key, value] of Object.entries(values)) await w.get(`[name=${key}]`).setValue(value);
    expect(w.get('[name=comment]').attributes('required')).toBeUndefined();
    await w.get('form').trigger('submit');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    const saved = http.mock.calls.at(-1)[0].data;
    expect(Object.keys(saved)).toEqual(['globaladministrator', 'root']);
    expect(saved.root).toEqual(empty());
    expect(saved.globaladministrator[type]).toEqual([expect.objectContaining({ ...values, school: 'default-school' })]);
    expect(saved.globaladministrator[type][0]).not.toHaveProperty('new');
    if (type === 'normal_tasks') expect(saved.globaladministrator[type][0]).toMatchObject({ minute: '*', hour: '*', day_of_week: '*', day_of_month: '*', month: '*' });
    expect(notify).toHaveBeenCalledWith('success', 'Crontab successfully saved !', undefined);
    w.unmount();
});

it('trims command text before saving the root crontab', async () => {
    const { wrapper: w, http } = await setup([empty(), { ...empty(), normal_tasks: [job] }]);
    await w.get('select').setValue('root');
    await w.get('[title=Modify]').trigger('click');
    await w.get('[name=command]').setValue('\n/usr/bin/foo ');
    await button(w, 'Cancel').trigger('click');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(http.mock.calls.at(-1)[0].data.root.normal_tasks[0].command).toBe('/usr/bin/foo');
    w.unmount();
});

it('preserves a character-by-character command with an inner space in the root payload', async () => {
    const { wrapper: w, http } = await setup([empty(), { ...empty(), normal_tasks: [job] }]);
    await w.get('select').setValue('root');
    await w.get('[title=Modify]').trigger('click');
    const input = w.get('[name=command]');
    input.element.focus();
    await input.setValue('');
    for (const character of '/usr/bin/foo --bar') {
        input.element.value += character;
        await input.trigger('input');
    }
    expect(input.element.value).toBe('/usr/bin/foo --bar');
    await button(w, 'Cancel').trigger('click');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(http.mock.calls.at(-1)[0].data.root.normal_tasks[0].command).toBe('/usr/bin/foo --bar');
    w.unmount();
});

it('omits a cleared required minute from the serialized existing job', async () => {
    const { wrapper: w, http } = await setup();
    await w.get('[title=Modify]').trigger('click');
    await w.get('[name=minute]').setValue('');
    await button(w, 'Cancel').trigger('click');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    const saved = JSON.parse(JSON.stringify(http.mock.calls.at(-1)[0].data));
    const { minute, ...remaining } = job;
    expect(saved.globaladministrator.normal_tasks[0]).toEqual(remaining);
    w.unmount();
});

it('keeps edits on cancel, discards cancelled additions, removes and saves both tabs', async () => {
    const { wrapper: w, http } = await setup();
    await w.get('[title=Modify]').trigger('click');
    expect(w.get('[name=comment]').element.value).toBe('synthetic');
    await w.get('[name=command]').setValue('/bin/false');
    await button(w, 'Cancel').trigger('click');
    expect(w.text()).toContain('/bin/false');
    await button(w, 'Add').trigger('click');
    await button(w, 'Cancel').trigger('click');
    expect(w.findAll('[title=Remove]')).toHaveLength(1);
    await w.get('td [role=checkbox]').trigger('click');
    await w.get('select').setValue('root');
    await w.get('select').setValue('globaladministrator');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(http.mock.calls.at(-1)[0].data.globaladministrator.normal_tasks[0]).toEqual({ ...job, command: '/bin/false', disable_holiday: false });
    await w.get('[title=Remove]').trigger('click');
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(http.mock.calls.at(-1)[0].data).toEqual({ globaladministrator: empty(), root: empty() });
    w.unmount();
});

it('does not show empty states while loading or after GET rejection; waits for identity', async () => {
    let reject;
    const http = vi.fn(() => new Promise((_, no) => { reject = no; }));
    const { wrapper: w, aj } = await setup(undefined, { identity: { user: null }, http });
    expect(http).not.toHaveBeenCalled();
    aj.identity.user = 'global-admin';
    await nextTick();
    expect(w.find('.alert-info').exists()).toBe(false);
    reject(new Error('HTTP 500'));
    await flushPromises();
    expect(w.find('.alert-info').exists()).toBe(false);
    w.unmount();
});

it('reports failed saves and shows the access blocker for non-global-admin roles', async () => {
    const { wrapper: w, notify, aj } = await setup(undefined, { http: async ({ method }) => {
        if (method === 'post') throw new Error('HTTP 500');
        return { data: [empty(), empty(), 'default-school'] };
    } });
    await button(w, 'Save').trigger('click');
    await flushPromises();
    expect(notify).toHaveBeenCalledWith('error', 'Failed to save crontab', undefined);
    for (const role of ['schooladministrator', 'teacher', 'student']) {
        aj.identity.profile = { sophomorixRole: role };
        await nextTick();
        expect(w.text()).toContain('This page is restricted to global administrators!');
        expect(w.find('select').exists()).toBe(false);
    }
    w.unmount();
});

it('sets translated pageTitle through the entry and unmounts', async () => {
    const set = vi.fn();
    const host = document.createElement('div');
    const unmount = mountCron(host, createMockAj({ pageTitle: { set }, gettext: (s) => `DE:${s}` }));
    expect(set).toHaveBeenCalledWith('DE:Cron');
    unmount();
    expect(host.textContent).toBe('');
});

it('renders the crontab choice with the existing German catalog msgid (D21)', async () => {
    const catalog = JSON.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_crontab/locale/de/LC_MESSAGES/app.js', 'utf8'));
    const { wrapper } = await setup(undefined, { gettext: text => catalog[text] || text });
    expect(wrapper.get('label[for="cron-user"]').text()).toBe('Wähle den Crontab aus, den du bearbeiten möchtest:');
    wrapper.unmount();
});
