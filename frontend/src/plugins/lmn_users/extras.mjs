import { sortedUsers, matchesUser } from './users.mjs';
const encodings = { '': 'utf-8', utf8: 'utf-8', ascii: 'ascii', '8859-1': 'ISO8859-1', '8859-15': 'ISO8859-15', win1252: 'cp1252' };
const studentFields = [
    ['class', 'Class', 'TODO'], ['last_name', 'Last name', 'TODO'],
    ['first_name', 'First name', 'TODO'], ['birthday', 'Birthday', 'Date'], ['login', 'Login', 'AlphaNum'],
];
const courseFields = [
    ['course', 'Course', 'TODO'], ['base_name', 'Base name', 'TODO'], ['count', 'Count', 'Count'],
    ['birthday', 'Birthday', 'Date'], ['gecos', 'GECOS'], ['password', 'Password', 'Password'], ['removal_date', 'Removal date', 'Date'],
];
export const extraFields = kind => (kind === 'students' ? studentFields : courseFields).map(([key, label, validation]) => ({ key, label, validation }));
export const extraSorts = kind => kind === 'students'
    ? ['class', 'first_name', 'last_name', 'birthday', 'login']
    : ['course', 'base_name', 'birthday', 'count', 'gecos'];

export function fieldError(validation, name, value, isNew, firstSave, rows, filter) {
    if (!name || name === 'TODO' || (name === 'Password' && !value)) return '';
    // Angular treats validation's error strings as truthy. Preserve that contract.
    let valid = validation['isValid' + name](value) && value;
    if (filter === 'students') valid = valid && rows.filter(validation.findval('login', value)).length < 2;
    return valid ? '' : isNew && !firstSave ? 'has-error-new' : 'has-error';
}
export function extraRows(rows, kind, query, sort) {
    const filtered = rows.filter(row => matchesUser(row, query, 'students'));
    // Only students have the legacy -_isNew primary sort; courses sort by the selected field.
    return kind === 'students' ? sortedUsers(filtered, sort) : sortedUsers(filtered.map(row => ({ value: row[sort], row })), 'value').map(item => item.row);
}
export function createExtras(aj, kind) {
    const list = kind === 'students' ? 'extrastudents' : 'extraclasses';
    const url = encoding => `/api/lmn/users/lists/${list}?encoding=${encoding}`;
    return {
        path: `/etc/linuxmuster/sophomorix/default-school/${list}.csv`,
        async load() {
            const { data } = await aj.http.get('/api/lmn/schoolsettings');
            const encoding = encodings[data[kind === 'students' ? 'encoding_students_extra' : 'encoding_courses_extra']] || 'ISO8859-1';
            return { encoding, rows: (await aj.http.get(url(encoding))).data };
        },
        async save(rows, encoding) {
            await aj.http.post(url(encoding), rows);
            aj.notify.success(aj.gettext('Saved'));
        },
    };
}
