import { describe, expect, it } from 'vitest';
import { loadSettings } from './settings.mjs';

const local = {
    url: 'https://localhost:18443',
    admin: { login: 'admin-fixture', pw: 'fixture-only' },
    teacher: { login: 'teacher-fixture', pw: 'fixture-only' },
};

describe('VM smoke configuration', () => {
    it('loads the legacy authconfig shape for two roles', () => {
        expect(loadSettings({}, local)).toEqual({
            baseURL: local.url,
            roles: [
                { name: 'global-admin', ...local.admin },
                { name: 'teacher', ...local.teacher },
            ],
        });
    });

    it('gives environment variables precedence over the local file', () => {
        const env = {
            E2E_BASE_URL: 'https://127.0.0.1:18443',
            E2E_ADMIN_LOGIN: 'other-admin', E2E_ADMIN_PASSWORD: 'other-fixture',
            E2E_TEACHER_LOGIN: 'other-teacher', E2E_TEACHER_PASSWORD: 'other-fixture',
        };
        const settings = loadSettings(env, local);
        expect(settings.baseURL).toBe(env.E2E_BASE_URL);
        expect(settings.roles.map(({ login, pw }) => [login, pw])).toEqual([
            ['other-admin', 'other-fixture'], ['other-teacher', 'other-fixture'],
        ]);
        expect(local.admin.login).toBe('admin-fixture');
    });

    it('fails on missing credentials instead of skipping the VM tests', () => {
        expect(() => loadSettings({ E2E_BASE_URL: local.url })).toThrow('E2E_ADMIN_LOGIN');
        expect(() => loadSettings({}, { ...local, teacher: {} })).toThrow('E2E_TEACHER_LOGIN');
        expect(() => loadSettings()).toThrow('E2E_BASE_URL');
    });
});
