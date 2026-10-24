import SortListDialog from './SortListDialog.vue';
export function columnTitles(userlist, gettext) {
    const fields = { 'students.csv': ['class', 'lastname', 'firstname', 'birthday'], 'teachers.csv': ['lastname', 'firstname', 'birthday', 'login'] }[userlist];
    return fields?.map(id => ({ name: gettext(id), id }));
}
export function assignColumns(columns, titles, gettext) {
    // Parents/staff have no defined titles in the original controller.
    if (!titles) return { data: columns, titles };
    const padded = [...titles, ...Array.from({ length: Math.max(0, columns.length - titles.length) }, () => ({ name: gettext('not used') }))];
    return { titles: padded, data: columns.map((column, i) => ({ ...column, coloumn: padded[i].id })) };
}
export function toggleColumn(titles, field) {
    return titles.some(title => title.name === field) ? titles.filter(title => title.name !== field) : [...titles.slice(0, 4), { name: field, id: field }, ...titles.slice(4)];
}
export function moveColumn(titles, from, to) {
    const rest = titles.filter((_, index) => index !== from);
    return [...rest.slice(0, to), titles[from], ...rest.slice(to)];
}
export function createImport(aj) {
    return {
        async complete(role, filename, check, refresh) {
            const userlist = `${role}.csv`, path = `/tmp/${filename}`;
            let response;
            if (check) {
                const { data: columns } = await aj.http.post('/api/lmn/users/lists/import', { action: 'get', path, userlist });
                let data;
                try { data = await aj.modal.open(SortListDialog, { columns, userlist }); }
                catch { return; }
                response = await aj.http.post('/api/lmn/users/lists/import', { action: 'save', data, userlist });
            } else response = await aj.http.post('/api/lmn/users/lists/csv', { tmp_path: path, userlist });
            if (response.data[0] === 'ERROR') aj.notify.error(response.data[1]);
            if (response.data[0] === 'LOG') {
                refresh();
                aj.notify.success(aj.gettext(response.data[1]));
                aj.notify.success(aj.gettext('Saved'));
            }
        },
    };
}

export const uploadWarning = "Would you like to upload a list csv? This will replace your current CSV!<br>\n            It's highly recommend to check the columns after the upload instead of directly uploading your own CSV.<br>\n            <br>\n            After the the upload, sophomorix will try to execute the filter script configured in your school.conf.\n            Please read the full documentation at\n            <a href=\"https://github.com/linuxmuster/sophomorix4/wiki/Export-and-Filters#filters\">\n                sophomorix's wiki\n            </a> about it.\n            <br>\n            Use it with caution !";
