import { afterEach, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMockAj } from '../../adapter/mock.mjs';
import Details from './Details.vue';
const wrappers = [];
const person = (login, sn, role = 'student') => ({ sAMAccountName: login, sn, givenName: 'Test', sophomorixAdminClass: '5a', sophomorixRole: role });
const user = { login: 'new-user', sn: 'Neu', givenName: 'Test', label: 'New User', sophomorixAdminClass: '5a', sophomorixRole: 'teacher' };
const button = (w, label) => w.findAll('a.btn, button').find((x) => x.text() === label);
function setup(sophomorixType = 'project', profile = { isAdmin: true }) {
    const calls = [];
    const printer = sophomorixType === 'printer';
    const data = { GROUP: { p73: { cn: 'p73', description: 'P73 Test', sophomorixType, sophomorixAdmins: printer ? [] : sophomorixType === 'adminclass' ? ['owner', 'member'] : ['owner'], sophomorixMembers: ['member'], sophomorixMemberGroups: ['member-group'], sophomorixAdminGroups: ['admin-group'], sophomorixJoinable: 'FALSE', sophomorixHidden: 'FALSE', sophomorixMailList: 'FALSE', sophomorixCreationDate: '20260102030405.0Z' } }, MEMBERS: { p73: { member: person('member', 'Mitglied', sophomorixType === 'adminclass' ? 'teacher' : 'student'), owner: person('owner', 'Besitzer', 'teacher'), nested: { sn: 'null', sAMAccountName: 'nested-group' } } }, LISTS: { MEMBERLIST: { p73: ['member', 'nested'] } } };
    const aj = createMockAj({ identity: { user: 'global-admin', profile }, http: async (request) => {
        calls.push(request);
        if (request.url.includes('/find/user') || request.url.includes('/find/teacher/')) return { data: [user] };
        if (request.url.includes('/find/group/')) return { data: ['p73', 'new-group'] };
        return { data: request.method === 'get' ? data : request.url.includes('/groupoptions/') ? 'option saved' : ['LOG', 'ok'] };
    } });
    const w = mount(Details, { attachTo: document.body, props: { groupType: printer ? 'printergroup' : sophomorixType === 'adminclass' ? 'schoolclass' : 'project', groupName: 'p73' }, global: { provide: { aj } } }); wrappers.push(w);
    return { w, calls };
}
const item = (w, panel, name) => w.findAll(`${panel} li.cardlist`).find((x) => x.isVisible() && x.text().includes(name));
const click = async (w, panel, name, icon) => { await item(w, panel, name).findAll(icon).find((x) => x.isVisible()).trigger('click'); await flushPromises(); };
afterEach(() => { wrappers.forEach((w) => w.unmount()); wrappers.length = 0; document.body.innerHTML = ''; });
it('project: renders properties and sends exact option, elevate, demote, remove, search/add and delete payloads from controls', async () => {
    const { w, calls } = setup(); await flushPromises(); expect(w.text()).toContain('02 Jan 2026 - 03:04:05'); expect(w.find('.c4-card-info button[title]').attributes('title')).toEqual('Move to admin group');
    for (const input of w.findAll('table input')) { await input.setValue(true); await flushPromises(); }
    expect(calls.filter((r) => r.url.includes('/groupoptions/')).map((r) => r.data)).toEqual(['sophomorixJoinable', 'sophomorixHidden', 'sophomorixMailList'].map((attribute) => ({ attribute, value: true, type: 'project' })));
    await click(w, '.c4-card-info', 'Mitglied', '.fa-level-up-alt');
    await click(w, '.c4-card-danger', 'Mitglied', '.fa-level-down-alt');
    await click(w, '.c4-card-info', 'member-group', '.fa-level-up-alt');
    await click(w, '.c4-card-danger', 'member-group', '.fa-level-down-alt');
    await click(w, '.c4-card-info', 'member-group', '.fa-trash');
    await click(w, '.c4-card-danger', 'admin-group', '.fa-trash');
    await click(w, '.c4-card-info', 'Mitglied', '.fa-trash');
    await click(w, '.c4-card-danger', 'Besitzer', '.fa-trash');
    const expected = [['removemembers', 'member'], ['addadmins', 'member'], ['addmembers', 'member'], ['removeadmins', 'member'], ['removemembergroups', 'member-group'], ['addadmingroups', 'member-group'], ['removeadmingroups', 'member-group'], ['addmembergroups', 'member-group'], ['removemembergroups', 'member-group'], ['removeadmingroups', 'admin-group'], ['removemembers', 'member'], ['removeadmins', 'owner']];
    await button(w, 'Add user or group').trigger('click');
    const searches = w.findAll('input[type=text]'); await searches[1].setValue('old'); await flushPromises(); await searches[1].trigger('blur');
    await searches[0].setValue('new'); await flushPromises(); await w.find('.dropdown-menu li').trigger('mousedown'); expect(searches.slice(0, 2).map((input) => input.element.value)).toEqual(['', '']);
    await searches[2].setValue('new'); await flushPromises(); expect(w.findAll('.dropdown-menu li').map((x) => x.text())).toEqual(['new-group']); await w.find('.dropdown-menu li').trigger('mousedown');
    await w.findAll('input[type=checkbox]').at(-1).setValue(true); await button(w, 'Apply').trigger('click'); await flushPromises();
    expected.push(['addadmins', 'new-user,'], ['addadmingroups', 'new-group,']);
    expect(calls.filter((r) => r.url.endsWith('/membership')).map((r) => r.data)).toEqual(expected.map(([action, entity]) => ({ action, entity, groupname: 'p73', type: 'project' })));
    await w.find('.c4-card-info .card-header a').trigger('click'); expect(w.find('.c4-card-info .card-body').isVisible()).toBe(false);
    // Original admin caption follows the MEMBER panel even while admins remain visible.
    expect(w.find('.c4-card-danger .card-header a').text()).toBe('Show');
    await w.find('.c4-card-danger .card-header a').trigger('click'); expect(w.find('.c4-card-danger .card-body').isVisible()).toBe(false);
    await button(w, 'Delete Project').trigger('click'); await flushPromises(); expect(calls.at(-1)).toEqual({ method: 'delete', url: '/api/lmn/groupmembership/projects/p73', data: undefined, cfg: undefined }); expect(w.emitted('close')).toEqual([[{ response: 'refresh' }]]);
});
it('class: removing a teacher issues both requests; selecting a teacher always adds admins and displays membership', async () => {
    const { w, calls } = setup('adminclass'); await flushPromises(); await click(w, '.c4-card-info', 'Mitglied', '.fa-trash');
    await button(w, 'Add user or group').trigger('click'); await w.find('input[type=text]').setValue('new'); await flushPromises(); await w.find('.dropdown-menu li').trigger('mousedown'); await button(w, 'Apply').trigger('click'); await flushPromises();
    expect(calls.filter((r) => r.url.endsWith('/membership')).map((r) => r.data)).toEqual([['removemembers', 'member'], ['removeadmins', 'member'], ['addadmins', 'new-user,']].map(([action, entity]) => ({ action, entity, groupname: 'p73', type: 'class' })));
    expect(w.find('.c4-card-info').text()).toContain('Neu Test'); expect(w.findAll('.c4-card-danger')[1].text()).toContain('Neu Test');
});
it('printer: LISTS users/groups, no maillist, group payloads and readonly teacher controls', async () => {
    const { w, calls } = setup('printer'); await flushPromises(); expect(w.findAll('table input')[2].isVisible()).toBe(false); expect(w.find('.c4-card-info').text()).toContain('nested-group');
    await click(w, '.c4-card-info', 'Mitglied', '.fa-trash'); await click(w, '.c4-card-info', 'nested-group', '.fa-trash');
    expect(calls.filter((r) => r.url.endsWith('/membership')).map((r) => r.data)).toEqual([['removemembers', 'member'], ['removemembergroups', 'nested-group']].map(([action, entity]) => ({ action, entity, groupname: 'p73', type: 'group' })));
    const readonly = setup('printer', { isAdmin: false }); await flushPromises(); expect(readonly.w.find('table input').element.disabled).toBe(true); expect(button(readonly.w, 'Add user or group').isVisible()).toBe(false);
});
