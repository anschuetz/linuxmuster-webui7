import { afterEach, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { createAjentiAdapter } from '../adapter/ajenti.mjs';
import { openWait } from './wait.mjs';
const base = () => ({ identity: {}, gettextCatalog: { getString: (text) => `translated:${text}` } });
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('keeps a static translated spinner open on Escape/backdrop and cleans up on close', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const wait = openWait(createAjentiAdapter(base()), { status: 'Working', style: 'spinner' });
    expect(document.querySelector('.modal-header').textContent).toBe('translated:Working');
    expect(document.querySelector('.spinner')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.querySelector('.modal').click();
    await nextTick();
    expect(document.querySelector('.modal')).not.toBeNull();
    wait.close(); wait.close();
    await wait.result;
    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
    wait.update(80);
    await nextTick();
    expect(document.querySelector('.modal')).toBeNull();
});
it('updates indeterminate progress from a percentage or value/max', async () => {
    const wait = openWait(createAjentiAdapter(base()), { status: 'Saving', style: 'progressbar' });
    expect(document.querySelector('.progress-bar').classList.contains('indeterminate')).toBe(true);
    wait.update({ value: 3, max: 4 });
    await nextTick();
    expect(document.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('75');
    expect(document.querySelector('.progress-bar').style.width).toBe('75%');
    wait.update(40);
    await nextTick();
    expect(document.querySelector('.progress-bar').style.width).toBe('40%');
    wait.update({ value: 0, max: 0 });
    await nextTick();
    expect(document.querySelector('[role="progressbar"]').hasAttribute('aria-valuenow')).toBe(false);
    wait.close(); await wait.result;
});
it('disposes with Vue scope or Angular bridge without retained listeners', async () => {
    const listeners = new Set();
    const aj = createAjentiAdapter({ ...base(), $scope: {
        $on: (event, fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    } });
    const scope = effectScope();
    const wait = scope.run(() => openWait(aj));
    scope.stop(); await wait.result;
    expect(listeners.size).toBe(0);
    const second = openWait(aj);
    [...listeners].forEach((fn) => fn());
    await expect(second.result).rejects.toThrow('Modal cancelled');
    expect(listeners.size).toBe(0);
    expect(document.querySelector('.modal')).toBeNull();
});
