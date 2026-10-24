// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { expect, it } from 'vitest';
import { createHttp } from './http.mjs';
import { createLocale } from './locale.mjs';

it('loads prefixed locale JSON and languages against HTTP and never persists a runtime language change', async () => {
    const requests = [];
    const server = createServer((req, res) => {
        requests.push([req.method, req.url]); res.setHeader('Content-Type', 'application/json');
        if (req.url === '/panel/api/core/languages') res.end('["de","en"]');
        else if (req.url === '/panel/resources/all.locale.js?lang=de') res.end('{"Hello":"Hallo"}');
        else if (req.url === '/panel/resources/all.locale.js?lang=en') res.end('{"Hello":"Hello"}');
        else { res.statusCode = 500; res.end('{}'); }
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const locale = createLocale({ initialConfig: { language: 'de' }, http: createHttp({ prefix: '/panel', fetch: (url, options) => fetch(base + url, options) }) });
    try {
        await locale.start(); expect(locale.gettext('Hello')).toBe('Hallo');
        await locale.setLanguage('en'); expect(locale.gettext('Hello')).toBe('Hello');
        expect(requests).toEqual([['GET', '/panel/api/core/languages'], ['GET', '/panel/resources/all.locale.js?lang=de'], ['GET', '/panel/resources/all.locale.js?lang=en']]);
        await expect(locale.setLanguage('missing')).rejects.toMatchObject({ status: 500 });
        expect(locale.state.language).toBe('en');
    } finally { locale.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
