import { openWait } from '../../common/wait.mjs';
import { isStudent } from './participants.mjs';
const A = '/api/lmn/session/';
export const managementGroups = ['wifi', 'internet', 'printing'];

/** Legacy exam timing is deliberate: rejected exam requests leave the wait/busy
 * state in place; single/mixed stops neither set busy nor stop file polling.
 * Mount/identity guards prevent late confirmations or subsequent serial writes.
 */
export function createExam(aj, store, participants) {
    const state = store.state; state.stateChanged = false;
    state.examViewGroups = { own: state.examUsers, external: state.extExamUsers };
    let alive = true, waiting;
    const current = () => alive && participants.isCurrent();
    const management = Object.fromEntries(managementGroups.map(group => [group, state.current.members.every(user => user[group] === true)]));
    const background = promise => promise.catch(() => { /* HTTP errors are reported by the shell, including unawaited legacy refreshes. */ });
    async function confirm(text, positive, status) {
        if (!current()) return false;
        await aj.messagebox.show({ text: aj.gettext(text), positive: aj.gettext(positive), negative: aj.gettext('Cancel') });
        if (!current()) return false;
        waiting = openWait(aj, { status }); return true;
    }
    async function getExamUsers(single) {
        const users = state.current.members.map(user => user.cn);
        if (single) {
            const position = users.indexOf(single);
            // Preserve splice(-1,1) when the legacy account lookup misses.
            const members = [...state.current.members]; members.splice(position, 1);
            state.current = { ...state.current, members };
        }
        const { data } = await aj.http.post(A + 'exam/userinfo', { users: single ? [single] : users });
        if (!current()) return;
        state.current = { ...state.current, members: single ? state.current.members.concat({ ...data[0] }) : data.map(user => ({ ...user })) };
        // The old controller updates examMode here, but retains its old exam-array references for the header.
        background(participants.createWorkingDirectory(state.current.members)); store.filterExamUsers({ keepMenu: true }); aj.navigate('/view/lmn/session');
    }
    const stopUser = user => aj.http.patch(A + 'exam/stop', { session: {
        members: [user], name: `${user.sophomorixAdminClass}_${user.sAMAccountName}_ENDED_FROM_${aj.identity.user}`, type: '',
    } });
    async function managementRequest(group, users) {
        try {
            await aj.http.post('/api/lmn/managementgroup', { group, users });
            if (current()) aj.notify.success(`Group ${group} changed for ${users.join()}`);
        } catch (err) {
            if (current()) aj.notify.error(err.data.message, undefined, { sticky: true });
        }
        if (current()) state.stateChanged = false;
    }
    return {
        dispose() { alive = false; waiting?.close(); },
        async startExam(user) {
            if (state.examMode && !user) return;
            if (!await confirm('Do you really want to start a new exam?', 'Start exam mode', 'Starting exam mode ...')) return;
            const wait = waiting; state.stateChanged = true;
            await aj.http.patch(A + 'exam/start', { session: user ? { members: [{ cn: user }] } : state.current });
            if (!current()) return;
            state.stateChanged = false; await getExamUsers(user);
            if (current()) { store.stopFilePolling(); wait.close(); }
        },
        async stopExam() {
            if (!state.examMode) return;
            if (!await confirm('Do you really want to end the current exam?', 'End exam mode', 'Stopping exam mode ...')) return;
            const wait = waiting; state.stateChanged = true; state.examMode = false;
            const request = aj.http.patch(A + 'exam/stop', { session: state.current });
            store.stopFilePolling(); await request;
            if (!current()) return;
            background(participants.refreshUsers()); state.stateChanged = false; wait.close();
        },
        async stopUserExam(user) {
            if (!await confirm(`Do you really want to remove ${user.displayName} from the exam of ${user.examTeacher}?`, 'End exam mode', 'Stopping exam mode ...')) return;
            const wait = waiting; await stopUser(user);
            if (!current()) return;
            await participants.refreshUsers();
            if (current()) { wait.close(); aj.notify.success(aj.gettext('Exam mode stopped for user ') + user.displayName); }
        },
        async stopRunningExams() {
            if (!await confirm('Do you really want to end all running exams?', 'End exam mode', 'Stopping exam mode ...')) return;
            const wait = waiting;
            for (const user of [...state.examViewGroups.external, ...state.examViewGroups.own]) {
                if (!current()) return;
                await stopUser(user);
            }
            if (!current()) return;
            background(participants.refreshUsers()); wait.close(); aj.notify.success(aj.gettext('Exam mode stopped for all users.'));
        },
        setManagementGroup(group, participant) {
            if (!current()) return;
            state.stateChanged = true;
            return managementRequest(participant[group] === true ? 'no' + group : group, [participant.sAMAccountName]);
        },
        setManagementGroupAll(group) {
            if (!current()) return;
            state.stateChanged = true; management[group] = !management[group];
            store.replaceMembers(state.current.members.map(user => isStudent(user) ? { ...user, [group]: management[group] } : user));
            return managementRequest(management[group] === false ? 'no' + group : group, state.current.members.filter(isStudent).map(user => user.sAMAccountName));
        },
    };
}
