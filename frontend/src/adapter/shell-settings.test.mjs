import { expect, it, vi } from 'vitest';
import { createAjentiAdapter } from './ajenti.mjs';
import { createMockAj } from './mock.mjs';

it('changes language through the shell digest, retaining resolution and rejection', async () => {
    const queue = [];
    const locale = { setLanguage: vi.fn().mockResolvedValue('loaded') };
    const aj = createAjentiAdapter({ identity: {}, locale, $rootScope: { $evalAsync: fn => queue.push(fn) } });
    const loaded = aj.locale.setLanguage('de');
    expect(locale.setLanguage.mock.calls).toEqual([]);
    queue.shift()();
    expect(await loaded).toBe('loaded');
    expect(locale.setLanguage.mock.calls).toEqual([['de']]);
    const error = new Error('locale failed');
    locale.setLanguage.mockRejectedValueOnce(error);
    const failed = aj.locale.setLanguage('en');
    queue.shift()();
    await expect(failed).rejects.toBe(error);
    const mock = createMockAj({ locale });
    expect(await mock.locale.setLanguage('de')).toBe('loaded');
    expect(await createMockAj().locale.setLanguage('de')).toBeUndefined();
});

it('restarts through the existing shell confirmation in the digest', async () => {
    const queue = [];
    const core = { restart: vi.fn().mockResolvedValue('confirmed') };
    const aj = createAjentiAdapter({ identity: {}, core, $rootScope: { $evalAsync: fn => queue.push(fn) } });
    const restarting = aj.restart();
    expect(core.restart.mock.calls).toEqual([]);
    queue.shift()();
    expect(await restarting).toBe('confirmed');
    expect(core.restart.mock.calls).toEqual([[]]);
    const error = new Error('cancelled');
    core.restart.mockImplementationOnce(() => { throw error; });
    const failed = aj.restart();
    queue.shift()();
    await expect(failed).rejects.toBe(error);
    const restart = vi.fn().mockResolvedValue('restarted');
    expect(await createMockAj({ restart }).restart()).toBe('restarted');
    expect(restart.mock.calls).toEqual([[]]);
    expect(await createMockAj().restart()).toBeUndefined();
});
