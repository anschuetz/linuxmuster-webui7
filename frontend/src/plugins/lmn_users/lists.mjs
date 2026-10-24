import { sortedUsers, matchesUser } from './users.mjs';
export const listTabs = ['students', 'parents', 'teachers', 'extrastudents', 'staff'];
export const hotkeyTabs = ['students', 'parents', 'teachers', 'extrastudents'];
export const listLabels = { students: 'Students', parents: 'Parents', teachers: 'Teachers', extrastudents: 'Extra-Students', staff: 'Staff' };
export const addLabels = { students: 'Add a student', parents: 'Add a parent', teachers: 'Add a teacher', extrastudents: 'Add a student', staff: 'Add a staff member' };
const roles = { students: 'student', parents: 'parent', staff: 'staff', teachers: 'teacher', extrastudents: 'extrastudent' };
const definitions = {
    class: ['Class', 'TODOclass', 'Class'], last_name: ['Last Name', 'TODOlast', 'Last name'],
    first_name: ['First Name', 'TODOfirst', 'First name'], birthday: ['Birthday', 'Date', 'Birthday'],
    login: ['Desired login', 'Login', 'Login'], id: ['Student ID', undefined, 'Student ID (optional)'],
};
export function listFields(kind) {
    const keys = { students: ['class', 'last_name', 'first_name', 'birthday', 'id'], parents: ['last_name', 'first_name', 'id'], staff: ['class', 'last_name', 'first_name', 'id'], teachers: ['last_name', 'first_name', 'birthday', 'login', 'id'], extrastudents: ['class', 'last_name', 'first_name', 'birthday', 'login'] }[kind];
    return keys.map(key => {
        let [label, validation, placeholder] = definitions[key];
        if (key === 'class' && kind === 'staff') label = placeholder = 'Category';
        if (key === 'id') { label = { students: 'Student ID', parents: 'Parent ID', teachers: 'Teacher ID', staff: 'Staff ID' }[kind]; placeholder = (kind === 'staff' ? 'Staff member ID' : label) + ' (optional)'; }
        return { key, label, validation, placeholder, visible: key !== 'id' };
    });
}
export function listSorts(kind) {
    const keys = { students: ['class', 'first_name', 'last_name', 'birthday', 'id'], parents: ['first_name', 'last_name', 'id'], staff: ['class', 'first_name', 'last_name', 'id'], teachers: ['login', 'first_name', 'last_name', 'birthday'], extrastudents: ['class', 'first_name', 'last_name', 'birthday', 'login'] }[kind];
    return keys.map(key => ({ key, label: ({ first_name: 'First name', last_name: 'Last name', login: 'Login' })[key] || listFields(kind).find(f => f.key === key).label }));
}
export function newListUser(kind) {
    const base = { _isNew: true, role: roles[kind], class: kind === 'parents' ? 'Parents' : kind === 'teachers' ? 'Lehrer' : '', last_name: '', first_name: '', birthday: ['parents', 'staff'].includes(kind) ? '01.01.1970' : '' };
    return ['teachers', 'extrastudents'].includes(kind) ? { ...base, login: '' } : { ...base, id: '' };
}
export function listRows(rows, kind, query, sort, page, size) {
    return sortedUsers((rows || []).filter(row => matchesUser(row, query, 'students')), sort).slice((page - 1) * size, page * size);
}
export function createLists(aj) {
    return {
        async load(kind) {
            const { data: rows } = await aj.http.get(`/api/lmn/users/lists/${kind}`);
            return { rows, encoding: undefined };
        },
        async teacherSettings() { return (await aj.http.get('/api/lmn/users/schoolconf')).data['userfile.teachers.csv']; },
        async school() { return (await aj.http.get('/api/lmn/activeschool')).data; },
        path(school, role) {
            const prefix = school === undefined ? 'undefined' : school === 'default-school' ? '/etc/linuxmuster/sophomorix/default-school/' : `/etc/linuxmuster/sophomorix/${school}/${school}.`;
            return `${prefix}${role}.csv`;
        },
        async save(kind, rows, encodings = {}) {
            await aj.http.post(`/api/lmn/users/lists/${kind}?encoding=${encodings[kind === 'staff' ? 'parents' : kind]}`, rows);
            aj.notify.success(aj.gettext('Saved'));
        },
    };
}
// The Angular controller keeps these maps even after cells are hidden or removed.
// They are deliberately plain maps: validation during rendering must not trigger a render.
export function validateListField(state, validation, gettext, { name, value, tab, index, page, size, lists, firstSave }) {
    if (!name) return '';
    const key = `${name}-${tab}-${(page - 1) * size + 1 + Number.parseInt(index, 10)}`;
    const errorClass = firstSave ? 'has-error-new has-error' : 'has-error-new';
    if (name.startsWith('TODO')) {
        if (!value) { state.emptyCells[key] = 1; return errorClass; }
        delete state.emptyCells[key]; return '';
    }
    if (name === 'Password' && !value) return '';
    let test = validation['isValid' + name](value);
    if (['teachers', 'extrastudents'].includes(tab) && name === 'Login' && value !== '' && value !== undefined) {
        if (lists[tab].filter(validation.findval('login', value)).length >= 2) test = test && gettext(`Duplicate ${tab} login`);
        if (tab === 'extrastudents' && [...lists.extrastudents, ...lists.students].some(row => row.class === value)) test = test && gettext('Conflict between login and class');
    }
    if (test === true && (value || (name === 'Login' && ['teachers', 'extrastudents'].includes(tab)))) {
        delete state.errorMessages[key]; delete state.emptyCells[key]; return '';
    }
    if (!value) { delete state.errorMessages[key]; state.emptyCells[key] = 1; }
    else {
        delete state.emptyCells[key]; const message = gettext(tab) + ': ' + test;
        if (!Object.values(state.errorMessages).includes(message)) state.errorMessages[key] = message;
    }
    return errorClass;
}
export function cleanupEmptyRow(state, tab, index, page, size) {
    const suffix = '-' + ((page - 1) * size + 1 + Number.parseInt(index, 10));
    for (const key of Object.keys(state.emptyCells)) if (key.endsWith(suffix)) delete state.emptyCells[key];
}
