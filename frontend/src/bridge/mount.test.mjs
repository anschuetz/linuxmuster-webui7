import { expect, it, vi } from 'vitest';
import { createApp, h, nextTick } from 'vue';
import { mountBridge } from './mount.mjs';
import { demo } from '../plugins/lmn_common/entry.mjs';

function scope() {
    const listeners = new Set();
    const fakeScope = {
        listeners,
        $on: vi.fn((event, handler) => {
            expect(event).toBe('$destroy');
            listeners.add(handler);
            return () => listeners.delete(handler);
        }),
        $evalAsync: vi.fn((callback) => callback()),
        destroy: () => {
            [...listeners].forEach((listener) => listener());
            fakeScope.$evalAsync = vi.fn();
        },
    };
    return fakeScope;
}

function services() {
    return { $rootScope: { $evalAsync: vi.fn((callback) => callback()) }, $http: {}, notify: { info: vi.fn() }, gettextCatalog: { getString: (text) => text }, identity: {}, $location: { path: vi.fn() } };
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
    expect(deps.$rootScope.$evalAsync).toHaveBeenCalled();
    expect(deps.$location.path).toHaveBeenCalledWith('/view/lmn/links');
    aj.notify.info('Title', 'Text');
    expect(deps.notify.info).toHaveBeenCalledWith('Title', 'Text');
    expect($scope.listeners.size).toBe(1);
    $scope.destroy();
    $scope.destroy();
    expect(unmount).toHaveBeenCalledTimes(1);
    expect($scope.listeners.size).toBe(0);
});

it('renders the actual demo entry, including late identity, and removes its DOM on destroy', async () => {
    const $scope = scope();
    const host = document.createElement('div');
    const deps = services();
    let loaded;
    deps.identity.promise = new Promise((resolve) => { loaded = resolve; });
    mountBridge($scope, host, demo, deps);
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

it('delivers a late error notification after the directive scope is destroyed', () => {
    const $scope = scope();
    const deps = { ...services(), $rootScope: { $evalAsync: vi.fn((callback) => callback()) }, notify: { error: vi.fn() } };
    const entry = { mount: vi.fn(() => vi.fn()) };
    mountBridge($scope, document.createElement('div'), entry, deps);
    const [, aj] = entry.mount.mock.calls[0];
    $scope.destroy();
    aj.notify.error('Save failed', 'Late POST response');
    expect(deps.notify.error).toHaveBeenCalledWith('Save failed', 'Late POST response');
});

function translationServices() {
    const listeners = new Set();
    let translated = 'Hello';
    return {
        ...services(),
        $rootScope: {
            $on: vi.fn((event, listener) => {
                expect(event).toBe('gettextLanguageChanged');
                listeners.add(listener);
                return () => listeners.delete(listener);
            }),
        },
        gettextCatalog: { getString: () => translated },
        listeners,
        loadCatalog(text) {
            translated = text;
            [...listeners].forEach((listener) => listener());
        },
    };
}

const translatedEntry = {
    mount(host, aj) {
        const app = createApp({ render: () => h('span', aj.gettext('Hello')) });
        app.mount(host);
        return () => app.unmount();
    },
};

it('retranslates an already rendered Vue template after language and catalog changes', async () => {
    const deps = translationServices();
    const $scope = scope();
    const host = document.createElement('div');
    mountBridge($scope, host, translatedEntry, deps);
    expect(host.textContent).toBe('Hello');
    deps.loadCatalog('Hallo');
    await nextTick();
    expect(host.textContent).toBe('Hallo');
    deps.loadCatalog('Guten Tag');
    await nextTick();
    expect(host.textContent).toBe('Guten Tag');
    $scope.destroy();
    expect(deps.listeners.size).toBe(0);
    expect(host.textContent).toBe('');
});

it('removes the translation listener when entry mounting fails', () => {
    const deps = translationServices();
    expect(() => mountBridge(scope(), document.createElement('div'), {
        mount() { throw new Error('mount failed'); },
    }, deps)).toThrow('mount failed');
    expect(deps.listeners.size).toBe(0);
});
