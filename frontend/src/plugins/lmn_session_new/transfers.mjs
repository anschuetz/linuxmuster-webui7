import { createSmbclient } from '../../common/smbclient.mjs';
import FileSelectDialog from './FileSelectDialog.vue';
import { isStudent } from './participants.mjs';

export const collectStamp = date => `${date.getFullYear()}${[date.getMonth() + 1, date.getDate()].map(n => String(n).padStart(2, '0')).join('')}-${[date.getHours(), date.getMinutes(), date.getSeconds()].map(n => String(n).padStart(2, '0')).join('')}`;

/** Session-specific paths and sequential transfers; SMB/Flow stay shared.
 * Part 4 owns exam transitions; this part consumes the store's foreign-exam list.
 */
export function createTransfers(aj, store, participants, now = () => new Date()) {
    const smb = createSmbclient(aj), state = store.state;
    const current = () => participants.isCurrent();
    const choose = (path, printPath, action, user) => aj.modal.open(FileSelectDialog, { path, printPath, action, user });
    const background = promise => promise.catch(() => { /* Core HTTP interceptor owns errors, as for the legacy unawaited directory request. */ });
    function blocked() {
        if (!current()) return true;
        if (!(state.examViewGroups?.external ?? state.extExamUsers).length) return false;
        background(aj.messagebox.show({ title: aj.gettext('User(s) in exam'), text: aj.gettext('This functionality can not be used when some users are in exam mode with another teacher.'), positive: 'OK' }));
        return true;
    }
    function destination() {
        return `${aj.identity.profile.homeDirectory}\\transfer\\collected\\${state.current.type}_${state.current.name}_${collectStamp(now())}`;
    }
    async function share(user, items) {
        const target = `${user.homeDirectory}\\transfer\\${aj.identity.profile.sAMAccountName}`;
        for (const item of items) {
            if (!current()) return;
            await smb.copy(item.path, target + '/' + item.name, false);
            if (current()) aj.notify.success(aj.gettext(`File ${item.name} shared to ${user.sAMAccountName}!`));
        }
    }
    async function collect(command, items, target) {
        if (!['copy', 'move'].includes(command)) return;
        for (const item of items) {
            if (!current()) return;
            await smb[command](item.path, target + '/' + item.name, false);
        }
    }
    const api = {
        async shareUser(user) {
            if (!current()) return;
            const result = await choose(`${aj.identity.profile.homeDirectory}\\transfer`, 'transfer', 'share', user.sAMAccountName);
            if (current() && result?.response === 'accept') await share(user, result.items);
        },
        async shareAll() {
            if (blocked()) return;
            const result = await choose(`${aj.identity.profile.homeDirectory}\\transfer`, 'transfer', 'share', 'all');
            if (!current() || result?.response !== 'accept') return;
            for (const user of state.current.members) if (isStudent(user)) await share(user, result.items);
        },
        async collectAll(command) {
            if (blocked()) return;
            const target = destination();
            background(smb.createDirectory(target));
            for (const user of state.current.members) {
                if (isStudent(user)) await collect(command, [{ path: `${user.homeDirectory}\\transfer\\${aj.identity.user}\\_collect`, name: '' }], target + '\\' + user.sAMAccountName);
            }
            if (!current()) return;
            // Both copy and move recreate the directories in the original.
            background(participants.createWorkingDirectory(state.current.members).then(() => {
                if (current()) participants.missingClasses.value = state.user_missing_membership.map(user => user.sophomorixAdminClass).join(',');
            }));
            aj.notify.success(aj.gettext('Files collected!'));
        },
        async collectUser(command, user) {
            if (!current()) return;
            const target = destination() + '\\' + user.sAMAccountName;
            background(smb.createDirectory(target));
            const result = await choose(`${user.homeDirectory}\\transfer\\${aj.identity.user}\\_collect`, `transfer/${aj.identity.user}/_collect`, command, user.sAMAccountName);
            if (!current() || result?.response !== 'accept') return;
            await collect(command, result.items, target);
            if (current()) aj.notify.success(aj.gettext('Files collected!'));
        },
        browseCollected() {
            if (!current()) return;
            const path = `${aj.identity.profile.homeDirectory}\\transfer\\collected`;
            return choose(path, path, '', '');
        },
    };
    return api;
}
