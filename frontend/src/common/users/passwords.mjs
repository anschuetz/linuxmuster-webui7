import ShowPassword from './ShowPassword.vue';
import CustomPassword from './CustomPassword.vue';

// Shared by users and session_new. Targets stay unchanged for writes; only
// ShowPassword maps an exam login to its base account for reading first secrets.
export function createPasswords(aj, { download = url => { window.location.href = url; } } = {}) {
    const change = async (action, users, title) => {
        try {
            await aj.http.post(`/api/lmn/users/passwords/${action}`, { users });
            aj.notify.success(aj.gettext(title), undefined, { sticky: true });
        } catch (error) {
            aj.notify.error(aj.gettext('Password change failed: ') + (error.data?.message ?? ''), undefined, { sticky: true });
        }
    };
    const service = {
        showFirstPassword: username => aj.modal.open(ShowPassword, { username }, { backdrop: 'static', keyboard: false }),
        setCustomPassword: (users, pwtype) => aj.modal.open(CustomPassword, { users, pwtype }),
        resetFirstPassword: users => change('reset-first', users, 'Initial password set'),
        setRandomFirstPassword: users => change('set-random', users, 'Random password set'),
        batchPasswords(userlist, cmd) {
            const users = userlist.filter(user => user.selected);
            const usernames = users.flatMap(user => user.sAMAccountName).join(',').trim();
            if (cmd === 'reset-first') return service.resetFirstPassword(usernames);
            if (cmd === 'random-first') return service.setRandomFirstPassword(usernames);
            if (cmd === 'custom-first') return service.setCustomPassword(users, 'first');
        },
        async printSelectedPasswords(userlist) {
            const wait = aj.messagebox.show({ progress: true });
            wait.catch(() => {}); // Dismissal does not cancel the original print request.
            const users = userlist.flatMap(user => user.selected ? user.sAMAccountName : []).join(',').trim();
            try {
                const response = await aj.http.post('/api/lmn/users/passwords/print', { users });
                if (response.data.startsWith('user-')) {
                    aj.notify.success(aj.gettext('PDF with passwords successfully created'));
                    download(`/api/lmn/users/passwords/download/${response.data}`);
                } else aj.notify.error(aj.gettext('Could not create password pdf'));
            } catch {
                aj.notify.error(aj.gettext('Could not create password pdf'));
            } finally { wait.close(); }
        },
    };
    return service;
}
