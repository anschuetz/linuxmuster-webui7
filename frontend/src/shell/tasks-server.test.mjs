// @vitest-environment node
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Server } from 'socket.io';
import { io } from 'socket.io-client';
import { describe, it, expect, vi } from 'vitest';
import { createTaskServices } from './tasks.mjs';
import { createHttp } from './http.mjs';
import { createPlugins } from './plugins.mjs';

/** Local protocol fixture. No Python execution, accounts, pip or real restart. */
async function fixture({ deny = false } = {}) {
    const requests = [], starts = [];
    const cls = 'aj.plugins.plugins.tasks.InstallPlugin';
    let tasks = [], socket;
    const server = createServer(async (req, res) => {
        let body = ''; for await (const chunk of req) body += chunk;
        requests.push([req.method, req.url, body ? JSON.parse(body) : undefined]);
        res.setHeader('Content-Type', 'application/json');
        if (req.url === '/panel/api/core/tasks/request-update') {
            push({ type: 'update', tasks }); res.end('null'); return;
        }
        if (req.url === '/panel/api/core/tasks/start') {
            const data = JSON.parse(body);
            // core/views/tasks.py allowlist; plugins/tasks.py action authorization.
            if (data.cls !== cls || deny) { res.statusCode = 403; res.end('"Forbidden"'); return; }
            starts.push(data); tasks = [{ id: 'fixture-task', name: 'Installing plugin', progress: { done: 0, total: 2, message: 'Installing' } }];
            push({ type: 'update', tasks }); res.end('"fixture-task"'); return;
        }
        const metadata = {
            '/panel/api/plugins/installed': [{ name: 'demo', title: 'Demo', version: '1.0' }],
            '/panel/api/plugins/pypi/installed': { demo: 'ajenti.plugin.demo' },
            '/panel/api/plugins/pypi/ajenti-plugins': [{ name: 'demo', title: 'Demo', version: '1.2', type: 'official' }],
            '/panel/api/plugins/core/check-upgrade': '2.2.17',
        };
        if (req.url in metadata) { res.end(JSON.stringify(metadata[req.url])); return; }
        res.statusCode = 404; res.end('null');
    });
    const sio = new Server(server, { path: '/panel/socket.io' });
    sio.of('/socket').on('connection', client => { socket = client; client.on('message', (_msg, ack) => ack()); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}`;
    const push = message => socket?.emit('message', { plugin: 'push', data: { plugin: 'tasks', message } });
    const http = createHttp({ prefix: '/panel', fetch: (url, options) => fetch(base + url, options) });
    const notify = { success: vi.fn(), error: vi.fn() };
    const owner = createTaskServices({ http, notify, prefix: '/panel', io: (namespace, options) => io(base + namespace,
        { ...options, transports: ['polling'], reconnectionDelay: 10, randomizationFactor: 0 }) });
    return { owner, http, requests, starts, cls, push, notify,
        reconnect: () => socket.conn.close(),
        close: async () => { owner.dispose(); await new Promise(resolve => sio.close(resolve)); } };
}
describe('actual Socket.IO 4 + HTTP fixture', () => {
    it('loads plugin fixtures, upgrades through the real task owner and requests restart only after confirmation', async () => {
        const f = await fixture(), dialogs = [], forceRestart = vi.fn();
        const model = createPlugins({ http: f.http, tasks: f.owner.tasks, notify: f.notify,
            identity: { isSuperuser: true, refresh: async () => {} }, pageTitle: { set() {} }, forceRestart,
            messagebox: { show(options) {
                let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
                dialogs.push({ options, resolve, reject }); return Object.assign(promise, { close() {} });
            } } }, { version: '2.2.17' });
        try {
            f.owner.start(); await vi.waitFor(() => expect(f.owner.state.status).toBe('connected'));
            await model.start(); expect(model.state.installedPlugins[0].name).toBe('demo');
            expect(model.getUpgrade(model.state.installedPlugins[0]).version).toBe('1.2');
            await model.installPlugin(model.state.installedPlugins[0]);
            expect(f.starts[0]).toEqual({ cls: f.cls, args: [], kwargs: { name: 'demo', version: '1.2' } });
            f.push({ type: 'message', message: { type: 'done', task: { id: 'fixture-task', name: 'Installing plugin' } } });
            await vi.waitFor(() => expect(dialogs).toHaveLength(2)); expect(forceRestart).not.toHaveBeenCalled();
            dialogs[1].resolve(); await vi.waitFor(() => expect(forceRestart).toHaveBeenCalledOnce());
            expect(f.requests.filter(r => r[1] === '/panel/api/plugins/installed')).toHaveLength(2);
        } finally { model.dispose(); await f.close(); }
    });
    it('connects through prefix, sends payload, reconnects once without duplicating tasks, settles done/exception and disposes', async () => {
        const f = await fixture();
        try {
            f.owner.start(); await vi.waitFor(() => expect(f.requests.filter(r => r[1].endsWith('request-update'))).toHaveLength(1));
            const task = await f.owner.tasks.start(f.cls, [], { name: 'demo', version: '1.2' });
            await vi.waitFor(() => expect(f.owner.tasks.state.tasks).toHaveLength(1));
            expect(f.starts).toEqual([{ cls: f.cls, args: [], kwargs: { name: 'demo', version: '1.2' } }]);
            await f.owner.socket.send('fixture', { ping: true });
            f.reconnect(); await vi.waitFor(() => expect(f.requests.filter(r => r[1].endsWith('request-update'))).toHaveLength(2));
            expect(f.owner.state.connectionLost).toBe(false); expect(f.starts).toHaveLength(1); expect(f.owner.tasks.state.tasks).toHaveLength(1);
            f.push({ type: 'message', message: { type: 'done', task: { id: task.id, name: 'Installing plugin' } } }); await task.promise;
            expect(f.notify.success).toHaveBeenCalledTimes(1);
            const failed = await f.owner.tasks.start(f.cls);
            const check = expect(failed.promise).rejects.toMatchObject({ exception: 'fixture denied' });
            f.push({ type: 'message', message: { type: 'exception', task: { id: failed.id, name: 'Installing plugin' }, exception: 'fixture denied' } }); await check;
            expect(f.notify.error).toHaveBeenCalledOnce();
        } finally { await f.close(); }
    });
    it('retains class and action denial from the backend without a task or success notice', async () => {
        const f = await fixture({ deny: true });
        try {
            await expect(f.owner.tasks.start('unlisted.class')).rejects.toMatchObject({ status: 403 });
            await expect(f.owner.tasks.start(f.cls)).rejects.toMatchObject({ status: 403 });
            expect(f.starts).toEqual([]); expect(f.owner.tasks.state.tasks).toEqual([]); expect(f.notify.success).not.toHaveBeenCalled();
        } finally { await f.close(); }
    });
});
