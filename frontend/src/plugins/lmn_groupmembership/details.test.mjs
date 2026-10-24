import { expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createDetails } from './details.mjs';
const user = { login: 'zem', sn: 'Test', givenName: 'Lehrer' };
function setup(type = 'project', result = ['LOG', 'ok']) {
    const aj = { identity: { user: 'zem', profile: { sophomorixAdminClass: 'teachers' } }, gettext: (s) => s, notify: { success: vi.fn(), error: vi.fn() }, http: { post: vi.fn(async () => ({ data: result })), delete: vi.fn(async () => ({ data: result })) }, messagebox: { show: vi.fn(() => Object.assign(Promise.resolve(), { close: vi.fn() })) } };
    const emit = vi.fn(), d = createDetails(aj, { groupType: type, groupName: 'p73' }, emit);
    d.state.value = { type, members: [user], admins: [user], groupmemberlist: ['5a'], groupadminlist: ['5b'], editGroup: true, editMembers: true };
    return { aj, d, emit };
}
it.each([
    ['addMember', [{ login: 'ba' }], 'addmembers', 'ba,'], ['removeMember', user, 'removemembers', 'zem'],
    ['addAdmin', { login: 'ba' }, 'addadmins', 'ba'], ['removeAdmin', user, 'removeadmins', 'zem'],
    ['addMemberGroup', ['5a', '5c'], 'addmembergroups', '5c,'], ['removeMemberGroup', '5a', 'removemembergroups', '5a'],
    ['addAdminGroup', '5c', 'addadmingroups', '5c'], ['removeAdminGroup', '5b', 'removeadmingroups', '5b'],
])('%s preserves payload and updates the correct list only on LOG', async (method, entity, action, serialized) => {
    const { d, aj } = setup(); await d[method](entity);
    expect(aj.http.post.mock.calls).toEqual([['/api/lmn/groupmembership/membership', { action, entity: serialized, groupname: 'p73', type: 'project' }]]);
    expect(d.busy.value).toBe(false); expect(aj.notify.success.mock.calls).toEqual([['ok']]);
    const failed = setup('project', ['ERROR', 'bad']); const before = failed.d.state.value; await failed.d[method](entity); expect(failed.d.state.value).toEqual(before); expect(failed.aj.notify.error.mock.calls).toEqual([['bad']]);
});
it('preserves dual requests and class teacher display side effects', async () => {
    const { d, aj } = setup('class'); d.state.value = { ...d.state.value, admins: [], members: [] }; await d.addAdmin(user);
    expect(d.state.value.members).toEqual([user]); expect(d.state.value.admins).toEqual([user]);
    d.removeTeacherClass(user); await flushPromises(); expect(aj.http.post.mock.calls.map((c) => c[1].action)).toEqual(['addadmins', 'removemembers', 'removeadmins']);
});
it('preserves elevate/demote dual requests and immediate self permission loss', async () => {
    const { d, aj } = setup(); d.demoteMember(user); await flushPromises(); expect(d.state.value.editGroup).toBe(false);
    d.elevateMember(user); d.demoteGroup('teachers'); d.elevateGroup('5a'); await flushPromises();
    expect(aj.http.post.mock.calls.map((c) => c[1].action)).toEqual(['removeadmins', 'removemembers', 'addadmins', 'removeadmingroups', 'addmembergroups', 'removemembergroups', 'addadmingroups']);
});
it('adds selected users/groups as class admins, clears selection on Apply, leaves duplicates in array login payload', async () => {
    const { d, aj } = setup('class'); d.selection.value = { newUser: [user], newGroup: ['5c'], addasadmin: false }; d.addEntities(); await flushPromises();
    expect(aj.http.post.mock.calls.map((c) => c[1])).toEqual([{ action: 'addadmins', entity: 'zem,', groupname: 'p73', type: 'class' }, { action: 'addadmingroups', entity: '5c,', groupname: 'p73', type: 'class' }]);
    expect(d.selection.value).toEqual({ newUser: [], newGroup: [], addasadmin: false });
});
it.each(['sophomorixJoinable', 'sophomorixHidden', 'sophomorixMailList'])('posts %s and reports option errors while releasing spinner', async (attribute) => {
    const { d, aj } = setup(); await d.changeOption(attribute, true); expect(aj.http.post.mock.calls[0]).toEqual(['/api/lmn/groupmembership/groupoptions/p73', { attribute, value: true, type: 'project' }]);
    aj.http.post.mockRejectedValueOnce({ data: { message: 'failed' } }); await d.changeOption(attribute, false); expect(aj.notify.error.mock.calls).toEqual([['failed']]); expect(d.busy.value).toBe(false);
});
it('delete handles cancellation, ERROR, LOG, HTTP failure and closes wait', async () => {
    const { d, aj, emit } = setup(); await d.kill('project', 'p73'); expect(aj.http.delete.mock.calls).toEqual([['/api/lmn/groupmembership/projects/p73']]); expect(emit.mock.calls).toEqual([['close', { response: 'refresh' }]]);
    aj.messagebox.show.mockRejectedValueOnce('cancel'); await d.kill('project', 'p73'); expect(aj.http.delete.mock.calls).toHaveLength(1);
    aj.http.delete.mockResolvedValueOnce({ data: ['ERROR', 'bad'] }); await d.kill('class', '5a'); expect(aj.notify.error.mock.calls).toEqual([['bad']]);
    aj.http.delete.mockRejectedValueOnce(new Error('HTTP')); await d.kill('class', '5a'); expect(emit.mock.calls).toHaveLength(1);
});
it('preserves busy state on membership HTTP rejection, avoids empty duplicate requests', async () => {
    const { d, aj } = setup(); await d.addMember(user); expect(aj.http.post.mock.calls).toEqual([]);
    aj.http.post.mockRejectedValueOnce(new Error('HTTP')); await d.removeMember(user); expect(d.busy.value).toBe(true);
});
