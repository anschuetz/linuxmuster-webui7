import { describe, it, expect, vi } from 'vitest';
import { legacyHarness } from '../../test-fixtures/shell/legacy.mjs';
import { createHttp } from './http.mjs';

const reply = (body, status = 200, type = 'application/json') => ({
    status, headers: new Headers({ 'Content-Type': type }), text: async () => body,
    blob: async () => new Blob([body], { type }),
});

for (const implementation of ['legacy', 'native']) {
    describe(`${implementation} HTTP contract`, () => {
        async function harness(options = {}) {
            if (implementation === 'legacy') return legacyHarness(options);
            const calls = [], fetch = vi.fn(async (url, cfg) => {
                calls.push({ url, method: cfg.method, data: cfg.body, headers: Object.fromEntries(cfg.headers), responseType: options.responseType });
                return reply(options.body ?? '{"ok":true}', options.status ?? 200, options.type);
            });
            const http = createHttp({ fetch, prefix: '/panel' });
            return { calls, request: (method, ...args) => http[method](...args), close() {} };
        }
        it.each(['get', 'head', 'delete', 'post', 'put', 'patch'])('preserves %s response envelope, JSON body and prefix', async method => {
            const h = await harness();
            try {
                const hasBody = ['post', 'put', 'patch'].includes(method);
                const result = await h.request(method, '/api/demo', ...(hasBody ? [{ value: 3 }] : []));
                expect({ data: result.data, status: result.status }).toEqual({ data: { ok: true }, status: 200 });
                expect(h.calls[0]).toMatchObject({ method: method.toUpperCase(), url: '/panel/api/demo' });
                if (hasBody) expect(h.calls[0].data).toBe('{"value":3}');
            } finally { h.close(); }
        });
        it('sorts params, repeats arrays, serializes objects/dates and keeps existing query/hash', async () => {
            const h = await harness();
            try {
                await h.request('get', '/api/demo?x=1#anchor', { params: { z: null, b: ['a b', 'c'], a: { n: 2 }, d: new Date('2026-01-01Z') }, headers: { 'X-Test': 'yes' } });
                expect(h.calls[0].url).toBe('/panel/api/demo?x=1#anchor&a=%7B%22n%22:2%7D&b=a+b&b=c&d=2026-01-01T00:00:00.000Z');
                expect(Object.entries(h.calls[0].headers).some(([k, v]) => k.toLowerCase() === 'x-test' && v === 'yes')).toBe(true);
            } finally { h.close(); }
        });
        it.each(['relative.txt', 'https://example.test/api'])('leaves %s without prefix', async url => {
            const h = await harness(); try { await h.request('get', url); expect(h.calls[0].url).toBe(url); } finally { h.close(); }
        });
        it('passes raw text and suppresses explicitly undefined Content-Type for FormData', async () => {
            const h = await harness({ body: 'plain', type: 'text/plain', headers: 'Content-Type: text/plain' });
            try {
                const data = new FormData(); data.append('file', 'test');
                await h.request('post', '/upload', data, { headers: { 'Content-Type': undefined } });
                expect(h.calls[0].data).toBe(data);
                expect(Object.keys(h.calls[0].headers).map(k => k.toLowerCase())).not.toContain('content-type');
                expect((await h.request('post', '/text', 'plain', { headers: { 'Content-Type': 'text/plain' } })).data).toBe('plain');
            } finally { h.close(); }
        });
        it('retains blob data without JSON transformation', async () => {
            const blob = new Blob(['download']);
            const h = await harness({ body: blob, responseType: 'blob' });
            try {
                // The legacy backend receives the already decoded XHR blob.
                if (implementation === 'native') {
                    const http = createHttp({ fetch: async () => ({ status: 200, blob: async () => blob }) });
                    expect((await http.get('/file', { responseType: 'blob' })).data).toBe(blob);
                } else expect((await h.request('get', '/file', { responseType: 'blob' })).data).toBe(blob);
            } finally { h.close(); }
        });
        it.each([401, 403, 500])('rejects %i with status and data', async status => {
            const h = await harness({ status, body: '{"exception":"EndpointError"}' });
            try { await expect(h.request('get', '/api')).rejects.toMatchObject({ status, data: { exception: 'EndpointError' } }); } finally { h.close(); }
        });
    });
}

it('uses the session cookie and preserves transport failures as status -1', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'));
    const onError = vi.fn(); const http = createHttp({ fetch, onError });
    await expect(http.get('/api')).rejects.toMatchObject({ status: -1, data: null });
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin');
    expect(onError).toHaveBeenCalledTimes(1);
});

it('matches legacy 403/500/401 policy including login exception and single redirect', async () => {
    for (const [status, body, notice, dialog] of [
        [403, 'denied', 1, 0], [500, '{"exception":"SecurityError","message":"denied"}', 1, 0],
        [500, '{"exception":"EndpointError"}', 0, 0], [500, '{"exception":"Error"}', 0, 1],
        [401, 'expired', 1, 0],
    ]) {
        const h = legacyHarness({ status, body, headers: body.startsWith('{') ? 'Content-Type: application/json' : 'Content-Type: text/plain' });
        try {
            await h.request('get', '/api').catch(() => {});
            await h.request('get', '/api').catch(() => {});
            expect(h.notices).toHaveLength(status === 401 ? notice : notice * 2);
            expect(h.dialogs).toHaveLength(dialog * 2);
            expect(h.redirects).toEqual(status === 401 ? ['/panel/view/login/normal//panel/view/test'] : []);
        } finally { h.close(); }
    }
    const h = legacyHarness({ status: 401, path: '/panel/view/login/normal' });
    try { await h.request('get', '/api').catch(() => {}); expect(h.redirects).toEqual([]); } finally { h.close(); }
});

it('maps actual legacy identity fields and removes root rights after anonymous init', async () => {
    for (const [identity, superuser] of [
        [{ user: 'root', effective: 0, profile: { role: 'admin' } }, true],
        [{ user: 'teacher', effective: 1000, profile: {} }, false],
        [{ user: null }, false],
    ]) {
        const h = legacyHarness({ body: JSON.stringify({ identity, machine: { name: 'test' }, color: 'blue' }) });
        try {
            h.identity.init();
            await h.request('get', '/flush');
            expect(h.identity.user).toBe(identity.user); expect(h.identity.isSuperuser).toBe(superuser);
        } finally { h.close(); }
    }
});

it.each([' plain ', '', ' [1,2] ', ")]}'\n{\"ok\":true}", '{invalid}'])('matches default response transform for %j', async body => {
    const h = legacyHarness({ body, headers: 'Content-Type: text/plain' });
    try {
        const old = await h.request('get', '/text');
        const http = createHttp({ fetch: async () => reply(body, 200, 'text/plain') });
        expect((await http.get('/text')).data).toEqual(old.data);
    } finally { h.close(); }
});
