// Only synthetic accounts and paths, shared unchanged by Angular and Vue.
export const teacherHome = '\\\\P94\\fixture\\teacher';
export const users = () => ['student', 'examuser', 'teacher'].map((role, index) => ({
    cn: `p94-${index}`, sAMAccountName: `p94-${index}`, sn: `User${index}`, givenName: 'Fixture',
    sophomorixRole: role, sophomorixAdminClass: role === 'teacher' ? 'teachers' : 'p94-class',
    homeDirectory: `\\\\P94\\fixture\\p94-${index}`, examMode: false, examTeacher: '',
}));
export const session = (foreign = false) => ({ sid: 'p94', name: 'p94', type: 'group', generated: false,
    members: users().map((u, i) => foreign && i === 0 ? {...u, examMode: true, examTeacher: 'p94-other'} : u),
});
export const items = (path) => [
    {name: 'z.txt', path: path + '/z.txt', isFile: true, isDir: false, size: 8, filetype: 'text'},
    {name: 'collected', path: path + '/collected', isDir: true, isFile: false},
    {name: 'Bdir', path: path + '/Bdir', isDir: true, isFile: false},
    {name: 'a.txt', path: path + '/a.txt', isFile: true, isDir: false, size: 4, filetype: 'text'},
];
