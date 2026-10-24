import { ref, shallowRef } from 'vue';
import { entityPayload, readDetails } from './model.mjs';
const base = '/api/lmn/groupmembership/';
export function createDetails(aj, props, emit) {
    const state = shallowRef();
    const busy = ref(false), searchVisible = ref(false);
    const selection = shallowRef({ newUser: [], newGroup: [], addasadmin: false });
    const update = (fields) => { state.value = { ...state.value, ...fields }; };
    async function load() {
        try {
            const { data } = await aj.http.get(base + 'groups/' + props.groupName);
            const result = readDetails(data, props.groupType, props.groupName, aj.identity);
            if (result === null) { aj.notify.error(aj.gettext('Can not read properties of this project.')); emit('cancel'); return; }
            state.value = result;
        } catch { /* Original retains its loading state; adapter handles HTTP errors. */ }
    }
    async function changeOption(attribute, value) {
        busy.value = true;
        const field = { sophomorixJoinable: 'joinable', sophomorixHidden: 'hidden', sophomorixMailList: 'maillist' }[attribute];
        update({ [field]: value });
        try {
            const { data } = await aj.http.post(base + 'groupoptions/' + props.groupName, { attribute, value, type: state.value.type });
            aj.notify.success(aj.gettext(data));
        } catch (error) { aj.notify.error(aj.gettext(error.data.message)); }
        busy.value = false;
    }
    async function kill(type, name) {
        try { await aj.messagebox.show({ text: `Do you really want to delete '${name}'? This can't be undone!`, positive: 'Delete', negative: 'Cancel' }); }
        catch { return; }
        const progress = aj.messagebox.show({ progress: true });
        progress.catch(() => {});
        try {
            const { data } = await aj.http.delete(base + (type === 'project' ? 'projects/' : 'schoolclass/') + name);
            if (data[0] === 'ERROR') aj.notify.error(data[1]);
            if (data[0] === 'LOG') { aj.notify.success(aj.gettext(data[1])); emit('close', { response: 'refresh' }); }
        } catch { /* Original relies on the adapter HTTP error policy. */ }
        finally { progress.close(); }
    }
    const splice = (list, item) => list.filter((_, i) => i !== (list.indexOf(item) < 0 ? list.length - 1 : list.indexOf(item)));
    async function membership(action, entity, list) {
        const current = state.value[list];
        const payload = entityPayload(action, entity, current, props.groupName, state.value.type);
        if (!payload) return;
        busy.value = true;
        try {
            const { data } = await aj.http.post(base + 'membership', payload);
            if (data[0] === 'ERROR') aj.notify.error(data[1]);
            if (data[0] === 'LOG') {
                aj.notify.success(aj.gettext(data[1]));
                const existing = state.value[list];
                const added = Array.isArray(entity) ? entity.filter((item) => !existing.includes(item)) : [entity];
                update({ [list]: action.startsWith('remove') ? splice(existing, entity) : [...existing, ...added] });
                if (action === 'addadmins' && state.value.type === 'class') update({ members: [...state.value.members, ...(Array.isArray(entity) ? entity.filter((u) => !state.value.members.includes(u)) : [entity])] });
            }
            busy.value = false;
        } catch { /* Original leaves changeState true on transport failure. */ }
    }
    const methods = Object.fromEntries([
        ['Member', 'members', 'members'], ['Admin', 'admins', 'admins'], ['MemberGroup', 'membergroups', 'groupmemberlist'], ['AdminGroup', 'admingroups', 'groupadminlist'],
    ].flatMap(([suffix, action, list]) => ['add', 'remove'].map((verb) => [`${verb}${suffix}`, (entity) => membership(verb + action, entity, list)])));
    function removeTeacherClass(user) { methods.removeMember(user); methods.removeAdmin(user); }
    function demoteMember(user) {
        methods.addMember(user); methods.removeAdmin(user);
        if (user.login === aj.identity.user && !state.value.groupadminlist.includes(aj.identity.profile.sophomorixAdminClass)) update({ editGroup: false });
    }
    function demoteGroup(group) {
        methods.removeAdminGroup(group); methods.addMemberGroup(group);
        if (group === aj.identity.profile.sophomorixAdminClass && !state.value.admins.some((u) => u.login === aj.identity.user)) update({ editGroup: false });
    }
    function elevateMember(user) { methods.removeMember(user); methods.addAdmin(user); }
    function elevateGroup(group) { methods.removeMemberGroup(group); methods.addAdminGroup(group); }
    function addEntities() {
        searchVisible.value = false;
        const { newUser, newGroup, addasadmin } = selection.value;
        const asAdmin = state.value.type === 'class' || addasadmin;
        methods[asAdmin ? 'addAdmin' : 'addMember'](newUser);
        methods[asAdmin ? 'addAdminGroup' : 'addMemberGroup'](newGroup);
        selection.value = { newUser: [], newGroup: [], addasadmin: false };
    }
    return { state, busy, searchVisible, selection, load, changeOption, kill, ...methods, removeTeacherClass, demoteMember, demoteGroup, elevateMember, elevateGroup, addEntities };
}
