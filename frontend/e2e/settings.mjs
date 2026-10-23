export function loadSettings(env = {}, local = {}) {
    const required = (value, key) => {
        if (typeof value !== 'string' || !value.trim()) {
            throw new Error(`Missing ${key}; see e2e/README.md (VM smoke cannot run).`);
        }
        return value;
    };
    return {
        baseURL: required(env.E2E_BASE_URL ?? local.url, 'E2E_BASE_URL'),
        roles: [
            { name: 'global-admin', key: 'ADMIN', source: local.admin },
            { name: 'teacher', key: 'TEACHER', source: local.teacher },
        ].map(({ name, key, source }) => ({
            name,
            login: required(env[`E2E_${key}_LOGIN`] ?? source?.login, `E2E_${key}_LOGIN`),
            pw: required(env[`E2E_${key}_PASSWORD`] ?? source?.pw, `E2E_${key}_PASSWORD`),
        })),
    };
}
