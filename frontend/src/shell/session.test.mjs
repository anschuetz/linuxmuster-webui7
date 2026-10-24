import { afterEach, describe, expect, it, vi } from 'vitest';
import { watchEffect, nextTick } from 'vue';
import { createSession } from './session.mjs';

const response = (data, status = 200) => ({ status, headers: new Headers({ 'Content-Type': 'application/json' }), text: async () => JSON.stringify(data) });
const admin = { identity: { user: 'root', effective: 0, uid: 0, profile: { permissions: ['write'] } }, machine: { name: 'demo' }, color: 'blue' };
function harness(options = {}) {
    const notify = { error: vi.fn() }, messagebox = { show: vi.fn() }, navigate = vi.fn();
    let data = admin, path = '/panel/view/test', time = 2;
    const fetch = vi.fn(async url => {
        if (url.endsWith('/identity')) return response(data);
        if (url.endsWith('/session-time')) return response(time);
        return response(null);
    });
    const session = createSession({ fetch, prefix: '/panel', path: () => path, navigate, notify, messagebox, ...options });
    return { ...session, fetch, notify, messagebox, navigate, setIdentity: value => { data = value; }, setPath: value => { path = value; }, setTime: value => { time = value; } };
}
afterEach(() => vi.useRealTimers());

describe('isolated session core', () => {
    it('publishes reactive fresh identity snapshots, patches profile and removes old rights on anonymous refresh', async () => {
        const h = harness(), seen = [];
        const stop = watchEffect(() => seen.push(h.identity.profile));
        await h.identity.refresh(); await nextTick();
        expect(h.identity.isSuperuser).toBe(true); expect(h.identity.user).toBe('root');
        const old = h.identity.profile; h.identity.patch({ activeSchool: 'demo' }); await nextTick();
        expect(old).toEqual({ permissions: ['write'] }); expect(h.identity.profile.activeSchool).toBe('demo');
        expect(admin.identity.profile).toEqual({ permissions: ['write'] });
        h.setIdentity({ identity: { user: null } }); await h.identity.refresh(); await nextTick();
        expect(h.identity.profile).toEqual({}); expect(h.identity.isSuperuser).toBe(false);
        expect(seen.length).toBeGreaterThan(2); stop(); h.dispose();
    });
    it('counts down, refreshes remaining time on activity, logs out once and redirects after one second', async () => {
        vi.useFakeTimers(); const h = harness(); await h.start();
        expect(h.state.remaining).toBe(2); expect(h.state.counter).toEqual(['00', '00', '02']);
        await vi.advanceTimersByTimeAsync(1000); expect(h.state.remaining).toBe(1);
        h.setTime(4); await h.activity(); expect(h.state.remaining).toBe(4);
        await vi.advanceTimersByTimeAsync(5000);
        expect(h.fetch.mock.calls.filter(([url]) => url.endsWith('/logout'))).toHaveLength(1);
        expect(h.identity.user).toBe(null); expect(h.navigate).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1000);
        expect(h.navigate).toHaveBeenCalledExactlyOnceWith('/panel/view/login/normal//panel/view/test'); h.dispose();
    });
    it('skips session activity and expired redirects on every login mode', async () => {
        const h = harness(); h.setPath('/panel/view/login/sudo:root/next');
        await h.start(); expect(h.fetch.mock.calls).toHaveLength(1);
        h.fetch.mockResolvedValue(response('bad login', 401));
        await expect(h.http.post('/api/core/auth', {})).rejects.toMatchObject({ status: 401 });
        expect(h.navigate).not.toHaveBeenCalled(); expect(h.notify.error).not.toHaveBeenCalled(); h.dispose();
    });
    it('handles parallel 401 once, clears rights, refreshes after login and can expire a new session', async () => {
        const h = harness(); await h.start(); h.fetch.mockImplementation(async () => response('expired', 401));
        await Promise.allSettled([h.http.get('/one'), h.http.get('/two')]);
        expect(h.notify.error).toHaveBeenCalledTimes(1); expect(h.navigate).toHaveBeenCalledTimes(1);
        expect(h.identity.profile).toEqual({}); expect(h.identity.isSuperuser).toBe(false);
        h.fetch.mockResolvedValueOnce(response({ identity: { user: 'teacher', effective: 1000, profile: { permissions: ['read'] } } }));
        await h.identity.refresh(); expect(h.identity.user).toBe('teacher'); expect(h.identity.profile.permissions).toEqual(['read']);
        await h.http.get('/again').catch(() => {}); expect(h.navigate).toHaveBeenCalledTimes(2); h.dispose();
    });
    it.each([
        [403, 'denied', ['Security error', 'denied'], false],
        [500, { exception: 'SecurityError', message: 'no' }, ['Security error', 'no'], false],
        [500, { exception: 'EndpointError' }, null, false],
        [500, { exception: 'Failure' }, null, true],
    ])('keeps %s errors separate from expiry', async (status, data, notice, dialog) => {
        const h = harness(); await h.identity.refresh(); h.fetch.mockResolvedValue(response(data, status));
        await expect(h.http.get('/api')).rejects.toMatchObject({ status, data });
        if (notice) expect(h.notify.error).toHaveBeenCalledWith(...notice); else expect(h.notify.error).not.toHaveBeenCalled();
        expect(h.messagebox.show).toHaveBeenCalledTimes(dialog ? 1 : 0);
        expect(h.navigate).not.toHaveBeenCalled(); expect(h.identity.user).toBe('root'); h.dispose();
    });
    it('does not restore stale identity or expire a new login from an older request', async () => {
        const h = harness(); let resolveOld;
        h.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
        const old = h.identity.refresh(); await h.identity.refresh();
        resolveOld(response({ identity: { user: 'old', effective: 0, profile: { old: true } } })); await old;
        expect(h.identity.user).toBe('root');
        h.fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
        const pending = h.http.get('/old'); await h.identity.refresh();
        resolveOld(response('expired', 401)); await pending.catch(() => {});
        expect(h.navigate).not.toHaveBeenCalled(); expect(h.identity.user).toBe('root'); h.dispose();
    });
    it('disposes timers and ignores pending responses, including logout redirect', async () => {
        vi.useFakeTimers(); const h = harness(); await h.start();
        const logout = h.logout(); h.dispose(); await logout;
        await vi.advanceTimersByTimeAsync(10000); expect(h.navigate).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
        await expect(h.identity.refresh()).rejects.toThrow('disposed');
    });
    it('clears rights on refresh failure and propagates session-time failure', async () => {
        const h = harness(); await h.start(); h.fetch.mockResolvedValue(response('failed', 403));
        await expect(h.identity.refresh()).rejects.toMatchObject({ status: 403 });
        expect(h.identity.profile).toEqual({}); expect(h.identity.user).toBe(null);
        await expect(h.activity()).rejects.toMatchObject({ status: 403 }); h.dispose();
    });
});

it('keeps countdown active when a plugin refreshes identity', async () => {
    vi.useFakeTimers();
    const h = harness(); await h.start();
    await h.identity.refresh(); await vi.advanceTimersByTimeAsync(1000);
    expect(h.state.remaining).toBe(1); h.dispose();
});

it('does not publish pending identity or activity after disposal', async () => {
    const h = harness(); let resolve;
    h.fetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = h.identity.refresh(); h.dispose(); resolve(response(admin)); await pending;
    expect(h.identity.user).toBe(null);
    const other = harness(); await other.identity.refresh();
    other.fetch.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const activity = other.activity(); other.dispose(); resolve(response(30)); await activity;
    expect(other.state.remaining).toBe(0);
});
