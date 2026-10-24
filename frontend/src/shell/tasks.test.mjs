import { describe, it, expect, vi } from 'vitest';
import { createTaskServices } from './tasks.mjs';
import { tasksOracle } from '../../test-fixtures/shell/tasks.mjs';

function setup() {
    const events = new Map(), managerEvents = new Map();
    const socket = { connected: false, on: vi.fn((n, f) => events.set(n, f)), off: vi.fn(n => events.delete(n)),
        io: { on: (n, f) => managerEvents.set(n, f), off: n => managerEvents.delete(n) },
        connect: vi.fn(), disconnect: vi.fn(), emit: vi.fn((n, msg, ack) => ack()) };
    const http = { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({ data: 'T1' }) };
    const notify = { success: vi.fn(), error: vi.fn() }, io = vi.fn(() => socket);
    const owner = createTaskServices({ io, http, notify, prefix: '/panel' });
    return { owner, socket, http, notify, io, event: (n, v) => events.get(n)?.(v), managerEvents, events };
}
const envelope = message => ({ plugin: 'push', data: { plugin: 'tasks', message } });
describe('socket/push/task owner', () => {
    it('rejects unacknowledged messages on disposal and reports connection errors', async () => {
        const s = setup(); s.socket.emit.mockImplementation(() => {});
        const sent = s.owner.socket.send('fixture', {}), rejected = expect(sent).rejects.toThrow('disposed');
        s.event('connect_error', new Error('denied')); expect(s.owner.state.status).toBe('error');
        s.managerEvents.get('reconnect_failed')(); expect(s.owner.state.connectionLost).toBe(true);
        s.owner.dispose(); await rejected;
        await expect(s.owner.socket.send('fixture', {})).rejects.toThrow('disposed');
    });

    it('uses prefixed Engine.IO path, one socket, reconnect updates and detachable subscriptions', async () => {
        const s = setup(), fn = vi.fn();
        expect(s.io).toHaveBeenCalledWith('/socket', expect.objectContaining({ path: '/panel/socket.io', autoConnect: false, withCredentials: true }));
        const stop = s.owner.push.subscribe('example', fn);
        s.owner.start(); s.owner.start(); expect(s.socket.connect).toHaveBeenCalledTimes(1);
        s.event('connect'); await Promise.resolve(); expect(s.http.get).toHaveBeenCalledWith('/api/core/tasks/request-update');
        s.event('disconnect'); expect(s.owner.state.connectionLost).toBe(true);
        s.managerEvents.get('reconnect_attempt')(); expect(s.owner.state.status).toBe('reconnecting');
        s.event('connect'); expect(s.http.get).toHaveBeenCalledTimes(2);
        s.event('message', JSON.stringify({ plugin: 'push', data: { plugin: 'example', message: { value: 1 } } }));
        expect(fn).toHaveBeenCalledWith({ value: 1 }); stop(); s.event('message', { plugin: 'push', data: { plugin: 'example', message: {} } });
        expect(fn).toHaveBeenCalledTimes(1);
        await s.owner.socket.send('test', { a: 1 }); expect(s.socket.emit).toHaveBeenCalledWith('message', { plugin: 'test', data: { a: 1 } }, expect.any(Function));
        s.owner.dispose(); expect(s.events.size).toBe(0); expect(s.managerEvents.size).toBe(0); expect(s.socket.disconnect).toHaveBeenCalledOnce();
    });
    it('matches original start payload, updates, completion and exception notifications', async () => {
        const s = setup(), oldHttp = { get: vi.fn().mockResolvedValue({}), post: vi.fn().mockResolvedValue({ data: 'T1' }) };
        const oldNotify = { success: vi.fn(), error: vi.fn() }, old = tasksOracle({ http: oldHttp, notify: oldNotify });
        const actual = await s.owner.tasks.start('aj.plugins.plugins.tasks.InstallPlugin'), expected = await old.tasks.start('aj.plugins.plugins.tasks.InstallPlugin');
        expect(s.http.post.mock.calls).toEqual(oldHttp.post.mock.calls); expect(actual.id).toBe(expected.id);
        const update = { type: 'update', tasks: [{ id: 'T1', name: 'Installing plugin', progress: { done: 1, total: 2, message: 'Working' } }] };
        s.event('message', envelope(update)); old.event('message', envelope(update)); expect(s.owner.tasks.state.tasks).toEqual(old.tasks.tasks);
        const done = { type: 'message', message: { type: 'done', task: update.tasks[0] } };
        s.event('message', envelope(done)); old.event('message', envelope(done)); await Promise.all([actual.promise, expected.promise]);
        expect(s.notify.success.mock.calls).toEqual(oldNotify.success.mock.calls);
        const a = await s.owner.tasks.start('x', [1], { key: true }), b = await old.tasks.start('x', [1], { key: true });
        const failure = { type: 'message', message: { type: 'exception', task: update.tasks[0], exception: 'denied' } };
        const checks = [expect(a.promise).rejects.toEqual(failure.message), expect(b.promise).rejects.toEqual(failure.message)];
        s.event('message', envelope(failure)); old.event('message', envelope(failure)); await Promise.all(checks);
        expect(s.notify.error.mock.calls).toEqual(oldNotify.error.mock.calls);
        s.event('message', envelope({ type: 'update', tasks: [] })); expect(s.owner.tasks.state.tasks).toEqual([]);
        old.close(); s.owner.dispose();
    });
    it('keeps pending task over reconnect, rejects on disposal, ignores malformed messages and exposes request failure', async () => {
        const s = setup(), task = await s.owner.tasks.start('x');
        s.event('disconnect'); s.event('connect'); expect(s.http.post).toHaveBeenCalledTimes(1);
        s.event('message', '{broken'); s.event('message', null);
        s.http.get.mockRejectedValueOnce(new Error('offline')); s.event('connect'); await vi.waitFor(() => expect(s.owner.state.error?.message).toBe('offline'));
        const rejected = expect(task.promise).rejects.toThrow('disposed'); s.owner.dispose(); await rejected;
        await expect(s.owner.tasks.start('x')).rejects.toThrow('disposed');
    });
});
