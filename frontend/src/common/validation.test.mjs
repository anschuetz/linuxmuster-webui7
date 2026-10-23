import { describe, expect, it } from 'vitest';
import { createValidation } from './validation.mjs';

const strong = 'Passwords must contain at least one lowercase, one uppercase, one special char or number, and at least 7 chars';
const chars = 'Password is not valid. Password can only contains a-zA-Z0-9.?!@#§+-$%&*{}()][';
// All source references below: lmn_common/resources/js/services/validation.coffee.
const rules = [
    ['isStrongPwd', 12, 'Abcdef1', 'abcdef1', strong],
    ['validCharPwd', 21, 'aA0.?!@#§+-$%&*{}()[]', 'abc/', chars],
    ['isValidPassword', 30, 'Abcdef1', 'abcdef1', strong],
    ['isValidProjectName', 41, 'ÄÉ_Projet-1', 'project+', 'project+ can only contain lowercase chars or numbers'],
    ['isValidSession', 51, 'Session_+-1', 'session.', 'session. can only contain alphanumeric chars or _+-'],
    ['isValidLinboConf', 61, 'Linbo_1-', 'linbo+', 'linbo+ can only contain alphanumeric chars or _-'],
    ['isValidLogin', 70, 'Login_1-', 'login+', 'login+ can only contain alphanumeric chars or -'],
    ['isValidComment', 79, 'Comment _-1', 'comment.', 'comment. can only contain alphanumeric chars or -, space and _'],
    ['isValidAlphaNum', 88, 'Ab1', 'ab_', 'ab_ can only contain alphanumeric chars'],
    ['isValidCount', 97, '012', '-1', '-1 is not a valid number'],
    ['isValidDate', 108, '31.02.1920', '01.13.2020', '01.13.2020 is not a valid date'],
    ['isValidMac', 117, 'AA:BB:CC:DD:EE:FF', 'AA:BB', 'AA:BB is not valid or duplicated'],
    ['isValidIP', 146, '10.0.0.255', '10.0.0.0', '10.0.0.0 is not valid or duplicated'],
    ['isValidHost', 155, 'Host-1', 'host_1', 'host_1 does not contain valid chars, is duplicated or too long (>15 chars)'],
    ['isValidImage', 166, 'Image_1-', '', ' does not contain valid chars or is duplicated'],
    ['isValidRoom', 175, 'Room-1', 'room_1', 'room_1 does not contain valid chars, is duplicated or too long (>15 chars)'],
    ['isValidRole', 179, 'classroom-teachercomputer', 'teacher', 'teacher is not a valid role'],
    ['isValidDomain', 202, 'EXAMPLE-1.org', 'example_org', 'example_org is not a valid domain'],
];

it.each(rules)('%s preserves valid/invalid results and translation (validation.coffee:%i)', (rule, line, valid, invalid, error) => {
    const validation = createValidation({ gettext: (text) => `T:${text}` });
    validation.set([], 'devices');
    expect(validation[rule](valid, 0)).toBe(true);
    const expected = ['isStrongPwd', 'validCharPwd', 'isValidPassword'].includes(rule)
        ? `T:${error}` : `${invalid}T:${error.slice(invalid.length)}`;
    expect(validation[rule](invalid, 0)).toBe(expected);
});

describe('source edge semantics', () => {
    it('uses strict findval predicates (validation.coffee:6-8)', () => {
        const validation = createValidation({ gettext: (text) => text });
        expect([{ a: 1 }, { a: '1' }, {}].filter(validation.findval('a', 1))).toEqual([{ a: 1 }]);
    });
    it('keeps empty strings where the source uses * (validation.coffee:44-110,204)', () => {
        const validation = createValidation({ gettext: (text) => text });
        for (const rule of ['isValidProjectName', 'isValidSession', 'isValidLinboConf', 'isValidLogin', 'isValidComment', 'isValidAlphaNum', 'isValidCount', 'isValidDomain']) {
            expect(validation[rule]('')).toBe(true);
        }
    });
    it('prioritizes strength errors and then character errors (validation.coffee:30-38)', () => {
        const validation = createValidation({ gettext: (text) => text });
        expect(validation.isValidPassword('/')).toBe(strong);
        expect(validation.isValidPassword('Abcdef1/')).toBe(chars);
    });
    it.each(['AA-BB-CC-DD-EE-FF', 'AABBCCDDEEFF'])('normalizes %s in the shared devices before duplicate checking (validation.coffee:127-139,211)', (mac) => {
        const validation = createValidation({ gettext: (text) => text });
        const devices = [{ mac }, { mac: 'AA:BB:CC:DD:EE:FF' }];
        validation.set(devices, 'devices');
        expect(validation.isValidMac(mac, 0)).toBe(`${mac} is not valid or duplicated`);
        expect(devices[0].mac).toBe('AA:BB:CC:DD:EE:FF');
        validation.set([{ mac }], 'devices');
        expect(validation.isValidMac(mac, 0)).toBe(true);
    });
    it('preserves case-sensitive duplicates and hostname room lookup (validation.coffee:139-176)', () => {
        const validation = createValidation({ gettext: (text) => text });
        validation.set([{ mac: 'aa:bb:cc:dd:ee:ff' }, { mac: 'AA:BB:CC:DD:EE:FF' }], 'devices');
        expect(validation.isValidMac('AA:BB:CC:DD:EE:FF', 1)).toBe(true);
        validation.set([{ ip: '10.0.0.1', hostname: 'Room' }, { ip: '10.0.0.1', hostname: 'Room' }], 'devices');
        expect(validation.isValidIP('10.0.0.1')).toBe('10.0.0.1 is not valid or duplicated');
        expect(validation.isValidHost('Room')).not.toBe(true);
        expect(validation.isValidRoom('Room')).not.toBe(true);
        expect(validation.isValidHost('room')).toBe(true);
        expect(validation.isValidHost('a'.repeat(16))).not.toBe(true);
        expect(validation.isValidHost('a'.repeat(16), false)).toBe(true);
        expect(validation.isValidHost('a'.repeat(15))).toBe(true);
        expect(validation.isValidIP('0.1.1.1')).not.toBe(true);
        expect(validation.isValidIP('256.1.1.1')).not.toBe(true);
    });
    it.each(['switch', 'addc', 'wlan', 'staffcomputer', 'mobile', 'printer', 'classroom-teachercomputer', 'server', 'iponly', 'faculty-teachercomputer', 'voip', 'byod', 'classroom-studentcomputer', 'thinclient', 'router'])('accepts role %s (validation.coffee:181-199)', (role) => {
        expect(createValidation({ gettext: (text) => text }).isValidRole(role)).toBe(true);
    });
});
