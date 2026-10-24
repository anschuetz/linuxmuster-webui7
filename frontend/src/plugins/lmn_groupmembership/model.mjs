const types = { printer: 'group', adminclass: 'class', project: 'project' };
export function selfPayload(group, user) {
    const actions = { printer: ['addmembers', 'removemembers'], adminclass: ['addadmins', 'removeadmins'], project: ['addmembers', 'removeproject'] };
    return { action: actions[group.sophomorixType][Number(Boolean(group.membership))], entity: user, groupname: group.groupname, type: types[group.sophomorixType] };
}
function matches(value, query) {
    if (query.startsWith('!')) return !matches(value, query.slice(1));
    if (Array.isArray(value)) return value.some((item) => matches(item, query));
    if (value && typeof value === 'object') return Object.entries(value).some(([key, item]) => !key.startsWith('$') && matches(item, query));
    return value !== undefined && value !== null && String(value).toLowerCase().includes(query.toLowerCase());
}
export function visibleGroups(groups, profile, query = '', field = 'groupname', reverse = false, includeHidden = false) {
    return (groups ?? []).map((group, index) => ({ group, index })).sort(({ group: a, index: aIndex }, { group: b, index: bIndex }) => {
        const x = typeof a[field] === 'string' ? a[field].toLowerCase() : a[field];
        const y = typeof b[field] === 'string' ? b[field].toLowerCase() : b[field];
        return (x === y ? aIndex - bIndex : x < y ? -1 : 1) * (reverse ? -1 : 1);
    }).map(({ group }) => group).filter((g) => (includeHidden || !(g.sophomorixHidden && !g.admin && !profile.isAdmin && !g.membership)) && matches(g, query));
}
const member = (m) => ({ sn: m.sn, givenName: m.givenName, login: m.sAMAccountName, sophomorixAdminClass: m.sophomorixAdminClass, sophomorixRole: m.sophomorixRole });
export function readDetails(data, groupType, groupName, identity = { profile: {} }) {
    if (!Object.hasOwn(data, 'GROUP')) return null;
    const groupDetails = data.GROUP[groupName];
    const printer = groupType === 'printergroup';
    const logins = printer ? (data.LISTS.MEMBERLIST[groupName] || []) : groupDetails.sophomorixMembers;
    const found = logins.map((login) => data.MEMBERS[groupName][login]).filter((m) => m !== undefined);
    // P73 oracle: the old shell supplies window.identity despite missing DI.
    // Use its adapter snapshot; no ReferenceError occurs in the original on E.
    const editGroup = Boolean(identity.profile.isAdmin || (groupType === 'project' && (
        groupDetails.sophomorixAdmins.includes(identity.user) || groupDetails.sophomorixAdminGroups.includes(identity.profile.sophomorixAdminClass) ||
        identity.profile.projects?.some((project) => groupDetails.sophomorixAdminGroups.includes(project))
    )));
    return {
        groupDetails,
        members: found.filter((m) => m.sn !== 'null').map(member),
        admins: groupDetails.sophomorixAdmins.map((login) => member(data.MEMBERS[groupName][login])),
        groupmemberlist: printer ? found.filter((m) => m.sn === 'null').map((m) => m.sAMAccountName) : [...groupDetails.sophomorixMemberGroups],
        groupadminlist: [...groupDetails.sophomorixAdminGroups],
        joinable: groupDetails.sophomorixJoinable === 'TRUE', hidden: groupDetails.sophomorixHidden === 'TRUE', maillist: groupDetails.sophomorixMailList === 'TRUE',
        type: types[groupDetails.sophomorixType], editGroup, editMembers: editGroup,
    };
}
export function entityPayload(action, entity, existing, groupname, type) {
    const groups = action.endsWith('groups');
    let value;
    if (action.startsWith('remove')) value = groups ? entity : entity.login;
    else if (Array.isArray(entity)) {
        // Original checks user.login on the ARRAY (undefined), then appends each
        // login with a trailing comma. Preserve that duplicate-check bug.
        value = entity.filter((item) => groups ? !existing.includes(item) : !existing.some((u) => u.login === entity.login)).map((item) => `${groups ? item : item.login},`).join('');
    } else value = (groups ? !existing.includes(entity) : !existing.some((u) => u.login === entity.login)) ? (groups ? entity : entity.login) : '';
    return value ? { action, entity: value, groupname, type } : null;
}
export function formatDate(date) {
    if (date === '19700101000000.0Z') return '';
    if (date === undefined) return 'undefined';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const value = new Date(Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)), Number(date.slice(8, 10)), Number(date.slice(10, 12)), Number(date.slice(12, 14)));
    const pad = (number) => String(number).padStart(2, '0');
    return `${pad(value.getDate())} ${months[value.getMonth()]} ${value.getFullYear()} - ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
}
