import { expect, it, vi } from 'vitest';
import { createAjentiAdapter } from './ajenti.mjs';
import { createMockAj } from './mock.mjs';

function scope() {
    const listeners = new Map();
    return {
        $on: (name, fn) => {
            const entries = listeners.get(name) ?? new Set();
            entries.add(fn); listeners.set(name, entries);
            return () => entries.delete(fn);
        },
        fire: (name, event) => [...(listeners.get(name) ?? [])].forEach(fn => fn(event)),
        count: name => listeners.get(name)?.size ?? 0,
    };
}
function adapter($scope) {
    return createAjentiAdapter({ $scope, identity: {}, gettextCatalog: { getString: text => text } });
}
it('allows a location change unless a synchronous guard returns exactly false', () => {
    const $scope = scope(), aj = adapter($scope), event = { preventDefault: vi.fn() };
    const guard = vi.fn(() => true);
    aj.guardLeave(guard);
    $scope.fire('$locationChangeStart', event);
    expect(guard.mock.calls).toEqual([[]]);
    expect(event.preventDefault.mock.calls).toEqual([]);
    guard.mockReturnValue(undefined); $scope.fire('$locationChangeStart', event);
    expect(event.preventDefault.mock.calls).toEqual([]);
    guard.mockReturnValue(false); $scope.fire('$locationChangeStart', event);
    expect(event.preventDefault.mock.calls).toEqual([[]]);
});
it('unsubscribes idempotently and removes its destroy listener', () => {
    const $scope = scope(), guard = vi.fn(() => false), off = adapter($scope).guardLeave(guard);
    off(); off(); $scope.fire('$locationChangeStart', { preventDefault: vi.fn() });
    expect(guard.mock.calls).toEqual([]);
    expect([$scope.count('$locationChangeStart'), $scope.count('$destroy')]).toEqual([0, 0]);
});
it('removes each guard on bridge scope destruction', () => {
    const $scope = scope(), aj = adapter($scope), guard = vi.fn(() => false);
    const off = aj.guardLeave(guard); aj.guardLeave(guard);
    $scope.fire('$destroy'); off();
    $scope.fire('$locationChangeStart', { preventDefault: vi.fn() });
    expect(guard.mock.calls).toEqual([]);
    expect([$scope.count('$locationChangeStart'), $scope.count('$destroy')]).toEqual([0, 0]);
});
it('mock accepts the same guard registration and unsubscribe contract', () => {
    const off = vi.fn(), guardLeave = vi.fn(() => off), fn = () => false;
    expect(typeof createMockAj().guardLeave(fn)).toBe('function');
    createMockAj({ guardLeave }).guardLeave(fn)();
    expect(guardLeave.mock.calls).toEqual([[fn]]); expect(off.mock.calls).toEqual([[]]);
});
