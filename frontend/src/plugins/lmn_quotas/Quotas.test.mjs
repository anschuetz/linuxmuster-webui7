import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import Quotas from './Quotas.vue';
import ApplyDialog from './ApplyDialog.vue';
import UserSearch from './UserSearch.vue';
import { mount as mountQuotas } from './entry.mjs';

const defaults = { QUOTA_DEFAULT_GLOBAL: 100, QUOTA_DEFAULT_SCHOOL: 200, CLOUDQUOTA_PERCENTAGE: 50, MAILQUOTA_DEFAULT: 300 };
const sample = () => [{ teacher: { list: [{ login: 'z', sn: 'Zulu', givenname: 'Z' }, { login: 'a', sn: 'Alpha', givenname: 'A' }], z: { displayName: 'Z User', QUOTA: { ...defaults, QUOTA_DEFAULT_GLOBAL: 150 } }, a: { displayName: 'A User', QUOTA: { ...defaults } } }, student: { list: [] }, schooladministrator: { list: [] } }, Object.fromEntries(['teacher', 'student', 'schooladministrator'].map((r) => [`role.${r}`, { ...defaults }]))];
const groupData = () => ({ adminclass: { '5a': { QUOTA: { 'linuxmuster-global': { value: 12 }, 'default-school': { value: 0 }, mailquota: { value: 3 } } } }, project: { test: { QUOTA: { 'linuxmuster-global': { value: 4 }, 'default-school': { value: 0 }, mailquota: { value: 0 } } } } });
const wrappers = [];
afterEach(() => { for (const w of wrappers.splice(0)) w.unmount(); vi.useRealTimers(); });
async function setup(handler, component = Quotas, props = {}) {
    const http = vi.fn(handler ?? (async ({ url }) => ({ data: url.endsWith('/quotas') ? sample() : groupData() })));
    const notify = vi.fn();
    const reload = vi.fn();
    const modal = { open: vi.fn(() => new Promise(() => {})) };
    const aj = createMockAj({ http, notify, reload, modal, identity: { user: 'global-admin' } });
    const w = mount(component, { props, global: { provide: { aj } } });
    wrappers.push(w);
    await flushPromises();
    return { w, http, notify, reload, modal, aj };
}
const click = (w, text) => w.findAll('a, button').find((x) => x.text() === text).trigger('click');
const posts = (http) => http.mock.calls.map(([r]) => r).filter((r) => r.method === 'post');
const emptyChanges = () => ({ users: { teacher: {}, student: {}, schooladministrator: {} }, groups: { adminclass: {}, project: {} } });

