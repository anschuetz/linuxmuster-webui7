import { expect, it, vi } from 'vitest';
import { isReactive, watchEffect, nextTick } from 'vue';
import { createAjentiAdapter } from './ajenti.mjs';

function services() {
    return {
        $http: Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((method) => [method, vi.fn()])),
        notify: Object.fromEntries(['success', 'info', 'warning', 'error'].map((level) => [level, vi.fn()])),
        gettext: vi.fn((text) => text),
        gettextCatalog: { getString: vi.fn((text) => `DE: ${text}`) },
        identity: {},
        $location: { path: vi.fn() },
    };
}

it.each(['get', 'post', 'put', 'delete', 'patch'])('delegates %s to Angular HTTP, retaining response and rejection', async (method) => {
    const deps = services();
    const aj = createAjentiAdapter(deps);
    const response = { data: { ok: true }, status: 201 };
    const cfg = { headers: { Accept: 'application/json' } };
    const args = ['get', 'delete'].includes(method) ? ['/api/test', cfg] : ['/api/test', { value: 1 }, cfg];
    deps.$http[method].mockResolvedValueOnce(response);
    expect(await aj.http[method](...args)).toBe(response);
    expect(deps.$http[method]).toHaveBeenCalledWith(...args);
    const rejection = { data: 'session expired', status: 401 };
    deps.$http[method].mockRejectedValueOnce(rejection);
    await expect(aj.http[method](...args)).rejects.toBe(rejection);
});

it('delegates notifications, translation and navigation to shell services', () => {
    const deps = services();
    const aj = createAjentiAdapter(deps);
    for (const level of ['success', 'info', 'warning', 'error']) {
        aj.notify[level]('Title', 'Text');
        expect(deps.notify[level]).toHaveBeenCalledWith('Title', 'Text');
    }
    expect(aj.gettext('Hello')).toBe('DE: Hello');
    expect(deps.gettextCatalog.getString).toHaveBeenCalledWith('Hello');
    expect(deps.gettext).not.toHaveBeenCalled();
    aj.navigate('/view/lmn/links');
    expect(deps.$location.path).toHaveBeenCalledWith('/view/lmn/links');
});

it('updates Vue effects when Angular loads identity after mount', async () => {
    const deps = services();
    let loaded;
    deps.identity.promise = new Promise((resolve) => { loaded = resolve; });
    const aj = createAjentiAdapter(deps);
    const identity = aj.identity;
    expect(isReactive(identity)).toBe(true);
    const seen = [];
    const stop = watchEffect(() => seen.push([identity.user, identity.profile, identity.isSuperuser]));
    expect(seen).toEqual([[null, {}, false]]);
    Object.assign(deps.identity, { user: 'admin', profile: { role: 'admin' }, isSuperuser: true });
    loaded();
    await deps.identity.promise;
    await nextTick();
    expect(aj.identity).toBe(identity);
    expect(seen.at(-1)).toEqual(['admin', { role: 'admin' }, true]);
    stop();
});

it('uses an already loaded identity and tolerates failed identity loading', async () => {
    const deps = services();
    deps.identity = { user: 'root', profile: { role: 'admin' }, isSuperuser: true, promise: Promise.reject('failed') };
    const aj = createAjentiAdapter(deps);
    await deps.identity.promise.catch(() => {});
    expect(aj.identity).toEqual({ user: 'root', profile: { role: 'admin' }, isSuperuser: true, patch: aj.identity.patch, refresh: aj.identity.refresh });
});

it('reloads the route inside the Angular digest', () => {
    const deps = { ...services(), $route: { reload: vi.fn() }, $rootScope: { $evalAsync: vi.fn() } };
    createAjentiAdapter(deps).reload();
    expect(deps.$route.reload).not.toHaveBeenCalled();
    deps.$rootScope.$evalAsync.mock.calls[0][0]();
    expect(deps.$route.reload).toHaveBeenCalledOnce();
});

it('replaces the full browser location for the password-change redirect', () => {
    const browserLocation = { replace: vi.fn() };
    const deps = { ...services(), browserLocation };
    const aj = createAjentiAdapter(deps);
    aj.navigate('landingpage', { replace: true });
    expect(browserLocation.replace.mock.calls).toEqual([['landingpage']]);
    expect(deps.$location.path.mock.calls).toEqual([]);
});

it('patches the shell profile inside the digest and then publishes the Vue snapshot', async () => {
    const deps = { ...services(), identity: { profile: { activeSchool: 'old', school_show: true } }, $rootScope: { $evalAsync: vi.fn() } };
    const aj = createAjentiAdapter(deps);
    const previous = deps.identity.profile;
    const seen = [];
    const stop = watchEffect(() => seen.push(aj.identity.profile.activeSchool));
    aj.identity.patch({ activeSchool: 'new', schoolname: 'New School' });
    expect(deps.$rootScope.$evalAsync).toHaveBeenCalledOnce();
    expect(deps.identity.profile).toBe(previous);
    expect(seen).toEqual(['old']);
    deps.$rootScope.$evalAsync.mock.calls[0][0]();
    await nextTick();
    expect(previous).toEqual({ activeSchool: 'old', school_show: true });
    expect(deps.identity.profile).toEqual({ activeSchool: 'new', schoolname: 'New School', school_show: true });
    expect(aj.identity.profile).toEqual(deps.identity.profile);
    expect(seen).toEqual(['old', 'new']);
    stop();
});

it('refreshes shell identity in the digest, publishes the new snapshot and forwards init failures', async () => {
    const deps = services();
    deps.$rootScope = { $evalAsync: vi.fn() };
    deps.identity = { user: 'zem', profile: { projects: [] }, init: vi.fn(async () => { deps.identity.profile = { projects: ['p73'] }; }) };
    const aj = createAjentiAdapter(deps), stable = aj.identity;
    const refreshed = aj.identity.refresh();
    expect(deps.identity.init.mock.calls).toEqual([]);
    deps.$rootScope.$evalAsync.mock.calls[0][0](); await refreshed;
    expect(deps.identity.init.mock.calls).toEqual([[]]); expect(aj.identity).toBe(stable); expect(aj.identity.profile).toEqual({ projects: ['p73'] });
    deps.identity.init.mockRejectedValueOnce('failed'); const failed = aj.identity.refresh(); deps.$rootScope.$evalAsync.mock.calls[1][0](); await expect(failed).rejects.toBe('failed');
    deps.identity.init.mockImplementationOnce(() => { throw new Error('sync'); }); const sync = aj.identity.refresh(); deps.$rootScope.$evalAsync.mock.calls[2][0](); await expect(sync).rejects.toThrow('sync');
});
