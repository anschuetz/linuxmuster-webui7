import { ref } from 'vue';
import { createSmbclient } from '../../common/smbclient.mjs';
const A = '/api/lmn/session/', M = '/api/lmn/smbclient/';
export const participantSorts = [
    { name: 'Lastname', value: u => u.sn + ' ' + u.givenName },
    { name: 'Login name', value: u => u.sAMAccountName },
    { name: 'Firstname', value: u => u.givenName },
    { name: 'Email', value: u => u.mail },
];
function compare(a, b) {
    const x = typeof a === 'string' ? a.toLowerCase() : a;
    const y = typeof b === 'string' ? b.toLowerCase() : b;
    if (x === y) return 0;
    if (typeof x !== typeof y) return typeof x < typeof y ? -1 : 1;
    return x < y ? -1 : 1;
}
export const sortedParticipants = (users, sort = 0) => users.map((user, index) => ({ user, index }))
    .sort((a, b) => compare(participantSorts[sort].value(a.user), participantSorts[sort].value(b.user)) || a.index - b.index).map(row => row.user);
export const sortedFiles = (items = []) => items.map((item, index) => ({ item, index }))
    .sort((a, b) => -compare(a.item.isDir, b.item.isDir) || compare(a.item.name, b.item.name) || a.index - b.index).map(row => row.item);
export const isStudent = user => ['student', 'examuser'].includes(user.sophomorixRole);

/** Detail runtime. Parts 3–5 reuse createWorkingDirectory/refreshUsers here.
 * Store arrays remain shared across routes; HTTP callbacks belong to this mount,
 * identity and store version. Replacing LDAP objects also replaces exam/missing
 * references so those groups retain the legacy object-identity relationship.
 */
export function createParticipants(aj, store) {
    const state = store.state, current = store.capture(), smb = createSmbclient(aj);
    const sessionChanged = ref(false), missingClasses = ref();
    let alive = true;
    const valid = () => alive && current();
    const error = text => aj.notify.error(text, undefined, { sticky: true });
    const background = promise => promise.catch(() => { /* Request errors already go through the shell interceptor. */ });
    function replaceReferences(replacements) {
        store.replaceMembers(state.current.members.map(user => replacements.get(user) ?? user));
    }
    async function add(names, single) {
        if (!names.length || !valid()) return false;
        const { data } = await aj.http.post(A + 'userinfo', { users: names });
        if (!valid()) return false;
        if (state.current.generated) sessionChanged.value = true;
        else background(aj.http.post(A + 'participants', { users: single ? [data[0].sAMAccountName] : names, session: state.current.sid }));
        state.current = { ...state.current, members: state.current.members.concat(data.map(user => ({ ...user }))) };
        await api.refreshUsers(); return true;
    }
    const api = {
        sessionChanged, missingClasses, isCurrent: valid,
        dispose() { alive = false; },
        async createWorkingDirectory(users) {
            if (!valid()) return;
            const { data } = await aj.http.post(M + 'createSessionWorkingDirectory', { users: users.filter(u => u.sophomorixAdminClass !== 'teachers').map(u => u.cn) });
            if (!valid()) return;
            if (data.global) error(data.global);
            // Legacy overwrites ERROR-teacher again in its response loop.
            const names = new Set(users.map(user => user.cn));
            const participants = state.current.members.filter(user => names.has(user.cn));
            const replacements = new Map(participants.map(user => [user, { ...user, files_error: Object.hasOwn(data, user.cn) ? 'NOTJOINED' : data.global || '' }]));
            replaceReferences(replacements);
            state.user_missing_membership = state.user_missing_membership.concat(participants.filter(u => Object.hasOwn(data, u.cn)).map(u => replacements.get(u)));
            if (missingClasses.value === undefined) missingClasses.value = [...new Set(state.user_missing_membership.map(u => u.sophomorixAdminClass))].join(',');
        },
        async refreshUsers() {
            if (!valid()) return;
            const { data } = await aj.http.post(A + 'userinfo', { users: state.current.members.map(u => u.cn) });
            if (!valid()) return;
            state.current = { ...state.current, members: data.map(user => ({ ...user })) };
            background(api.createWorkingDirectory(state.current.members)); store.filterExamUsers(); aj.navigate('/view/lmn/session');
        },
        addUser(user) {
            if (!valid()) return Promise.resolve(false);
            if (state.current.members.some(u => u.cn === user.sAMAccountName)) {
                aj.notify.success(user.sAMAccountName + aj.gettext(' is already member of the course.')); return Promise.resolve(false);
            }
            return add([user.sAMAccountName], true);
        },
        addClass(group) { return add(group.sophomorixMembers.filter(cn => !state.current.members.some(u => u.cn === cn)), false); },
        async remove(user) {
            if (!valid()) return;
            const index = state.current.members.indexOf(user); if (index === -1) return;
            if (state.current.generated) sessionChanged.value = true;
            else await aj.http.patch(A + 'participants', { users: [user.sAMAccountName], session: state.current.sid });
            if (valid()) state.current = { ...state.current, members: state.current.members.filter((u, i) => i !== index) };
        },
        async updateParticipants() {
            if (!valid()) return;
            const { data } = await aj.http.get(A + 'userInRoom');
            if (!valid() || data.usersList.length === 0) return;
            const response = await aj.http.post(A + 'userinfo', { users: data.usersList });
            if (valid()) state.current = { ...state.current, members: response.data.map(user => ({ ...user, computer: data.objects[user.cn].COMPUTER })) };
            // No workdir creation or exam-group recomputation in the legacy room poll.
        },
        async updateFileList() {
            if (!valid()) return;
            const participants = state.current.members.filter(u => u.files !== 'ERROR' && u.files !== 'ERROR-teacher');
            const { data } = await aj.http.post(M + 'listCollectDir', { participants });
            if (!valid()) return;
            const entries = Object.entries(data).flatMap(([cn, files]) => {
                const user = state.current.members.find(u => u.cn === cn); if (!user) return [];
                if (files.items === undefined) { error(aj.gettext('Can not list directory from ') + user.displayName + ': ' + files); return []; }
                return [[user, { ...user, files: files.items }]];
            });
            replaceReferences(new Map(entries));
        },
        async fixMembership() {
            if (!valid()) return;
            const { data } = await aj.http.post('/api/lmn/groupmembership/membership', { action: 'addadmins', entity: aj.identity.user, groupname: missingClasses.value, type: 'class' });
            if (!valid()) return;
            if (data[0] === 'ERROR') error(data[1]);
            if (data[0] === 'LOG') { aj.notify.success(aj.gettext(data[1])); await api.refreshKerberos(); }
        },
        async refreshKerberos() {
            if (!valid()) return;
            await smb.refresh_krbcc(); if (!valid()) return;
            for (const missing of [...state.user_missing_membership]) {
                const user = state.current.members.find(user => user.cn === missing.cn);
                if (!user) continue;
                const updated = { ...user, files: [] }; replaceReferences(new Map([[user, updated]]));
                background(api.createWorkingDirectory([updated]));
            }
            await aj.identity.refresh(); if (valid()) missingClasses.value = [];
        },
        async findUsers(query) { return find('user-search', query, 2); },
        async findClasses(query) { return find('schoolClass-search', query, 1); },
    };
    async function find(kind, query, minimum) {
        if (query.length < minimum || !valid()) return [];
        const { data } = await aj.http.get(A + kind + '/' + query);
        return valid() ? data.slice(0, 10) : [];
    }
    return api;
}
