import { expect, it, vi } from 'vitest';
import { createMockAj } from './mock.mjs';
import { mountBridge } from '../bridge/mount.mjs';
it.each(['success', 'info', 'warning', 'error'])('delegates sticky %s through the bridge to toaster in the digest', (level) => {
    const queue = [];
    const services = {
        identity: {}, gettext: (text) => text,
        notify: { [level]: vi.fn() }, toaster: { pop: vi.fn() },
        $rootScope: { $evalAsync: (fn) => queue.push(fn) },
    };
    let aj;
    mountBridge({ $on: vi.fn() }, document.createElement('div'), {
        mount: (host, adapter) => { aj = adapter; return () => {}; },
    }, services);
    aj.notify[level]('Title', 'Text', { sticky: true });
    expect(services.toaster.pop).not.toHaveBeenCalled();
    queue.shift()();
    expect(services.toaster.pop).toHaveBeenCalledWith({ type: level, title: 'Title', body: 'Text', timeout: 0 });
    expect(services.notify[level]).not.toHaveBeenCalled();
    aj.notify[level]('Normal', 'Text', { sticky: false });
    queue.shift()();
    expect(services.notify[level]).toHaveBeenCalledWith('Normal', 'Text');
});
it('forwards mock notification options while preserving ordinary calls', () => {
    const notify = vi.fn();
    const aj = createMockAj({ notify });
    aj.notify.error('Title', 'Text', { sticky: true });
    expect(notify).toHaveBeenCalledWith('error', 'Title', 'Text', { sticky: true });
    aj.notify.error('Title', 'Text');
    expect(notify).toHaveBeenLastCalledWith('error', 'Title', 'Text');
});
