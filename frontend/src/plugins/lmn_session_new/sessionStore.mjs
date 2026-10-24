import { getCurrentScope, shallowReactive, watch } from 'vue';
const emptyCurrent = () => ({ sid: '', name: '', generated: false, members: [], type: '' });

/**
 * Plugin-local singleton, shared by both route mounts; never shared with Angular.
 * Parts 2–5 consume state.current (LDAP member objects), examUsers/extExamUsers,
 * examMode and user_missing_membership. Replace current/members when updating.
 * Detail owns filePolling {active,start,stop,dispose}, clearing it on unmount.
 * capture() invalidates async detail responses after reset/identity/SID changes.
 * Adapter binding is renewed at each mount; identity changes invalidate requests.
 */
const state = shallowReactive({ current: emptyCurrent(), examUsers: [], extExamUsers: [], examMode: false, user_missing_membership: [], filePolling: undefined });
let identity, adapter, version = 0;
function stopFiles() { state.filePolling?.dispose(); state.filePolling = undefined; }
function clear(user) {
    stopFiles();
    identity = user; version += 1;
    Object.assign(state, { current: emptyCurrent(), examUsers: [], extExamUsers: [], examMode: false, user_missing_membership: [] });
}
function filterExamUsers() {
    const { members } = state.current;
    state.extExamUsers = members.filter(user => user.examMode && user.examTeacher !== identity);
    state.examUsers = members.filter(user => user.examTeacher === identity);
    state.examMode = state.examUsers.length === members.length;
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
