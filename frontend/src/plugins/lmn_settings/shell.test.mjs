import { afterEach, expect, it, vi } from 'vitest';
import { readCustomization, watchSidebar } from './shell.mjs';

afterEach(() => vi.unstubAllGlobals());

it('observes the Core layout without writing shell state and releases its watcher', () => {
    let listener;
    const off = vi.fn();
    const scope = { showSidebar: true, $watch: vi.fn((name, callback) => { listener = callback; return off; }) };
    vi.stubGlobal('angular', { element: () => ({ scope: () => scope }) });
    const changed = vi.fn();
    const stop = watchSidebar(changed);
    expect(changed.mock.calls).toEqual([[true]]);
    listener(false); expect(changed.mock.calls).toEqual([[true], [false]]);
    expect(scope.showSidebar).toBe(true);
    stop(); expect(off.mock.calls).toEqual([[]]);
});

it('reads the immutable shell customization through the approved local transition', () => {
    const customization = { plugins: { settings: { hideLanguageSettings: true } } };
    const get = vi.fn(() => customization);
    vi.stubGlobal('angular', { element: () => ({ injector: () => ({ get }) }) });
    expect(readCustomization()).toEqual(customization);
    expect(get.mock.calls).toEqual([['customization']]);
});
