export function createAdmins(aj) {
    // Original actions have no local HTTP error toast; the shell handles transport errors.
    async function action(run) { try { await run(); } catch { /* Cancel/error keeps the current view. */ } }
    return {
        load: async level => (await aj.http.get(`/api/lmn/sophomorixUsers/${level}admins`)).data,
        binds: async level => (await aj.http.get(`/api/lmn/sophomorixUsers/bindusers/${level}`)).data,
        remove: (level, users, bind = false) => action(async () => {
            const names = users.map(user => user.sAMAccountName);
            await aj.messagebox.show({ title: aj.gettext('Delete User'), text: aj.gettext(`Delete ${level}${bind ? ' bind user ' : '-administrator '}${names}?`), positive: 'Delete', negative: 'Cancel' });
            await aj.http.patch(`/api/lmn/sophomorixUsers/${level}admins`, { users: names });
            aj.reload();
            aj.notify.success(aj.gettext('User deleted'));
        }),
        addBind: level => action(async () => {
            const result = await aj.messagebox.prompt(aj.gettext(`Login for new ${level} bind user`), '');
            const { data } = await aj.http.post(`/api/lmn/sophomorixUsers/bindusers/${level}`, { binduser: result.value });
            aj.notify.success(data);
            aj.reload();
        }),
        comment: user => action(async () => {
            const result = await aj.messagebox.prompt(aj.gettext('Edit comment'), user.sophomorixComment);
            await aj.http.post(`/api/lmn/sophomorixUsers/${user.sAMAccountName}/comment`, { comment: result.value });
            aj.reload();
        }),
        async add(role, username) {
            aj.notify.success(aj.gettext('Adding administrator...'));
            try {
                const { data } = await aj.http.post(`/api/lmn/sophomorixUsers/${role}s`, { users: [username] });
                if (data[0] === 'ERROR') aj.notify.error(data[1]);
                if (data[0] === 'LOG') aj.notify.success(aj.gettext(data[1]));
                aj.reload();
            } catch { /* Dialog was already dismissed, as in Angular. */ }
        },
    };
}
