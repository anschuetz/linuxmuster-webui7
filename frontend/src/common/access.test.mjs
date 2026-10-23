import { describe, expect, it } from 'vitest';
import { createMockAj } from '../adapter/mock.mjs';
import { createAjentiAdapter } from '../adapter/ajenti.mjs';
import { useAdminAccess, useGlobalAdminAccess, useSambaAccess, useTeacherAccess } from './access.mjs';

// Sources: lmn_common/resources/js/directives/*.es. All wait for identity.promise.
const checks = [
    ['adminAccess.es:14-18', useAdminAccess, [true, true, false, false, false, false, false]],
    ['globalAdminAccess.es:14-18', useGlobalAdminAccess, [true, false, false, false, false, false, false]],
    ['sambaAccess.es:16-20', useSambaAccess, [true, true, true, true, true, false, false]],
    ['teacherAccess.es:14-18', useTeacherAccess, [true, true, true, false, true, true, true]],
];
const roles = ['globaladministrator', 'schooladministrator', 'teacher', 'student', 'other', '', undefined];

describe.each(checks)('%s', (source, useAccess, results) => {
    it.each(roles.map((role, index) => [role, results[index]]))('checks sophomorixRole=%s → %s', (role, expected) => {
        const aj = createMockAj({ identity: {
            user: 'demo', profile: { sophomorixRole: role }, isSuperuser: !expected,
        } });
        // isSuperuser does not override the profile role check.
        expect(useAccess(aj).value).toBe(expected);
    });

    it('leaves content accessible before identity loads, as the deferred DOM check does', () => {
        expect(useAccess(createMockAj()).value).toBe(true);
    });

    it('recomputes when identity loads and its profile changes', () => {
        const aj = createMockAj();
        const allowed = useAccess(aj);
        expect(allowed.value).toBe(true);
        aj.identity.profile = { sophomorixRole: 'student' };
        aj.identity.user = 'demo';
        expect(allowed.value).toBe(results[3]);
        aj.identity.profile = { sophomorixRole: 'globaladministrator' };
        expect(allowed.value).toBe(true);
        aj.identity.profile.sophomorixRole = undefined;
        expect(allowed.value).toBe(results[6]);
    });

    it('tracks the Ajenti adapter snapshot after the original identity promise resolves', async () => {
        let resolve;
        const identity = { promise: new Promise((done) => { resolve = done; }) };
        const aj = createAjentiAdapter({ identity });
        const allowed = useAccess(aj);
        expect(allowed.value).toBe(true);
        Object.assign(identity, { user: 'demo', profile: { sophomorixRole: 'student' } });
        resolve();
        await identity.promise;
        expect(allowed.value).toBe(results[3]);
    });
});

it.each([null, false, 0])('sambaAccess.es:17 denies falsy role %s after loading', (role) => {
    expect(useSambaAccess(createMockAj({ identity: {
        user: 'root', profile: { sophomorixRole: role },
    } })).value).toBe(false);
});
