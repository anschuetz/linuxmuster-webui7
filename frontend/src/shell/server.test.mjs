// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createSession } from './session.mjs';

it('runs prefixed identity, session activity, downloads, uploads, errors and a new login against a mock server', async () => {
    let user = 'root';
    const requests = [], redirects = [], notices = [];
    const server = createServer(async (req, res) => {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        requests.push({ url: req.url, method: req.method, headers: req.headers, body });
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/panel/api/core/identity') res.end(JSON.stringify({ identity: { user, effective: user === 'root' ? 0 : 1000, profile: { role: user } } }));
        else if (req.url === '/panel/api/core/session-time') res.end('3600');
        else if (req.url === '/panel/api/core/logout') { user = null; res.end('null'); }
        else if (req.url === '/panel/expired') { res.statusCode = 401; res.end('"expired"'); }
        else if (req.url === '/panel/file') { res.setHeader('Content-Type', 'text/plain'); res.end('download'); }
        else res.end(JSON.stringify({ body }));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const session = createSession({
        prefix: '/panel', fetch: (url, cfg) => fetch(base + url, cfg),
        path: () => '/panel/view/test', navigate: url => redirects.push(url),
        notify: { error: (...args) => notices.push(args) }, messagebox: { show() {} },
    });
    try {
        await session.start(); expect(session.identity.isSuperuser).toBe(true);
        expect(session.state.counter).toEqual(['01', '00', '00']);
        expect(await (await session.http.get('/file', { responseType: 'blob' })).data.text()).toBe('download');
        const form = new FormData(); form.append('file', new Blob(['upload']), 'demo.txt');
        await session.http.post('/upload', form, { headers: { 'Content-Type': undefined } });
        const upload = requests.at(-1);
        expect(upload.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
        expect(upload.body).toContain('name="file"; filename="demo.txt"'); expect(upload.body).toContain('upload');
        await session.http.put('/text', 'raw text', { headers: { 'Content-Type': 'text/plain' } });
        expect(requests.at(-1)).toMatchObject({ method: 'PUT', body: 'raw text' });
        await Promise.allSettled([session.http.get('/expired'), session.http.get('/expired')]);
        expect(redirects).toHaveLength(1); expect(notices).toHaveLength(1);
        expect(session.identity.isSuperuser).toBe(false);
        user = 'teacher'; await session.identity.refresh(); await session.activity();
        expect(session.identity.profile).toEqual({ role: 'teacher' }); expect(session.identity.isSuperuser).toBe(false);
        await session.logout();
        expect(requests.at(-1)).toMatchObject({ method: 'POST', url: '/panel/api/core/logout', body: '' });
        expect(redirects).toHaveLength(2);
    } finally {
        session.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});
