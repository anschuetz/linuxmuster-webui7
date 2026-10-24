import { user, config } from './users_1.mjs';
export { config };
export function users(role = 'students') {
    return Array.from({ length: 54 }, (_, index) => ({
        ...user(), cn: `p118-${index}`, sAMAccountName: `p118-${index}`,
        givenName: index < 2 ? 'Equal' : `Synthetic ${String(index).padStart(2, '0')}`,
        sn: 'User', class: ['normal'], sophomorixRole: role.slice(0, -1),
        sophomorixAdminClass: index === 53 && role === 'students' ? 'attic' : 'p118-class',
        sophomorixExitAdminClass: 'old-class', sophomorixCustom1: 'custom-only',
        sophomorixCustomMulti1: ['multi-a', 'multi-b'], proxyAddresses: ['smtp:p118@test.invalid'],
    }));
}
