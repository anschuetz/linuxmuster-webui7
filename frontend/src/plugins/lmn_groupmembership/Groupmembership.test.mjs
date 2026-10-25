import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import Groupmembership from './Groupmembership.vue';
import Details from './Details.vue';
import { mount as mountEntry } from './entry.mjs';
const group = (name, type = 'project', extra = {}) => ({ groupname: name, cn: name, type: type === 'adminclass' ? 'schoolclass' : 'project', sophomorixType: type, sophomorixMembers: [], sophomorixAdmins: [], sophomorixMemberGroups: [], sophomorixAdminGroups: [], members: [], sophomorixJoinable: true, membership: false, ...extra });
const details = (g) => ({ GROUP: { [g.groupname]: { ...g, sophomorixJoinable: 'TRUE' } }, MEMBERS: { [g.groupname]: {} } });
let wrappers = [];
const button = (w, label) => w.findAll('button, a.btn').find((b) => b.text() === label);
function setup(options = {}, component = Groupmembership, props = {}) {
    const calls = [], notifications = [];
    const aj = createMockAj({ identity: { user: 'zem', profile: { sophomorixRole: 'teacher', isAdmin: false } }, pageTitle: { set: vi.fn() }, notify: (...a) => notifications.push(a), http: async (r) => { calls.push(r); return { data: r.method === 'get' ? [group('test')] : ['LOG', 'OK'] }; }, ...options });
    const smbclient = { refresh_krbcc: vi.fn().mockRejectedValue('cancel') };
    const w = mount(component, { props, global: { provide: { aj, smbclient } } }); wrappers.push(w);
    return { w, aj, calls, notifications, smbclient };
}
afterEach(() => { wrappers.forEach((w) => w.unmount()); wrappers = []; document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('loads all lists independently, filters with ngTrim including an inner space, opens details', async () => {
    const modal = { open: vi.fn(async () => ({ response: 'refresh' })) };
    const { w, aj, calls } = setup({ modal }); expect(w.findAll('[role=status]').filter((e) => e.isVisible())).toHaveLength(3); await flushPromises();
    expect(calls.map((r) => r.url)).toEqual(['/api/lmn/groupmembership/projects', '/api/lmn/groupmembership/printers', '/api/lmn/groupmembership/schoolclasses']);
    expect(aj.pageTitle.set.mock.calls).toEqual([['Enrolle']]);
    const input = w.find('input[type=search]');
    for (const c of '  test name  ') { input.element.value += c; await input.trigger('input'); }
    expect(input.element.value).toContain('test name'); expect(w.findAll('.membership-item')).toHaveLength(0);
    await input.setValue(' test '); await w.find('.membership-item a').trigger('click'); await flushPromises();
    expect(modal.open.mock.calls[0]).toEqual([Details, { groupType: 'project', groupName: 'test' }]); expect(calls).toHaveLength(6);
});
it('toggles object sections and closes dropdowns on outside click like uib-dropdown', async () => {
    const { w } = setup(); await flushPromises();
    await button(w, 'Objectsfilter').trigger('click'); expect(w.find('.dropdown-menu').exists()).toBe(true);
    await w.find('.dropdown-menu input').setValue(false); expect(w.find('h3').isVisible()).toBe(false);
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })); await w.vm.$nextTick(); expect(w.find('.dropdown-menu').exists()).toBe(false);
    await button(w, 'Groupname').trigger('click'); expect(w.findAll('.dropdown-menu a').map((x) => x.text())).toEqual(['Groupname', 'Membership']);
    await w.findAll('.dropdown-menu a')[1].trigger('click'); expect(button(w, 'Membership')).toBeDefined(); expect(w.find('.dropdown-menu').exists()).toBe(false);
    await button(w, 'Objectsfilter').trigger('click'); await button(w, 'New Project').trigger('click'); await flushPromises(); expect(w.find('.dropdown-menu').exists()).toBe(false);
    await button(w, 'Objectsfilter').trigger('click'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w.vm.$nextTick(); expect(w.find('.dropdown-menu').exists()).toBe(false);
});
it('keeps spinners on load failure, skips root, null and undefined identity', async () => {
    const { w } = setup({ http: async () => { throw new Error('HTTP'); } }); await flushPromises();
    expect(w.findAll('[role=status]').filter((e) => e.isVisible())).toHaveLength(3); expect(w.text()).not.toContain('There are no projects yet.');
    for (const user of [null, undefined, 'root']) {
        const { calls } = setup({ identity: { user, profile: {} } }); await flushPromises(); expect(calls).toEqual([]);
    }
});
it('shows samba blocker for a loaded identity without a role', async () => {
    const { w } = setup({ identity: { user: 'root', profile: {} } }); await flushPromises(); expect(w.find('input[type=search]').exists()).toBe(false);
});
it('creates validated projects and refreshes identity then lists only on LOG', async () => {
    const refresh = vi.fn(async () => {}), prompt = vi.fn(async () => ({ value: 'test' }));
    const { w, aj, calls, notifications } = setup({ messagebox: { prompt }, identity: { user: 'zem', profile: { sophomorixRole: 'teacher' }, refresh } }); await flushPromises();
    await button(w, 'New Project').trigger('click'); await flushPromises();
    expect(calls[3]).toEqual({ method: 'post', url: '/api/lmn/groupmembership/projects/test', data: undefined, cfg: undefined }); expect(refresh.mock.calls).toEqual([[]]); expect(calls).toHaveLength(7);
    prompt.mockResolvedValueOnce({ value: 'bad name' }); await button(w, 'New Project').trigger('click'); await flushPromises(); expect(calls).toHaveLength(7);
    prompt.mockResolvedValueOnce({ value: '' }); await button(w, 'New Project').trigger('click'); await flushPromises(); expect(calls).toHaveLength(7);
    prompt.mockRejectedValueOnce('cancel'); await button(w, 'New Project').trigger('click'); await flushPromises(); expect(calls).toHaveLength(7);
    for (const data of [['ERROR', 'bad'], ['OTHER', 'odd']]) { aj.http.post = vi.fn(async () => ({ data })); await button(w, 'New Project').trigger('click'); await flushPromises(); }
    expect(refresh.mock.calls).toEqual([[]]);
    expect(notifications).toEqual([['success', 'Project Created', undefined], ['error', 'bad name can only contain lowercase chars or numbers', undefined], ['error', 'bad', undefined], ['info', 'Something unusual happened', undefined]]);
});
it('self membership toggles on LOG, stays busy on ERROR or rejection, refresh is cancelable', async () => {
    const refresh = vi.fn(async () => {}), prompt = vi.fn().mockRejectedValue('cancel');
    const { w, aj, calls } = setup({ gettext: (s) => s.includes('ng:click="refresh_krbcc()"') ? 'DE Sitzung erneuern <a class="btn">Jetzt</a>' : s, identity: { user: 'zem', profile: { sophomorixRole: 'teacher' }, refresh }, messagebox: { prompt, show: vi.fn().mockRejectedValue('cancel') } }); await flushPromises();
    await w.find('#test').trigger('click'); await flushPromises();
    expect(calls[3]).toEqual({ method: 'post', url: '/api/lmn/groupmembership/membership', data: { action: 'addmembers', entity: 'zem', groupname: 'test', type: 'project' }, cfg: undefined });
    expect(refresh.mock.calls).toEqual([[]]); expect(w.find('#test').element.checked).toBe(true); expect(w.text()).toContain('Do it now'); expect(w.text()).toContain('DE Sitzung erneuern'); expect(w.find('.alert-info').findAll('a')).toHaveLength(1);
    await button(w, 'Do it now').trigger('click'); await flushPromises(); expect(w.text()).toContain('Do it now');
    aj.http.post = vi.fn(async () => ({ data: ['ERROR', 'bad'] })); await w.find('#test').trigger('click'); await flushPromises(); expect(w.findAll('[role=status]').filter((e) => e.isVisible())).toHaveLength(1);
    aj.http.post.mockRejectedValueOnce(new Error('HTTP')); await w.find('#test').trigger('click'); await flushPromises(); expect(w.findAll('[role=status]').filter((e) => e.isVisible())).toHaveLength(1);
});
it('clears refresh reminder only after successful ticket renewal and offers renewal on unmount', async () => {
    const show = vi.fn().mockResolvedValue({}); const { w, smbclient } = setup({ messagebox: { show } }); await flushPromises();
    await w.find('#test').trigger('click'); await flushPromises();
    smbclient.refresh_krbcc.mockResolvedValueOnce(); await button(w, 'Do it now').trigger('click'); await flushPromises();
    expect(button(w, 'Do it now')).toBeUndefined();
    await w.find('#test').trigger('click'); await flushPromises(); w.unmount(); await flushPromises();
    expect(show.mock.calls).toEqual([[{ text: 'These changes can only take effect if the session is renewed, otherwise it will be active after the next logout/login. It could be useful for the session plugin to do it now.', positive: 'Do it now', negative: 'Later' }]]);
    expect(smbclient.refresh_krbcc.mock.calls).toEqual([[], []]);
});
it('resets all admins with the original trailing comma and ignores ERROR result', async () => {
    const close = vi.fn(); const show = vi.fn(() => Object.assign(Promise.resolve(), { close }));
    const { w, aj, notifications } = setup({ identity: { user: 'admin', profile: { sophomorixRole: 'globaladministrator', isAdmin: true } }, messagebox: { show } }); await flushPromises();
    aj.http.post = vi.fn(async () => ({ data: ['ERROR', 'bad'] }));
    await w.find('button[title="Reset all memberships"]').trigger('click'); await flushPromises();
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/groupmembership/resetadmins', { type: 'class', all_groups: 'test,' }]]);
    expect(close.mock.calls).toEqual([[]]); expect(notifications[0]).toEqual(['success', 'Admin membership reset', undefined]);
});
it('details use observed shell identity for permissions, close and malformed response', async () => {
    const g = group('test'); const { w } = setup({ identity: { user: 'admin', profile: { isAdmin: true } }, http: async () => ({ data: details(g) }) }, Details, { groupType: 'project', groupName: 'test' });
    expect(w.find('[role=status]').exists()).toBe(true); await flushPromises();
    expect(w.find('input[type=checkbox]').element.disabled).toBe(false); expect(button(w, 'Add user or group').isVisible()).toBe(true); expect(button(w, 'Delete Project').isVisible()).toBe(true);
    await button(w, 'Close').trigger('click'); expect(w.emitted('cancel')).toEqual([[]]);
    const invalid = setup({ http: async () => ({ data: {} }) }, Details, { groupType: 'project', groupName: 'missing' }); await flushPromises(); expect(invalid.w.emitted('cancel')).toEqual([[]]);
    const failed = setup({ http: async () => { throw new Error('HTTP'); } }, Details, { groupType: 'project', groupName: 'missing' }); await flushPromises(); expect(failed.w.find('[role=status]').exists()).toBe(true);
});
it('empty-class deletion keeps description path and refreshes only on LOG', async () => {
    const g = group('test', 'adminclass', { description: 'description' }); const close = vi.fn();
    const { w, aj } = setup({ identity: { user: 'admin', profile: { isAdmin: true } }, http: async () => ({ data: details(g) }), messagebox: { show: () => Object.assign(Promise.resolve(), { close }) } }, Details, { groupType: 'schoolclass', groupName: 'test' }); await flushPromises();
    aj.http.delete = vi.fn(async () => ({ data: ['ERROR', 'bad'] })); await w.find('.alert-warning a').trigger('click'); await flushPromises(); expect(w.emitted('close')).toBeUndefined();
    aj.http.delete.mockResolvedValueOnce({ data: ['LOG', 'ok'] }); await w.find('.alert-warning a').trigger('click'); await flushPromises();
    expect(aj.http.delete.mock.calls).toEqual([['/api/lmn/groupmembership/schoolclass/description'], ['/api/lmn/groupmembership/schoolclass/description']]); expect(w.emitted('close')).toEqual([[{ response: 'refresh' }]]); expect(close.mock.calls).toEqual([[], []]);
});
it('entry mounts and unmounts', () => {
    const element = document.createElement('div'); const stop = mountEntry(element, createMockAj()); expect(element.innerHTML).not.toEqual(''); stop(); expect(element.innerHTML).toEqual('');
});

it('C4 resolves badge contexts and Vue dropdown show state without changing membership', async () => {
    const { w, calls } = setup(); await flushPromises();
    expect(w.findAll('.badge.c4-badge.bg-danger').length).toBeGreaterThan(0);
    expect(w.find('.label, .btn-default, .input-group-btn').exists()).toBe(false);
    await button(w, 'Objectsfilter').trigger('click');
    expect(w.get('.dropdown-menu.show').isVisible()).toBe(true);
    await button(w, 'Objectsfilter').trigger('click');
    expect(w.find('.dropdown-menu.show').exists()).toBe(false);
    expect(calls.filter(r => r.method === 'post')).toEqual([]);
});