it('loads six tabs, sorted names, defaults and disabled cloud quotas', async () => {
    const { w, http } = await setup();
    expect(w.findAll('[role=tab]').map((t) => t.text())).toEqual(['Teachers', 'Students', 'Schooladmins', 'Classes', 'Projects', 'Quota check']);
    expect(w.findAll('tbody tr').map((r) => r.find('td').text())).toEqual(['A User', 'Z User']);
    expect(w.findAll('input[disabled]').length).toBe(2);
    expect(w.findAll('input.nondefault').length).toBe(1);
    expect(w.text()).toContain('Default:');
    expect(http.mock.calls.map(([r]) => r.url)).toEqual(['/api/lmn/quota/quotas']);
    await click(w, 'Students');
    expect(w.findAll('tbody tr').length).toBe(0);
    expect(w.text()).not.toContain('There is no special quota here.'); // role exists even if list empty
});
it.each(['pending', 'error'])('leaves tables unset and spinner visible on %s initial load', async (state) => {
    const { w } = await setup(() => state === 'error' ? Promise.reject({}) : new Promise(() => {}));
    expect(w.find('table').exists()).toBe(false);
    expect(w.find('[role=progressbar]').exists()).toBe(true);
    expect(w.text()).not.toContain('There is no special quota here.');
});
it('writes exact user changes with numeric, null and default marker values', async () => {
    const { w, http } = await setup();
    await w.findAll('input[type=number]')[0].setValue('101.5');
    await w.findAll('input[type=number]')[1].setValue('');
    await w.findAll('input[type=number]')[3].setValue('300');
    await click(w, 'Save & apply');
    await flushPromises();
    const expected = emptyChanges();
    expected.users.teacher = { a_QUOTA_DEFAULT_GLOBAL: { login: 'a', quota: 'QUOTA_DEFAULT_GLOBAL', value: 101.5 }, a_QUOTA_DEFAULT_SCHOOL: { login: 'a', quota: 'QUOTA_DEFAULT_SCHOOL', value: null }, a_MAILQUOTA_DEFAULT: { login: 'a', quota: 'MAILQUOTA_DEFAULT', value: '---' } };
    expect(posts(http)).toEqual([{ method: 'post', url: '/api/lmn/quota/save', data: expected, cfg: undefined }]);
});
it('sends numeric input when the default is the string 500', async () => {
    const data = sample();
    data[1]['role.teacher'].QUOTA_DEFAULT_GLOBAL = '500';
    const { w, http } = await setup(async () => ({ data }));
    const input = w.findAll('input[type=number]')[0];
    await input.setValue('500');
    await click(w, 'Save & apply'); await flushPromises();
    expect(posts(http)[0].data.users.teacher.a_QUOTA_DEFAULT_GLOBAL.value).toBe(500);
    expect(input.classes()).toContain('nondefault');
});
it('preserves characterwise decimal input in user and group quotas', async () => {
    const { w, http } = await setup();
    for (const tab of ['Teachers', 'Classes']) {
        await click(w, tab); await flushPromises();
        const input = w.findAll('input[type=number]')[0];
        // jsdom sanitizes intermediate "1."; text mode models the browser edit buffer.
        input.element.type = 'text';
        input.element.value = '';
        for (const char of '1.05') {
            input.element.value += char;
            await input.trigger('input');
        }
        expect(input.element.value).toBe('1.05');
    }
    await click(w, 'Save & apply'); await flushPromises();
    expect(posts(http)[0].data.users.teacher.a_QUOTA_DEFAULT_GLOBAL.value).toBe(1.05);
    expect(posts(http)[0].data.groups.adminclass['5a_linuxmuster-global'].value).toBe(1.05);
});
it('removes a user by resetting three quotas only, retaining unrelated edits', async () => {
    const { w, http } = await setup();
    await w.findAll('input')[4].setValue('199');
    await w.findAll('tbody tr')[0].get('button').trigger('click');
    await click(w, 'Save & apply');
    await flushPromises();
    const expected = emptyChanges();
    expected.users.teacher = { z_QUOTA_DEFAULT_GLOBAL: { login: 'z', quota: 'QUOTA_DEFAULT_GLOBAL', value: 199 }, ...Object.fromEntries(['QUOTA_DEFAULT_GLOBAL', 'QUOTA_DEFAULT_SCHOOL', 'MAILQUOTA_DEFAULT'].map((quota) => [`a_${quota}`, { login: 'a', quota, value: '---' }])) };
    expect(posts(http)[0].data).toEqual(expected);
    expect(w.findAll('tbody tr').map((r) => r.find('td').text())).toEqual(['Z User']);
});
it('adds search result with independent defaults and no changes until edited', async () => {
    const { w, http, notify } = await setup();
    await click(w, 'Search & add user');
    w.getComponent(UserSearch).vm.$emit('select', { role: 'teacher', login: 'new', displayName: 'New User', givenName: 'First', sn: 'Last' });
    await flushPromises();
    expect(w.findComponent(UserSearch).isVisible()).toBe(false);
    expect(w.text()).toContain('New User');
    expect(notify.mock.calls).toEqual([['success', 'New User added with default values in the list.', undefined]]);
    await click(w, 'Save & apply');
    await flushPromises();
    expect(posts(http)[0].data).toEqual(emptyChanges());
});
it('preserves duplicate add/remove rows without throwing where Angular tolerates missing fields', async () => {
    const { w, http } = await setup();
    await click(w, 'Search & add user');
    w.getComponent(UserSearch).vm.$emit('select', { role: 'teacher', login: 'a', displayName: 'A User' });
    await flushPromises();
    expect(w.findAll('tbody tr').map((r) => r.find('td').text())).toEqual(['A User', 'Z User', 'A User']);
    await w.findAll('tbody tr')[0].get('button').trigger('click');
    expect(w.findAll('tbody tr').map((r) => r.find('td').text())).toEqual(['Z User', '']);
    await w.findAll('tbody tr')[1].get('input').setValue('123');
    await click(w, 'Save & apply'); await flushPromises();
    const expected = emptyChanges();
    expected.users.teacher = { a_QUOTA_DEFAULT_GLOBAL: { login: 'a', quota: 'QUOTA_DEFAULT_GLOBAL', value: 123 }, a_QUOTA_DEFAULT_SCHOOL: { login: 'a', quota: 'QUOTA_DEFAULT_SCHOOL', value: '---' }, a_MAILQUOTA_DEFAULT: { login: 'a', quota: 'MAILQUOTA_DEFAULT', value: '---' } };
    expect(posts(http)[0].data).toEqual(expected);
});
it('lazily loads groups once and posts class edits and project resets with original keys', async () => {
    const { w, http } = await setup();
    await click(w, 'Classes'); await flushPromises();
    await w.findAll('input')[0].setValue('23');
    await click(w, 'Projects'); await flushPromises();
    await w.get('tbody button').trigger('click');
    await click(w, 'Save & apply'); await flushPromises();
    const expected = emptyChanges();
    expected.groups.adminclass = { '5a_linuxmuster-global': { group: '5a', quota: 'linuxmuster-global', type: 'adminclass', value: 23 } };
    expected.groups.project = Object.fromEntries(['linuxmuster-global', 'default-school', 'mailquota'].map((quota) => [`test_${quota}`, { group: 'test', quota, type: 'project', value: '---' }]));
    expect(posts(http)[0].data).toEqual(expected);
    expect(http.mock.calls.filter(([r]) => r.url.endsWith('/groups')).length).toBe(1);
    await click(w, 'Classes');
    await w.get('tbody button').trigger('click');
    expect(w.findAll('input[type=number]').map((n) => n.element.value)).toEqual(['0', '0', '0']);
});
it('keeps group wait open on rejection and retries on the next group tab', async () => {
    const { w, modal, http } = await setup(async ({ url }) => { if (url.endsWith('/groups')) throw {}; return { data: sample() }; });
    await click(w, 'Classes'); await flushPromises();
    expect(modal.open.mock.calls).toHaveLength(1);
    expect(w.findAll('tbody tr')).toHaveLength(0);
    await click(w, 'Projects'); await flushPromises();
    expect(http.mock.calls.filter(([r]) => r.url.endsWith('/groups'))).toHaveLength(2);
});
it('opens static apply only after save succeeds and reloads when closed', async () => {
    const { w, modal, reload } = await setup();
    modal.open.mockImplementationOnce(() => Promise.resolve()); // wait
    modal.open.mockImplementationOnce(() => Promise.resolve()); // apply close
    await click(w, 'Save & apply'); await flushPromises();
    expect(modal.open.mock.calls[1]).toEqual([ApplyDialog, {}, { backdrop: 'static' }]);
    expect(reload).toHaveBeenCalledOnce();
});
it('save failure leaves wait visible and does not open apply', async () => {
    const { w, modal } = await setup(async ({ method }) => { if (method === 'post') throw {}; return { data: sample() }; });
    await click(w, 'Save & apply'); await flushPromises();
    expect(modal.open).toHaveBeenCalledTimes(1);
});
it('checks selected users and clears selection without hiding the previous result', async () => {
    const { w, http } = await setup(async ({ url }) => ({ data: url.endsWith('/quotas') ? sample() : { directories: { '/home/test': { total: '2 MiB' } }, total: '3 MiB' } }));
    await click(w, 'Quota check');
    await w.get('form').trigger('submit');
    expect(http).toHaveBeenCalledTimes(1);
    w.getComponent(UserSearch).vm.$emit('select', { login: 'test', label: 'Test User' });
    await flushPromises();
    expect(http.mock.calls.at(-1)[0].url).toBe('/api/lmn/quota/check/test');
    expect(w.text()).toContain('/home/test');
    expect(w.text()).toContain('3 MiB');
    w.getComponent(UserSearch).vm.$emit('query'); await flushPromises();
    const before = http.mock.calls.length;
    await w.get('form').trigger('submit');
    expect(http.mock.calls.length).toBe(before);
    await w.getComponent(UserSearch).vm.$emit('select', { login: 'test', label: 'Test User' });
    await flushPromises();
    await w.get('[aria-label=Clear]').trigger('click');
    expect(w.text()).toContain('/home/test');
    await click(w, 'Teachers'); await click(w, 'Quota check');
    expect(w.text()).not.toContain('/home/test');
});
it('quota check error keeps its spinner, as in Angular', async () => {
    const { w } = await setup(async ({ url }) => { if (url.includes('/check/')) throw {}; return { data: sample() }; });
    await click(w, 'Quota check');
    w.getComponent(UserSearch).vm.$emit('select', { login: 'test', label: 'Test' }); await flushPromises();
    expect(w.find('[role=progressbar]').exists()).toBe(true);
    expect(w.find('table').exists()).toBe(false);
});
it('handles Ctrl+F/S and removes hotkeys on disposal', async () => {
    const { w, http } = await setup();
    const event = (key) => new KeyboardEvent('keydown', { key, ctrlKey: true, cancelable: true });
    const f = event('f'); window.dispatchEvent(f); await flushPromises();
    expect(f.defaultPrevented).toBe(true);
    expect(w.findComponent(UserSearch).exists()).toBe(true);
    await w.getComponent(UserSearch).get('input').setValue('ab');
    await click(w, 'Close');
    window.dispatchEvent(event('f')); await flushPromises();
    expect(w.getComponent(UserSearch).get('input').element.value).toBe('ab');
    await click(w, 'Close');
    await click(w, 'Classes'); await flushPromises();
    const groupF = event('f'); window.dispatchEvent(groupF); expect(groupF.defaultPrevented).toBe(false);
    window.dispatchEvent(event('s')); await flushPromises();
    expect(posts(http)).toHaveLength(1);
    w.unmount(); wrappers.splice(wrappers.indexOf(w), 1);
    window.dispatchEvent(event('s')); await flushPromises(); expect(posts(http)).toHaveLength(1);
});
it('search trims text, waits for three chars, uses role, supports keyboard selection and errors', async () => {
    const user = { login: 'test', label: 'Test User' };
    const { w, http } = await setup(async () => ({ data: [user] }), UserSearch, { role: 'teacher' });
    await w.get('input').setValue('ab'); expect(http).not.toHaveBeenCalled();
    await w.get('input').setValue(' test '); await flushPromises();
    expect(w.get('input').element.value).toBe(' test ');
    expect(http.mock.calls[0][0]).toEqual({ method: 'post', url: '/api/lmn/ldap-search', data: { role: 'teacher', login: 'test' }, cfg: undefined });
    await w.get('input').trigger('keydown', { key: 'ArrowDown' });
    await w.get('input').trigger('keydown', { key: 'ArrowUp' });
    await w.get('input').trigger('keydown', { key: 'Enter' });
    expect(w.emitted('select')).toEqual([[user]]);
    http.mockRejectedValueOnce({});
    await w.get('input').setValue('failed'); await flushPromises();
    expect(w.findAll('[role=option]')).toHaveLength(0);
});
it('search ignores obsolete responses and allows a mouse selection', async () => {
    let resolve;
    const { w } = await setup(() => new Promise((r) => { resolve = r; }), UserSearch, { role: '' });
    await w.get('input').setValue('test');
    const stale = resolve;
    await w.get('input').setValue('other');
    stale({ data: [{ login: 'stale', label: 'Stale' }] }); await flushPromises();
    expect(w.findAll('[role=option]')).toHaveLength(0);
    const user = { login: 'other', label: 'Other' };
    resolve({ data: [user] }); await flushPromises();
    await w.get('[role=option]').trigger('mousedown');
    expect(w.emitted('select')).toEqual([[user]]);
});
it.each([false, true])('apply shows log, settles success/error (%s), toggles details and closes', async (failure) => {
    let finish;
    const { w, http, notify } = await setup(() => new Promise((resolve, reject) => { finish = failure ? reject : resolve; }), ApplyDialog);
    expect(posts(http)).toEqual([{ method: 'post', url: '/api/lmn/quota/apply', data: undefined, cfg: undefined }]);
    expect(w.find('[role=progressbar]').exists()).toBe(true);
    expect(w.text()).not.toContain('Close');
    await click(w, 'Hide details');
    finish(failure ? { data: { message: 'failure' } } : { data: null }); await flushPromises();
    expect(notify.mock.calls).toEqual([[failure ? 'error' : 'success', failure ? 'Update failed' : 'Update complete', failure ? 'failure' : undefined]]);
    expect(w.find('[role=progressbar]').exists()).toBe(false);
    expect(w.get('pre').isVisible()).toBe(failure);
    await click(w, failure ? 'Hide details' : 'Details');
    await click(w, 'Close'); expect(w.emitted('close')).toEqual([[]]);
});
it('entry mounts and unmounts with the supplied adapter', async () => {
    const host = document.createElement('div');
    const unmount = mountQuotas(host, createMockAj({ http: async () => ({ data: sample() }), identity: { user: 'global-admin' } }));
    await flushPromises(); expect(host.textContent).toContain('A User');
    unmount(); expect(host.innerHTML).toBe('');
});
