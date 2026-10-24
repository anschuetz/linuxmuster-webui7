export const isListAttr = (attr) => ['proxyAddresses', ...[1, 2, 3, 4, 5].map((n) => `sophomorixCustomMulti${n}`)].includes(attr);

export function quotasFor(data, gettext) {
    return Object.entries(data).filter(([share]) => !['cloud', 'mail'].includes(share)).map(([share, values]) => {
        if (values.ERROR) return { share, total: gettext('Error'), used: '?', usage: 0, type: 'danger' };
        const used = values.used, limit = values.hard_limit;
        if (typeof limit === 'string') return { share, total: gettext(limit), used, usage: 0, type: 'success' };
        const usage = limit === 0 ? 0 : Math.floor(100 * used / limit);
        return { share, used, total: limit === 0 ? gettext('NO LIMIT') : `${limit} MiB`, usage, type: usage < 60 ? 'success' : usage < 80 ? 'warning' : 'danger' };
    });
}
export function groupsFor(memberOf, gettext) {
    return memberOf.flatMap((dn) => {
        const [first, second] = dn.split(',');
        const cn = first.split('=')[1], category = second.split('=')[1];
        if (category === 'Management') return [];
        return [category === cn ? 'Class' : null, ({ Teachers: 'Teachers', 'printer-groups': 'Printers', Projects: 'Project' })[category]].filter(Boolean).map((label) => ({ cn, category: gettext(label) }));
    });
}
// Angular orderBy compares strings case-insensitively.
export const ordered = (items, keys) => items && [...items].sort((a, b) => {
    for (const key of keys) {
        const left = a[key].toLowerCase(), right = b[key].toLowerCase();
        if (left !== right) return left < right ? -1 : 1;
    }
    return 0;
});
