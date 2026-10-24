import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import { createMemoryHistory } from 'vue-router';
import { createShellRouter, shellRoutes } from './router.mjs';
const owners = [];
afterEach(() => { owners.splice(0).forEach(o => o.dispose()); });
function setup(prefix = '') {
    const onRoute = vi.fn(), owner = createShellRouter({ prefix, history: createMemoryHistory(prefix), onRoute });
    owners.push(owner); return { ...owner, onRoute };
}
it('registers every inventoried route, including admin, CSV, device-manager and stock routes', () => {
    const original = JSON.parse(readFileSync('test-fixtures/shell/routes.json', 'utf8'));
    expect(shellRoutes.filter(r => r.path !== '/').map(r => r.path.replace('/:nextPage(.*)*', '/:nextPage*')).sort()).toEqual(original.sort());
    for (const path of ['/view/lmn/users/globaladmins', '/view/lmn/users/schooladmins', '/view/lmn/users/listmanagement', '/view/lmn/users/print-passwords', '/view/lmn/device-manager', '/view/settings', '/view/plugins', '/view/dashboard', '/view/session_list']) {
        expect(shellRoutes.find(r => r.path === path)).toBeDefined();
    }
});
it('preserves prefix, query, hash and login/reset parameters and redirects LM home', async () => {
    const o = setup('/panel');
    await o.navigate('/panel/view/lmn/users/students?x=1#row');
    expect(o.router.currentRoute.value.fullPath).toBe('/view/lmn/users/students?x=1#row');
    expect(o.router.resolve('/view/settings').href).toBe('/panel/view/settings');
    await o.navigate('/view/login/sudo:root/old/path');
    expect(o.router.currentRoute.value.params).toEqual({ mode: 'sudo:root', nextPage: ['old', 'path'] });
    await o.navigate('/view/reset_password/a%20b');
    expect(o.router.currentRoute.value.params.serial).toBe('a b');
    await o.navigate('/');
    expect(o.router.currentRoute.value.path).toBe('/view/lmn/landingpage');
    await o.navigate('/view/does-not-exist');
    expect(o.router.currentRoute.value.meta.kind).toBe('404');
});
it('honors leave guards, reloads and removes route registrations on cleanup', async () => {
    const o = setup(); await o.navigate('/view/settings');
    const off = o.guardLeave(() => false);
    await o.navigate('/view/plugins'); expect(o.router.currentRoute.value.path).toBe('/view/settings');
    off(); off(); await o.navigate('/view/plugins');
    const before = o.onRoute.mock.calls.length; o.reload(); expect(o.onRoute).toHaveBeenCalledTimes(before + 1);
    o.dispose(); await o.navigate('/view/dashboard'); expect(o.onRoute).toHaveBeenCalledTimes(before + 1);
});
it('does not register routes for plugins absent from the bootstrap inventory', async () => {
    const o = createShellRouter({ history: createMemoryHistory(), plugins: ['lmn_links'] }); owners.push(o);
    await o.navigate('/view/lmn/users/students'); expect(o.router.currentRoute.value.meta.kind).toBe('404');
    await o.navigate('/view/lmn/links'); expect(o.router.currentRoute.value.meta.kind).toBe('plugin');
});
