import { describe, expect, it } from 'vitest';
import { selfPayload, visibleGroups, readDetails, entityPayload, formatDate } from './model.mjs';
const group = (name, extra = {}) => ({ groupname: name, sophomorixType: 'project', membership: false, ...extra });
describe('groupmembership original contracts', () => {
    it.each([
        ['printer', false, 'addmembers', 'group'], ['printer', true, 'removemembers', 'group'],
        ['adminclass', false, 'addadmins', 'class'], ['adminclass', true, 'removeadmins', 'class'],
        ['project', false, 'addmembers', 'project'], ['project', true, 'removeproject', 'project'],
    ])('maps self membership %s/%s', (sophomorixType, membership, action, type) => {
        expect(selfPayload(group('test', { sophomorixType, membership }), 'zem')).toEqual({ action, entity: 'zem', groupname: 'test', type });
    });
    it('sorts like Angular, searches all scalar fields including negation and hides nonmembers', () => {
        const groups = [group('Z', { description: 'Alpha' }), group('a'), group('hidden', { sophomorixHidden: true }), group('member', { sophomorixHidden: true, membership: true }), group('admin', { sophomorixHidden: true, admin: true })];
        expect(visibleGroups(groups, {}, '', 'groupname', false).map((g) => g.groupname)).toEqual(['a', 'admin', 'member', 'Z']);
        expect(visibleGroups(groups, {}, '!alpha', 'groupname', true).map((g) => g.groupname)).toEqual(['member', 'admin', 'a']);
        expect(visibleGroups(groups, { isAdmin: true }, 'hidden', 'membership', false).map((g) => g.groupname)).toEqual(['hidden']);
        expect(visibleGroups(undefined, {}, '')).toEqual([]);
    });
    it('uses LISTS for printers and ignores stale user references', () => {
        const data = { GROUP: { pr: { sophomorixType: 'printer', sophomorixAdmins: ['admin'], sophomorixAdminGroups: ['admins'], sophomorixMembers: ['wrong'], sophomorixMemberGroups: ['wrong'], sophomorixJoinable: 'TRUE', sophomorixHidden: 'FALSE', sophomorixMailList: 'TRUE' } }, LISTS: { MEMBERLIST: { pr: ['user', 'group', 'stale'] } }, MEMBERS: { pr: { user: { sn: 'User', givenName: 'Test', sAMAccountName: 'user', sophomorixAdminClass: '5a', sophomorixRole: 'student' }, group: { sn: 'null', sAMAccountName: '5b' }, admin: { sn: 'Admin', sAMAccountName: 'admin' } } } };
        expect(readDetails(data, 'printergroup', 'pr')).toEqual({ groupDetails: data.GROUP.pr, members: [{ sn: 'User', givenName: 'Test', login: 'user', sophomorixAdminClass: '5a', sophomorixRole: 'student' }], admins: [{ sn: 'Admin', givenName: undefined, login: 'admin', sophomorixAdminClass: undefined, sophomorixRole: undefined }], groupmemberlist: ['5b'], groupadminlist: ['admins'], joinable: true, hidden: false, maillist: true, type: 'group', editGroup: false, editMembers: false });
        expect(readDetails({}, 'project', 'missing')).toEqual(null);
        expect(data.LISTS.MEMBERLIST.pr).toEqual(['user', 'group', 'stale']);
    });
    it('preserves array login duplicate bug, trailing commas and group deduplication', () => {
        const user = { login: 'zem' };
        expect(entityPayload('addmembers', [user, { login: 'ba' }], [user], 'p', 'project')).toEqual({ action: 'addmembers', entity: 'zem,ba,', groupname: 'p', type: 'project' });
        expect(entityPayload('addadmins', user, [user], 'p', 'project')).toEqual(null);
        expect(entityPayload('addmembergroups', ['5a', '5b'], ['5a'], 'p', 'project')).toEqual({ action: 'addmembergroups', entity: '5b,', groupname: 'p', type: 'project' });
        expect(entityPayload('addadmingroups', '5a', [], 'p', 'project')).toEqual({ action: 'addadmingroups', entity: '5a', groupname: 'p', type: 'project' });
        expect(entityPayload('removemembers', user, [user], 'p', 'project')).toEqual({ action: 'removemembers', entity: 'zem', groupname: 'p', type: 'project' });
    });
    it('formats local Sophomorix timestamps, undefined and unset epoch as the old date filter', () => {
        expect(formatDate('19700101000000.0Z')).toEqual('');
        expect(formatDate(undefined)).toEqual('undefined');
        expect(formatDate('20260102030405.0Z')).toEqual('02 Jan 2026 - 03:04:05');
    });
});
it.each([
    ['schoolclass', { isAdmin: true }, [], [], true],
    ['project', { projects: [] }, ['zem'], [], true],
    ['project', { sophomorixAdminClass: 'teachers', projects: [] }, [], ['teachers'], true],
    ['project', { sophomorixAdminClass: 'teachers', projects: ['p73-admin'] }, [], ['p73-admin'], true],
    ['project', { sophomorixAdminClass: 'teachers', projects: [] }, [], ['other'], false],
    ['schoolclass', { projects: [] }, ['zem'], [], false],
    ['printergroup', { projects: [] }, ['zem'], [], false],
])('preserves %s detail permissions from the shell profile', (groupType, profile, admins, adminGroups, allowed) => {
    const data = { GROUP: { p73: { sophomorixType: groupType === 'printergroup' ? 'printer' : groupType === 'schoolclass' ? 'adminclass' : 'project', sophomorixMembers: [], sophomorixMemberGroups: [], sophomorixAdmins: admins, sophomorixAdminGroups: adminGroups } }, MEMBERS: { p73: { zem: { sn: 'Test', sAMAccountName: 'zem' } } }, LISTS: { MEMBERLIST: { p73: [] } } };
    const detail = readDetails(data, groupType, 'p73', { user: 'zem', profile });
    expect([detail.editGroup, detail.editMembers]).toEqual([allowed, allowed]);
});
