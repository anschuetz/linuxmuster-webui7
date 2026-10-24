const fields = ['sAMAccountName', 'givenName', 'sn', 'sophomorixAdminClass'];
function matchesValue(value, query) {
    if (query.startsWith('!')) return !matchesValue(value, query.slice(1));
    if (value == null) return false;
    if (typeof value === 'object') return Object.entries(value).some(([key, item]) => !key.startsWith('$') && matchesValue(item, query));
    return String(value).toLowerCase().includes(query);
}
export function matchesUser(user, query, role) {
    const term = (query || '').toLowerCase();
    if (role === 'students') return matchesValue(user, term);
    return fields.slice(0, role === 'teachers' ? 3 : 4).some(key => user[key] != null && user[key].toLowerCase().includes(term));
}
// Original selectAll is intentionally narrower than student search and wider
// than teacher search. It visits every matching source row, including other pages.
export function selectUsers(users, query, selected) {
    const term = (query || '').toLowerCase();
    return users.map(user => {
        const matches = fields.map(key => user[key].toLowerCase().includes(term)).some(Boolean);
        return matches ? { ...user, selected } : user;
    });
}
function compare(a, b) {
    const type = value => value === null ? 'null' : typeof value;
    const at = type(a), bt = type(b);
    if (at !== bt) return at === 'undefined' || (at === 'null' && bt !== 'undefined') ? 1 : bt === 'undefined' || bt === 'null' ? -1 : at < bt ? -1 : 1;
    const left = at === 'string' ? a.toLowerCase() : a;
    const right = bt === 'string' ? b.toLowerCase() : b;
    return left === right ? 0 : left < right ? -1 : 1;
}
export function sortedUsers(users, key) {
    const value = user => key === 'sophomorixStatus.tag' ? user.sophomorixStatus?.tag : user[key];
    return users.map((user, index) => ({ user, index })).sort((a, b) => -compare(a.user._isNew, b.user._isNew) || compare(value(a.user), value(b.user)) || a.index - b.index).map(item => item.user);
}
export function pageUsers(users, role, query, key, page, size) {
    if (!size) return [];
    return sortedUsers(users.filter(user => matchesUser(user, query, role)), key).slice((page - 1) * size, page * size);
}
export const sortOptions = role => [
    ...(role === 'teachers' ? [] : [['sophomorixAdminClass', 'Class']]),
    ['givenName', 'First name'], ['sn', 'Last name'],
    ...(role === 'teachers' ? [['sAMAccountName', 'Login']] : []),
    ['sophomorixBirthdate', 'Birthday'], ['sophomorixStatus.tag', 'Status'],
];
export function createUsers(aj) {
    return {
        load: async role => (await aj.http.get(`/api/lmn/sophomorixUsers/${role}`)).data,
        async quotas(users) {
            const responses = await Promise.all(users.map(user => aj.http.get(`/api/lmn/quota/usermap/${user.sAMAccountName}`)));
            return Object.fromEntries(responses.map(({ data }) => { const login = Object.keys(data)[0]; return [login, data[login]]; }));
        },
        // Legacy parents controller action has no template button. Preserve it
        // for callers/oracle without introducing an additional deletion control.
        async killParent(user) {
            try {
                await aj.messagebox.show({ title: aj.gettext('Kill user ' + user), text: aj.gettext(`Do you really want to definitively remove the user ${user}? This action is uncoverable.`), positive: 'Yes, definitively remove', negative: 'Cancel' });
            } catch { return; /* Cancel never writes. */ }
            try {
                const { data } = await aj.http.post('/api/lmn/sophomorixUsers/killuser', { user });
                if (data === true) {
                    aj.notify.success(aj.gettext(`User ${user} successfully deleted!`));
                    await aj.messagebox.show({ title: aj.gettext('Clean up parents.csv'), text: aj.gettext('The user account was deleted but you will have to manually remove the corresponding line in the file parents.csv.'), positive: 'OK, I understand' });
                } else aj.notify.error(`There was an error during the process. Please try manually to execute the command 'sophomorix-kill --kill ${user}' to get more informations.`);
            } catch { /* HTTP errors belong to the shell; the original retains rows. */ }
        },
    };
}
