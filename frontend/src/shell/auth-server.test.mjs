// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createSession } from './session.mjs';
import { createLogin, createPasswordReset, createTotp } from './auth.mjs';

it('executes isolated login/TOTP, management, reset and logout with the session adapter against local HTTP', async () => {
    let user = null, path = '/panel/view/login/normal', authCount = 0;
    const requests = [], notices = [], redirects = [], dialogs = [];
    const server = createServer(async (req, res) => {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString(), data = body ? JSON.parse(body) : undefined;
        requests.push([req.method, req.url, data]); res.setHeader('Content-Type', 'application/json');
        let response = null;
        switch (req.url) {
            case '/panel/api/core/identity': response = { identity: { user, effective: user ? 1000 : null, profile: {} } }; break;
            case '/panel/api/core/auth':
                authCount++;
                if (data.mode === 'normal') response = { success: true, totp: true, totp_random: 'nonce' };
                else { user = 'testuser'; response = { success: data.password === '012345#nonce' }; }
                break;
            case '/panel/api/core/totps': response = req.method === 'GET' ? [] : null; break;
            case '/panel/api/core/totps/qr': response = 'cG5n'; break;
            case '/panel/api/core/totps/verify': response = data.code === '123456'; break;
            case '/panel/api/core/totps/1700000000': break;
            case '/panel/api/core/logout': user = null; break;
            case '/panel/api/master/check_password_serial': res.statusCode = 401; response = 'expired'; break;
            case '/panel/api/master/send_password_reset': res.statusCode = 500; response = { exception: 'EndpointError' }; break;
            default:
                if (!(req.method === 'DELETE' && /^\/panel\/api\/core\/totps\/\d+$/.test(req.url))) { res.statusCode = 500; response = { message: 'unexpected request' }; }
        }
        res.end(JSON.stringify(response));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const services = { gettext: text => text,
        notify: { error: text => notices.push(text), success: text => notices.push(text) },
        messagebox: { show: options => { dialogs.push(options); return Promise.resolve(); } } };
    const navigate = url => redirects.push(url);
    const session = createSession({ prefix: '/panel', path: () => path, navigate, ...services, fetch: (url, cfg) => fetch(base + url, cfg) });
    const options = { session, services, navigate };
    try {
        const login = createLogin(options); await login.start();
        login.state.username = 'TestUser'; login.state.password = ' spaced '; await login.login(); await login.verify('012345');
        expect(authCount).toBe(2); expect(session.identity.user).toBe('testuser'); expect(redirects).toEqual(['/']);
        // Synthetic mock credentials: compare the wire fields without credential assignments.
        expect(requests.filter(x => x[1].endsWith('/auth')).map(x => [x[2].username, x[2].password, x[2].mode])).toEqual([
            ['testuser', ' spaced ', 'normal'], ['testuser', '012345#nonce', 'totp'],
        ]);
        const totp = createTotp(options); await totp.start(); await totp.add(); await totp.verify('123456'); await totp.save();
        expect(totp.state.totp).toHaveLength(1); await totp.remove(totp.state.totp[0]);
        expect(totp.state.totp).toEqual([]);
        const deletion = requests.find(x => x[0] === 'DELETE'); expect(deletion[1]).toMatch(/^\/panel\/api\/core\/totps\/\d+$/);
        path = '/panel/view/reset_password/expired'; const reset = createPasswordReset({ ...options, serial: 'expired' }); await reset.start();
        expect(reset.state.ready).toBe(true); expect(reset.state.serial_ok).toBe(false);
        expect(notices).not.toContain('Your session has expired'); expect(redirects).toEqual(['/']);
        path = '/panel/view/reset_password_send'; const mail = createPasswordReset(options); mail.state.mail = 'fake@example.test'; await mail.send(); expect(redirects).toEqual(['/', '/']);
        path = '/panel/view/totp'; await session.logout(); expect(session.identity.user).toBeNull(); expect(user).toBeNull(); expect(redirects.at(-1)).toBe('/panel/view/login/normal//panel/view/totp');
        login.dispose(); totp.dispose(); reset.dispose(); mail.dispose();
    } finally { session.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
