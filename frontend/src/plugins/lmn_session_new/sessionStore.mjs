import { getCurrentScope, shallowReactive, watch } from 'vue';
const emptyCurrent = () => ({ sid: '', name: '', generated: false, members: [], type: '' });

/**
 * Plugin-local singleton, shared by both route mounts; never shared with Angular.
 * Parts 2–5 consume state.current (LDAP member objects), examUsers/extExamUsers,
 * examMode and user_missing_membership. Replace current/members when updating.
 * examViewGroups retains the controller group references until a regular refresh.
 * Detail owns filePolling {active,start,stop,dispose}, clearing it on unmount.
 * capture() invalidates async detail responses after reset/identity/SID changes.
 * Adapter binding is renewed at each mount; identity changes invalidate requests.
 */
const state = shallowReactive({ current: emptyCurrent(), examUsers: [], extExamUsers: [], examMode: false, examViewGroups: undefined, stateChanged: false, user_missing_membership: [], filePolling: undefined });
let identity, adapter, version = 0;
function stopFiles() { state.filePolling?.dispose(); state.filePolling = undefined; }
function clear(user) {
    stopFiles();
    identity = user; version += 1;
    Object.assign(state, { current: emptyCurrent(), examUsers: [], extExamUsers: [], examMode: false, examViewGroups: undefined, stateChanged: false, user_missing_membership: [] });
}
function filterExamUsers({ keepMenu = false } = {}) {
    const { members } = state.current;
    state.extExamUsers = members.filter(user => user.examMode && user.examTeacher !== identity);
    state.examUsers = members.filter(user => user.examTeacher === identity);
    state.examMode = state.examUsers.length === members.length;
    if (!keepMenu) state.examViewGroups = { own: state.examUsers, external: state.extExamUsers };
}
async function startResolved(current, users, pendingCurrent) {
    const aj = adapter, owner = identity;
    store.reset(); if (pendingCurrent) state.current = pendingCurrent;
    const requestVersion = version;
    const { data } = await aj.http.post('/api/lmn/session/userinfo', { users });
    if (requestVersion !== version || aj.identity.user !== owner) return;
    state.current = { ...(typeof current === 'function' ? current() : current), members: data.map(user => ({ ...user })) };
    filterExamUsers(); aj.navigate('/view/lmn/session');
}
const store = {
    state,
    reset() { stopFiles(); version += 1; state.current = emptyCurrent(); },
    filterExamUsers,
    stopFilePolling() { state.filePolling?.stop(); },
    replaceMembers(members) {
        const replacements = new Map(state.current.members.map((user, i) => [user, members[i]]));
        const replace = rows => rows.map(user => replacements.get(user) ?? user);
        state.current = { ...state.current, members };
        state.examUsers = replace(state.examUsers); state.extExamUsers = replace(state.extExamUsers);
        state.user_missing_membership = replace(state.user_missing_membership);
        if (state.examViewGroups) state.examViewGroups = { own: replace(state.examViewGroups.own), external: replace(state.examViewGroups.external) };
    },
    capture() {
        const requestVersion = version, owner = identity, sid = state.current.sid, aj = adapter;
        return () => requestVersion === version && aj.identity.user === owner && state.current.sid === sid;
    },
    start: session => startResolved({ ...session, generated: false, type: 'group' }, [...session.members], { ...session, members: [...session.members] }),
    startGenerated: (name, members, type) => startResolved(() => ({ sid: Date.now(), name, generated: true, type }), [...members]),
    enterDetail() {
        if (state.current.sid !== '') return true;
        adapter.navigate('/view/lmn/sessionsList'); return false;
    },
};
export function getSessionStore(aj) {
    adapter = aj;
    if (identity !== aj.identity.user) clear(aj.identity.user);
    // Vue owns the watcher, so route destruction cannot retain a dead adapter.
    if (getCurrentScope()) watch(() => aj.identity.user, user => {
        if (identity !== user) clear(user);
    }, { flush: 'sync' });
    return store;
}

// A SPA logout must clear the cache that the old full-page logout discarded.
export function resetSession() { clear(undefined); adapter = undefined; }
