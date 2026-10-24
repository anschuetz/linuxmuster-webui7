import { afterEach, expect, it, vi } from 'vitest';
import { openUsersCheck, readCustomization } from './shell.mjs';

afterEach(() => vi.unstubAllGlobals());

it('reads the immutable shell customization through the approved local transition', () => {
    const customization = { plugins: { settings: { hideLanguageSettings: true } } };
    const get = vi.fn(() => customization);
    vi.stubGlobal('angular', { element: () => ({ injector: () => ({ get }) }) });
    expect(readCustomization()).toEqual(customization);
    expect(get.mock.calls).toEqual([['customization']]);
});

it('opens exactly the existing Users dialog chain in the shell digest', async () => {
    const queue = [];
    const modal = { result: Promise.resolve('closed') };
    const open = vi.fn(() => modal);
    const scope = { $evalAsync: fn => queue.push(fn) };
    const get = vi.fn(name => ({ $rootScope: scope, $uibModal: { open } })[name]);
    vi.stubGlobal('angular', { element: () => ({ injector: () => ({ get }) }) });
    const done = openUsersCheck();
    expect(open.mock.calls).toEqual([]);
    queue.shift()();
    expect(await done).toBe('closed');
    expect(open.mock.calls).toEqual([[{ templateUrl: '/lmn_users:resources/partial/check.modal.html', controller: 'LMUsersCheckModalController', backdrop: 'static' }]]);
});
