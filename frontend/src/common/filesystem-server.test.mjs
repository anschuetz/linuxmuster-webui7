// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createHttp } from '../shell/http.mjs';
import { createFilesystem } from './filesystem.mjs';

// Endpoint fixtures model filesystem 0.51 views.py: read/list/stat require read,
// write/upload/finish-upload require write. POSIX access is enforced by the server.
it('roundtrips encoded paths and text, and preserves separate read/write denials over HTTP', async () => {
    let read = true, write = true, content = '  ä\n中\n';
    const calls = [];
    const server = createServer(async (req, res) => {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        const url = new URL(req.url, 'http://fixture');
        const operation = url.pathname.split('/')[4];
        calls.push({ url, body, method: req.method });
        res.setHeader('Content-Type', 'application/json');
        if (!(req.method === 'GET' ? read : write)) { res.statusCode = 403; res.end('{"message":"denied"}'); return; }
        if (operation === 'write') { content = body; res.end('null'); }
        else if (operation === 'read') res.end(JSON.stringify(content));
        else if (operation === 'stat') res.end('{"readAccess":true,"writeAccess":false,"isFile":true}');
        else if (operation === 'list') res.end('{"parent":null,"items":[]}');
        else res.end('["/fixture/upload.txt"]');
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const http = createHttp({ prefix: '/panel', fetch: (url, cfg) => fetch(origin + url, cfg) });
    const fs = createFilesystem({ http });
    try {
        const path = '/fixture/ä ?#.txt';
        expect(await fs.read(path, 'latin-1')).toBe(content);
        expect(calls.at(-1).url.searchParams.get('encoding')).toBe('latin-1');
        expect(decodeURIComponent(calls.at(-1).url.pathname)).toBe('/panel/api/filesystem/read/' + path);
        await fs.write(path, ' \nnew ü\n', 'latin-1'); expect(await fs.read(path)).toBe(' \nnew ü\n');
        expect(await fs.list('/fixture')).toEqual({ parent: null, items: [] });
        expect(await fs.stat(path)).toMatchObject({ readAccess: true, writeAccess: false });
        write = false; await expect(fs.write(path, 'forbidden')).rejects.toMatchObject({ status: 403 });
        expect(await fs.read(path)).toBe(' \nnew ü\n');
        await expect(http.post('/api/filesystem/upload', new FormData())).rejects.toMatchObject({ status: 403 });
        await expect(http.post('/api/filesystem/finish-upload', [])).rejects.toMatchObject({ status: 403 });
        read = false; await expect(fs.read(path)).rejects.toMatchObject({ status: 403 });
        await expect(fs.list('/fixture')).rejects.toMatchObject({ status: 403 });
        await expect(fs.stat(path)).rejects.toMatchObject({ status: 403 });
        write = true;
        const form = new FormData(); form.append('file', new Blob(['synthetic']), 'upload.txt');
        await http.post('/api/filesystem/upload', form, { headers: { 'Content-Type': undefined } });
        expect(calls.at(-1).body).toContain('synthetic');
        expect(await http.post('/api/filesystem/finish-upload', [{ id: 'fixture', path: '/fixture', name: 'upload.txt' }])).toMatchObject({ data: ['/fixture/upload.txt'] });
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
