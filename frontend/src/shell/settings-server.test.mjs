// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { createConfiguration, createPasswd, createSettings } from './settings.mjs';
import { createHttp } from './http.mjs';

const configFixture = () => ({ name: 'Fixture', language: 'en', color: 'default', auth: { provider: 'os' },
    ssl: { enable: true, certificate: '/fixture.pem', client_auth: { force: true, certificates: [] } } });
function backend({ kind = 'config', method, uid = 0, user = 'root', permissions = ['core:config:read', 'core:config:write'], data, config = configFixture(), ...rest }) {
    const result = spawnSync('python3', ['test-fixtures/shell/settings/backend.py'], {
        input: JSON.stringify({ kind, method, uid, user, permissions, data, config, ...rest }), encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    return JSON.parse(result.stdout);
}
it('checks original Python endpoint guards independently of menu visibility and preserves passwd mismatch', () => {
    for (const [suffix, data] of [['config', { name: 'fixture' }], ['smtp_config', { smtp: {} }], ['tfa_config', { type: 'delete', userid: 'root@os', timestamp: '42' }]]) {
        for (const verb of ['get', 'post']) {
            const method = `handle_api_${verb}_${suffix}`;
            expect(backend({ method, uid: 1000, data }).status).toBe(403);
            expect(backend({ method, permissions: [], data }).status).toBe(403);
            const required = `core:config:${verb === 'get' ? 'read' : 'write'}`;
            expect(backend({ method, permissions: [required], data }).status).toBe(200);
        }
    }
    expect(backend({ method: 'handle_api_post_user_config', uid: 1000, permissions: [], data: { widgets: [] } }).status).toBe(200);
    expect(backend({ kind: 'passwd', method: 'handle_api_passwd_list', uid: 1000 }).status).toBe(403);
    expect(backend({ kind: 'passwd', method: 'handle_api_passwd_list' }).data[0].name).toBe('root');
    const set = params => backend({ kind: 'passwd', method: 'handle_api_passwd_set', ...params });
    expect(set({ data: { user: 'root', password: 'fixture' } })).toMatchObject({ status: 500, writes: [] });
    expect(set({ uid: 1000, user: 'fixture', data: { users: 'other', password: 'fixture' } })).toMatchObject({ status: 403, writes: [] });
    const synthetic = [' f', '\n', 'ix', '\r', 'ture '].join('');
    expect(set({ uid: 1000, user: 'fixture', data: { users: 'fixture', password: synthetic } })).toMatchObject({ status: 200, writes: [['passwd', 'fixture: fixture ']] });
    expect(set({ data: { users: 'other', password: 'fixture' } }).status).toBe(200);
});
it('runs config/SMTP/TFA/certificate/user-config/passwd wire workflows against a local fixture HTTP server', async () => {
    let uid = 0, permissions = ['core:config:read', 'core:config:write'];
    const requests = [], notices = [], config = configFixture();
    const server = createServer(async (req, res) => {
        const chunks = []; for await (const part of req) chunks.push(part);
        const raw = Buffer.concat(chunks).toString(), data = raw ? JSON.parse(raw) : undefined;
        requests.push([req.method, req.url, data]); res.setHeader('Content-Type', 'application/json');
        const endpoint = req.url.replace('/panel/api/', '');
        let result = { status: 200, data: [] };
        if (['core/config', 'core/smtp-config', 'core/tfa-config', 'core/user-config'].includes(endpoint)) {
            const suffix = endpoint.split('/')[1].replaceAll('-', '_');
            result = backend({ uid, permissions, method: `handle_api_${req.method === 'GET' ? 'get' : 'post'}_${suffix}`, data, config,
                smtp: { smtp: { server: 'relay', password: ' fixture ' } }, tfa: { 'root@os': { totp: [{ created: 42, description: 'fixture' }] } } });
        } else if (endpoint === 'passwds' || endpoint === 'passwd') {
            result = backend({ uid, permissions, kind: 'passwd', method: endpoint === 'passwds' ? 'handle_api_passwd_list' : 'handle_api_passwd_set', data });
        } else if (endpoint === 'settings/generate/server-certificate') result.data = { path: '/generated.pem' };
        else if (endpoint === 'settings/generate/client-certificate') result.data = { digest: 'fixture', name: 'CN=fixture', serial: '42', b64certificate: 'Zml4dHVyZQ==' };
        else if (endpoint === 'settings/test/ssl-certificate') result.data = true;
        res.statusCode = result.status; res.end(JSON.stringify(result.data ?? null));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const aj = { http: createHttp({ prefix: '/panel', fetch: (url, options) => fetch(base + url, options) }),
        identity: { isSuperuser: true, user: 'root' }, gettext: text => text, locale: { setLanguage() {} },
        notify: Object.fromEntries(['success', 'error', 'info'].map(kind => [kind, text => notices.push([kind, text])])),
        messagebox: { show: () => Promise.resolve() } };
    const model = createSettings(aj, { machine: { name: 'Fixture', hostname: 'fixture.test' } });
    try {
        await model.start(); expect(model.state.config.name).toBe('Fixture');
        await model.getSmtpConfig(); await model.save();
        expect(requests.find(row => row[1].endsWith('smtp-config') && row[0] === 'POST')[2].smtp.password).toBe(' fixture ');
        await model.getTfaConfig(); await model.deleteTfa(model.state.tfaList[0]); expect(model.state.tfaList).toEqual([]);
        await model.generateClientCertificate(); expect(model.state.config.ssl.client_auth.certificates[0].serial).toBe('42');
        await model.createNewServerCertificate(); expect(model.state.config.ssl.certificate).toBe('/generated.pem');
        const configuration = createConfiguration(aj.http);
        await configuration.setUserConfig({ widgets: [] }); await configuration.getUserConfig();
        await expect(createPasswd(aj).set('root', 'fixture')).rejects.toMatchObject({ status: 500 });
        permissions = ['core:config:read']; model.state.config.ssl.certificate = '/fixture.pem'; await model.save();
        expect(notices).toContainEqual(['error', 'Could not save global config']);
        uid = 1000; await expect(configuration.load()).rejects.toMatchObject({ status: 403 });
        uid = 0; permissions = ['core:config:write']; await expect(configuration.load()).rejects.toMatchObject({ status: 403 });
    } finally { model.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
