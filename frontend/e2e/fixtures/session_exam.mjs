// Synthetic accounts shared unchanged by both UI oracles.
export const users = (owner = 'zem', mode = 'mixed') => ['student', 'examuser', 'teacher'].map((role, i) => ({
    cn: `p95-${i}`, sAMAccountName: `p95-${i}`, sn: `User${i}`, givenName: 'Fixture', displayName: `P95 User${i}`,
    sophomorixRole: role, sophomorixAdminClass: i === 2 ? 'teachers' : 'p95-class',
    homeDirectory: `\\\\P95\\fixture\\p95-${i}`, wifi: false, internet: true, printing: false,
    examMode: mode === 'own' || mode === 'mixed' && i < 2,
    examTeacher: mode === 'own' ? owner : mode === 'mixed' && i < 2 ? (i === 0 ? 'p95-other' : owner) : '',
}));
export const session = (owner, mode) => ({ sid: 'p95', name: 'p95', type: 'group', generated: false, members: users(owner, mode) });
