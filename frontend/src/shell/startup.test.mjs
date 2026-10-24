import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { start } from './startup.mjs';
it('always starts Vue despite an old Angular query or persisted choice', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ version: 1, plugins: [] })));
    const mount = vi.fn();
    await start({ prefix: '', plugins: {}, defaultShell: 'angular' }, {
        url: new URL('https://fixture/view/?shell=angular'),
        storage: { getItem: () => 'angular' }, fetch, load: async () => {}, mount,
    });
    expect(fetch).toHaveBeenCalledExactlyOnceWith('/resources/lmn_common/resources/vue/manifest.json');
    expect(mount).toHaveBeenCalledOnce();
});
it('loads only explicit non-Angular scripts in Vue mode, restricts plugin resources to installed plugins', async () => {
    const loaded = [], mounted = vi.fn();
    await start({ prefix: '/panel', plugins: { lmn_links: 'Links', core: 'Core', 'lmn.device-manager': 'Device Manager' }, config: {} }, {
        url: new URL('https://fixture/panel/view/?shell=vue'), storage: { getItem: () => null, setItem() {} },
        fetch: async () => new Response(JSON.stringify({ version: 1, plugins: [{ id: 'lmn_links', resource: 'lmn_links/resources/vue/lmn_links.js' }, { id: 'lmn_users', resource: 'lmn_users/resources/vue/lmn_users.js' }, { id: 'lmn.device-manager', resource: 'lmn_common/resources/vue/lmn_device-manager.js' }] })),
        load: async src => loaded.push(src), mount: mounted,
    });
    expect(loaded).toContain('/panel/resources/lmn_links/resources/vue/lmn_links.js');
    expect(loaded).toContain('/panel/resources/lmn_common/resources/vue/lmn_device-manager.js');
    expect(loaded.some(s => s.includes('lmn_users'))).toBe(false);
    expect(loaded.some(s => /all\.|angular|bridge/.test(s))).toBe(false);
    expect(loaded[0]).toBe('/panel/resources/lmn_common/resources/vue/vendor.js'); expect(mounted).toHaveBeenCalledTimes(1);
});
it('evaluates the built shell in a browser without a Node process global', async () => {
    const { runInNewContext } = await import('node:vm');
    const Vue = await import('vue');
    const browser = { Vue };
    runInNewContext(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/shell.js', 'utf8'), browser);
    expect(typeof browser.LmnVueShell.mountShell).toBe('function');
});
