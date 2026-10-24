import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountNavigationHarness } from './navigation-harness.mjs';
import { createSession } from './session.mjs';
import { navigationServer, permission } from '../../test-fixtures/shell/navigation-server.mjs';
import { navigationOracle } from '../../test-fixtures/shell/navigation.mjs';
import { openUsersCheck } from '../common/users/check.mjs';
import { mount as mountSchool } from '../plugins/lmn_settings/entry.mjs';

const cleanups = [];
afterEach(async () => { for (const fn of cleanups.splice(0).reverse()) await fn(); vi.unstubAllGlobals(); });
async function setup(role, extra = {}) {
    const server = await navigationServer(role, extra); cleanups.push(server.close);
    const routes = [], notices = [], reload = vi.fn(), element = document.createElement('div'); document.body.append(element);
    const session = createSession({ fetch: server.fetch, prefix: '/panel', path: () => '/panel/view/lmn/settings', navigate: value => routes.push(value),
        notify: { error: text => notices.push(text) }, messagebox: { show: () => Promise.resolve() } });
    const owner = mountNavigationHarness(element, { session, prefix: '/panel', navigate: url => routes.push(url), reload, storage: {}, ...extra });
    cleanups.push(() => { owner.dispose(); element.remove(); });
    await owner.ready; await flushPromises();
    return { ...owner, server, routes, notices, element, reload };
}
it.each(['globaladministrator', 'schooladministrator', 'teacher', 'student'])('passes through synthetic sidebar, identity and API responses for fixture role %s (no authorization oracle)', async role => {
    const s = await setup(role);
    expect(s.element.querySelector('.school-change') !== null).toBe(role !== 'student');
    expect(s.element.textContent).toContain(`fixture-${role}`);
    expect(s.element.textContent).toContain('fixture-server');
    expect(s.element.textContent).toContain(`UID ${role === 'globaladministrator' ? 0 : 1000}`);
    const old = navigationOracle({ sidebar: JSON.parse(JSON.stringify(s.nav.sidebar.item)) }); cleanups.push(old.close);
    const element = old.mount('<core-sidebar></core-sidebar>'); await flushPromises(); old.flush();
    const links = node => [...node.querySelectorAll('a.link')].map(a => a.getAttribute('href'));
    expect(links(s.element.querySelector('.sidebar.hide-tablet'))).toEqual(links(element));
    expect(links(element).includes('/panel/view/lmn/users/students/')).toBe(permission(role, 'sidebar:view:/view/lmn/users/students'));
    const request = s.aj.http.get('/api/lmn/users/students');
    if (permission(role, 'lm:users:students:read')) await expect(request).resolves.toMatchObject({ status: 200 });
    else await expect(request).rejects.toMatchObject({ status: 403 });
    // Navbox is deliberately not filtered by sidebar rights in Core's provider search.
    s.nav.setQuery('Students');
    await vi.waitFor(() => expect(s.nav.search.results?.[0].url).toBe('/view/lmn/users/students'));
    s.nav.openResult(s.nav.search.results[0]); expect(s.routes.at(-1)).toBe('/view/lmn/users/students');
    const check = s.aj.http.get('/api/lmn/users/lists/check');
    if (permission(role, 'lm:users:check')) await expect(check).resolves.toMatchObject({ status: 200 });
    else await expect(check).rejects.toMatchObject({ status: 403 });
});
it('runs Settings save → Check → Results → Apply with the shared Vue modal service, then reloads after Close', async () => {
    vi.stubGlobal('angular', undefined);
    const s = await setup('schooladministrator');
    const host = document.createElement('div'); const stop = mountSchool(host, s.aj); cleanups.push(stop); await flushPromises();
    let button;
    await vi.waitFor(() => { button = [...host.querySelectorAll('floating-toolbar button')].find(b => b.textContent.includes('check')); expect(button).toBeDefined(); });
    button.click();
    await vi.waitFor(() => expect(document.querySelector('.modal h4')?.textContent).toBe('Check result'));
    const apply = [...document.querySelectorAll('.modal-footer button')].find(b => b.textContent === 'Apply'); apply.click();
    await vi.waitFor(() => expect(s.server.requests.some(([method, url]) => method === 'POST' && url.endsWith('/apply'))).toBe(true));
    await vi.waitFor(() => expect(document.querySelector('.modal-footer')?.style.display).not.toBe('none'));
    expect(document.querySelector('.modal-lg')).not.toBeNull(); expect(s.reload).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.querySelector('.modal pre')?.textContent).toContain('fixture final log'));
    document.querySelector('.modal-footer button').click(); await flushPromises(); expect(s.reload).toHaveBeenCalledOnce();
    expect(s.server.requests.filter(([method]) => method === 'POST').map(([method, url, data]) => [url, data])).toEqual([
        ['/panel/api/lmn/schoolsettings', expect.any(Object)],
        ['/panel/api/lmn/users/lists/apply', { doAdd: true, doMove: true, doKill: true }],
    ]);
});
it.each(['results', 'check', 'apply'])('cancels %s without inventing extra writes or restoring layout', async phase => {
    const s = await setup('globaladministrator', { holdCheck: phase === 'check' });
    const pending = openUsersCheck(s.aj); pending.catch(() => {});
    if (phase === 'check') {
        await vi.waitFor(() => expect(s.server.requests.some(([, url]) => url.endsWith('/check'))).toBe(true));
    } else {
        await vi.waitFor(() => expect(document.querySelector('.modal h4')?.textContent).toBe('Check result'));
        if (phase === 'apply') {
            document.querySelector('.modal-footer button').click();
            await vi.waitFor(() => expect(document.querySelector('.modal h4')?.textContent).toBe('Applying changes'));
        }
    }
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flushPromises();
    expect(document.querySelector('.modal')).toBeNull();
    if (phase === 'check') { s.server.releaseCheck(null); await flushPromises(); }
    if (phase !== 'apply') expect(s.server.requests.filter(([method]) => method === 'POST')).toEqual([]);
    else await vi.waitFor(() => expect(s.reload).toHaveBeenCalledOnce());
    expect(s.nav.layout.sidebar).toBe(true);
});

it('marks the active sidebar route with prefix /panel and follows prefixed routeChanged paths', async () => {
    const s = await setup('globaladministrator');
    const activeLinks = () => [...s.element.querySelectorAll('.sidebar.hide-tablet .sidebar-item.active > div > a.link')]
        .map(link => link.getAttribute('href'));
    expect(s.nav.layout.path).toBe('/panel/view/lmn/landingpage');
    expect(activeLinks()).toEqual([]);
    s.nav.routeChanged('/panel/view/lmn/users/students'); await flushPromises();
    expect(activeLinks()).toEqual(['/panel/view/lmn/users/students/']);
    s.nav.routeChanged('/panel/view/lmn/users/globaladmins'); await flushPromises();
    expect(activeLinks()).toEqual(['/panel/view/lmn/users/globaladmins/']);
});
