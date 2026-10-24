import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { selectShell, renderLegacy, start } from './startup.mjs';
it('keeps the old entry reachable via query/config and remembers the explicit browser selection', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    expect(selectShell({ config: {} }, new URL('https://fixture/view/?shell=vue'), storage)).toBe('vue');
    expect(storage.setItem).toHaveBeenCalledWith('lmn-shell', 'vue');
    expect(selectShell({ config: {}, defaultShell: 'angular' }, new URL('https://fixture/view/'), storage)).toBe('angular');
    expect(selectShell({ config: {} }, new URL('https://fixture/view/?shell=angular'), storage)).toBe('angular');
});
it('renders the unchanged Angular template bootstrap using the same server values', () => {
    const original = readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/content/main_view.angular.html', 'utf8');
    const html = renderLegacy(original, { prefix: '/panel', config: { language: 'en' }, plugins: { core: 'Core' }, platform: 'linux', platformUnmapped: 'Linux', version: '2', devMode: 'False', pwReset: 'True', bootstrapColor: 'blue' });
    expect(html).toContain('/panel/resources/all.vendor.js'); expect(html).toContain("constant('pwReset', 'True')");
    expect(html).not.toContain('%(');
});
it('loads only explicit non-Angular scripts in Vue mode, restricts plugin resources to installed plugins', async () => {
    const loaded = [], mounted = vi.fn();
    await start({ prefix: '/panel', plugins: { lmn_links: 'Links', core: 'Core' }, config: {} }, {
        url: new URL('https://fixture/panel/view/?shell=vue'), storage: { getItem: () => null, setItem() {} },
        fetch: async () => new Response(JSON.stringify({ version: 1, plugins: ['lmn_links', 'lmn_users'] })),
        load: async src => loaded.push(src), mount: mounted,
    });
    expect(loaded).toContain('/panel/resources/lmn_links/resources/vue/lmn_links.js');
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
