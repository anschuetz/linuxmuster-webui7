import { afterEach, expect, it, vi } from 'vitest';
import { browser } from './browser.mjs';
afterEach(() => vi.restoreAllMocks());
it('opens a BBB tab and builds the same public URL', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => {});
    browser.open('https://bbb.example/join'); expect(open.mock.calls).toEqual([['https://bbb.example/join', '_blank']]);
    expect(browser.publicUrl('session')).toEqual(`${window.location.origin}/websession/session`);
});
it('copies via a temporary selected textarea and removes it', () => {
    const copies = [];
    document.execCommand = vi.fn((command) => { copies.push([command, document.querySelector('textarea').value]); return true; });
    browser.copy('https://webui.example/websession/session');
    expect(copies).toEqual([['copy', 'https://webui.example/websession/session']]); expect(document.querySelector('textarea')).toEqual(null);
});
