import { expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { mountBridge } from './mount.mjs';
import { mount } from '../entry.mjs';

function scope() {
    const listeners = new Set();
    return {
        listeners,
        $on: vi.fn((event, handler) => {
            expect(event).toBe('$destroy');
            listeners.add(handler);
            return () => listeners.delete(handler);
        }),
        $evalAsync: vi.fn((callback) => callback()),
        destroy: () => [...listeners].forEach((listener) => listener()),
    };
}

function services() {
    return { $http: {}, notify: { info: vi.fn() }, gettext: (text) => text, identity: {}, $location: { path: vi.fn() } };
}

it('mounts the selected entry with an adapter and unmounts once without leaked listeners', () => {
    const host = document.createElement('div');
    const $scope = scope();
    const unmount = vi.fn();
    const entry = { mount: vi.fn(() => unmount) };
    const deps = services();
    mountBridge($scope, host, entry, deps);
    const [element, aj] = entry.mount.mock.calls[0];
    expect(element).toBe(host);
    expect(aj.gettext('Hello')).toBe('Hello');
    aj.navigate('/view/lmn/links');
    expect($scope.$evalAsync).toHaveBeenCalled();
    expect(deps.$location.path).toHaveBeenCalledWith('/view/lmn/links');
    aj.notify.info('Title', 'Text');
    expect(deps.notify.info).toHaveBeenCalledWith('Title', 'Text');
    expect($scope.listeners.size).toBe(1);
    $scope.destroy();
    $scope.destroy();
    expect(unmount).toHaveBeenCalledTimes(1);
    expect($scope.listeners.size).toBe(0);
});

it('renders the actual Vue entry, including late identity, and removes its DOM on destroy', async () => {
    const $scope = scope();
    const host = document.createElement('div');
    const deps = services();
    let loaded;
    deps.identity.promise = new Promise((resolve) => { loaded = resolve; });
    mountBridge($scope, host, { mount }, deps);
    expect(host.textContent).toContain('Frontend ready');
    deps.identity.user = 'teacher';
    loaded();
    await deps.identity.promise;
    await nextTick();
    expect(host.textContent).toContain('teacher');
    $scope.destroy();
    expect(host.textContent).toBe('');
    expect($scope.listeners.size).toBe(0);
});

it('leaves no lifecycle listener behind if mounting fails', () => {
    const $scope = scope();
    const error = new Error('mount failed');
    expect(() => mountBridge($scope, document.createElement('div'), { mount: () => { throw error; } }, services())).toThrow(error);
    expect($scope.listeners.size).toBe(0);
});
