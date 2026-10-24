export const mapCustomRole = role => ({ schooladmins: 'schooladministrators', globaladmins: 'globaladministrators' })[role] ?? role;
const lists = ['proxyAddresses', ...[1, 2, 3, 4, 5].map(n => `sophomorixCustomMulti${n}`)];
export const isListAttr = attr => lists.includes(attr);
export const customDisplayOptions = ['', 'proxyAddresses', ...[1, 2, 3, 4, 5].map(n => `sophomorixCustom${n}`), ...lists.slice(1)];

export function createCustomFields(aj) {
    const loadConfig = async (role = '') => (await aj.http.get(`/api/lmn/config/customfields/${mapCustomRole(role)}`)).data;
    const notifyError = () => aj.notify.error(aj.gettext('Error, please verify the user and/or your values.'));
    async function write(method, user, suffix, data, title, handleError = true) {
        try {
            await aj.http[method](`/api/lmn/users/${user}/${suffix}`, data);
            aj.notify.success(aj.gettext(title));
            return true;
        } catch (error) {
            if (!handleError) throw error;
            notifyError();
            return false;
        }
    }
    async function add(user, suffix, key, prompt, title, value) {
        const result = await aj.messagebox.prompt(aj.gettext(prompt), value);
        if (await write('post', user, suffix, { [key]: result.value }, title)) return result.value;
    }
    async function remove(user, suffix, key, value, title, multi = false) {
        // Ajenti's original messagebox.then accepts only the success handler;
        // cancellation rejects and leaves the caller's displayed list unchanged.
        await aj.messagebox.show({ title: aj.gettext(title), text: aj.gettext('Do you really want to remove ') + value + ' ?', positive: aj.gettext('OK'), negative: aj.gettext('Cancel') });
        await write('patch', user, suffix, { [key]: value }, 'Value removed !', !multi);
    }
    return {
        loadConfig,
        loadUserFields: async user => (await aj.http.get(`/api/lmn/users/${user}/customfields`)).data,
        async loadDisplay(role) {
            const config = await loadConfig(role);
            const customTitle = ['', ...[1, 2, 3].map(index => {
                const attr = config.customDisplay[index] || '';
                if (attr === 'proxyAddresses') return config.proxyAddresses.title;
                const position = attr.slice(-1);
                return position ? (isListAttr(attr) ? config.customMulti : config.custom)[position].title || '' : '';
            })];
            return { customDisplay: config.customDisplay, customTitle };
        },
        async editCustom(user, value, index) {
            const result = await aj.messagebox.prompt(aj.gettext('New value'), value);
            if (await write('post', user, `custom/${index}`, { value: result.value }, 'Value updated !')) return result.value || 'null';
        },
        addCustomMulti: (user, index) => add(user, `custommulti/${index}`, 'value', 'New value', 'Value added !'),
        removeCustomMulti: (user, value, index) => remove(user, `custommulti/${index}`, 'value', value, 'Remove custom field value', true),
        addProxyAddresses: user => add(user, 'proxyaddresses', 'address', 'New address', 'Address added !'),
        removeProxyAddresses: (user, value) => remove(user, 'proxyaddresses', 'address', value, 'Remove proxy address'),
    };
}

export const groupDetails = dns => dns.map(dn => ({ cn: dn.split(',')[0].split('=')[1], category: dn.split(',')[1].split('=')[1] }));
export function quotaDetails(quotas, gettext) {
    return Object.entries(quotas).filter(([share]) => !['cloud', 'mail'].includes(share)).map(([share, value]) => {
        if (value.ERROR) return { share, total: gettext('Error'), used: '?', usage: 0, type: 'danger' };
        if (typeof value.hard_limit === 'string') return { share, total: gettext(value.hard_limit), used: value.used, usage: 0, type: 'success' };
        const usage = value.hard_limit === 0 ? 0 : Math.floor(100 * value.used / value.hard_limit);
        return { share, total: value.hard_limit === 0 ? gettext('NO LIMIT') : value.hard_limit + ' MiB', used: value.used, usage, type: usage < 60 ? 'success' : usage < 80 ? 'warning' : 'danger' };
    });
}
// Angular's date filter uses local time and the English month abbreviations.
export function formatUserDate(date, gettext) {
    if (date === '19700101000000.0Z') return gettext('Never');
    if (date === undefined) return 'undefined';
    const d = new Date(+date.slice(0, 4), +date.slice(4, 6) - 1, +date.slice(6, 8), +date.slice(8, 10), +date.slice(10, 12), +date.slice(12, 14));
    const pad = n => String(n).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${pad(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
