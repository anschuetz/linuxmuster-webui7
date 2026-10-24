import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { createMemoryHistory } from 'vue-router';
import { mountShell } from './runtime.mjs';
const owners = [];
afterEach(() => { owners.splice(0).forEach(o => o.dispose()); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.useRealTimers(); });
function socket() { const handlers = {}; const s = { handlers, on: vi.fn((name, fn) => { handlers[name] = fn; }), off: vi.fn(name => { delete handlers[name]; }), connect: vi.fn(), disconnect: vi.fn(), io: { on: vi.fn(), off: vi.fn() } }; return s; }
async function setup(prefix = '') {
    const transport = socket(), calls = [];
    let user = 'fixture', configured = true;
    const fetch = vi.fn(async (url, options) => {
        const path = url.slice(prefix.length); calls.push([path, options]);
        let data = {};
        if (path === '/api/core/auth') data = { success: true };
        if (path === '/api/core/identity') data = { identity: { user, effective: 0, profile: { schoolname: 'School', school_show: true } }, machine: { name: 'fixture-host' }, color: 'blue' };
        if (path === '/api/core/sidebar') data = { sidebar: { children: [] } };
        if (path === '/api/core/session-time') data = 100;
        if (path === '/api/core/languages') data = ['en'];
        if (path === '/api/dashboard/widgets' || path === '/api/dashboard/widgets-values') data = [];
        if (path === '/api/plugins/installed' || path === '/api/plugins/pypi/ajenti-plugins') data = [];
        if (path === '/api/plugins/core/check-upgrade') data = '';
        if (path === '/api/lmn/setup-wizard/is-configured') data = configured;
        return new Response(JSON.stringify(data), { status: path === '/api/expired' ? 401 : 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect() {} });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    const host = document.createElement('div'); document.body.append(host);
    const o = mountShell(host, { prefix, config: {}, plugins: { lmn_links: 'Links', lmn_users: 'Users', lmn_setup_wizard: 'Wizard', lmn_landingpage: 'Home' } }, { fetch, io: () => transport, history: createMemoryHistory(prefix), initialPath: '/view/lmn/links' });
    owners.push(o); await o.ready; await flushPromises();
    return { o, fetch, transport, calls, setUser: value => { user = value; }, setConfigured: value => { configured = value; } };
}
it('composes one session/socket owner and passes full aj to unchanged IIFEs; route/reload disposes dialogs and guards', async () => {
    const stopped = vi.fn(); let aj;
    vi.stubGlobal('LmnVue_lmn_links', { mount(el, adapter) { el.textContent = 'links'; aj = adapter; return stopped; } });
    vi.stubGlobal('LmnVue_lmn_users', { mount(el) { el.textContent = el.getAttribute('view'); return stopped; } });
    const { o, transport } = await setup('/panel');
    expect(document.body.textContent).toContain('links'); expect(aj.shell).toBeDefined();
    expect(transport.connect).toHaveBeenCalledTimes(1);
    transport.handlers.message({ plugin: 'push', data: { plugin: 'tasks', message: { type: 'update', tasks: [{ id: 'fixture-task', name: 'Fixture task', progress: { total: 5, done: 2 } }] } } });
    await flushPromises(); expect(document.body.textContent).toContain('Fixture task');
    aj.notify.success('Route success');
    const message = aj.messagebox.show({ title: 'Pending', positive: 'OK' }).catch(e => e);
    const modal = aj.modal.open({ render: () => null }).catch(e => e);
    await o.navigate('/panel/view/lmn/users/teachers'); await flushPromises();
    expect(document.body.textContent).toContain('teachers'); expect(document.body.textContent).toContain('Route success'); expect(stopped).toHaveBeenCalledTimes(1);
    expect(await message).toBeInstanceOf(Error); expect(await modal).toBeInstanceOf(Error);
    const count = stopped.mock.calls.length; o.reload(); await flushPromises(); expect(stopped).toHaveBeenCalledTimes(count + 1);
    o.dispose(); expect(transport.disconnect).toHaveBeenCalledTimes(1);
});
it('401 bypasses a dirty-route guard, removes private content immediately and opens login once', async () => {
    let aj; const stop = vi.fn();
    vi.stubGlobal('LmnVue_lmn_links', { mount(el, adapter) { aj = adapter; el.textContent = 'private fixture'; return stop; } });
    const resetSession = vi.fn(); vi.stubGlobal('LmnVue_lmn_session_new', { resetSession });
    const { o, setUser, transport } = await setup(); aj.guardLeave(() => false); setUser(null);
    await Promise.allSettled([aj.http.get('/api/expired'), aj.http.get('/api/expired')]); await flushPromises();
    expect(o.router.currentRoute.value.path).toMatch(/^\/view\/login\/normal/);
    expect(document.body.textContent).not.toContain('private fixture'); expect(document.body.textContent).toContain('Your session has expired'); expect(stop).toHaveBeenCalledTimes(1);
    expect(resetSession).toHaveBeenCalledTimes(1);
    expect(transport.disconnect).toHaveBeenCalledTimes(1); expect(document.querySelectorAll('input[name=username]')).toHaveLength(1);
});
it('restores namespaced attributes and routes stock 404 without Angular', async () => {
    vi.stubGlobal('LmnVue_lmn_links', { mount: () => () => {} });
    const { o } = await setup(); await o.navigate('/view/unknown'); await flushPromises();
    expect(document.body.textContent).toContain('Page not found');
    expect(window.angular).toBeUndefined();
});
it('shows the Vue compatibility notice in the stock installer', async () => {
    vi.stubGlobal('LmnVue_lmn_links', { mount: () => () => {} });
    const { o } = await setup();
    await o.navigate('/view/plugins'); await flushPromises();
    expect(document.body.textContent).toContain('AngularJS plugins are not supported');
});
it('uses the dashboard plugin customization and renders the default Home tab', async () => {
    vi.stubGlobal('LmnVue_lmn_links', { mount: () => () => {} });
    const { o } = await setup(); vi.useFakeTimers(); await o.navigate('/view/dashboard'); await flushPromises(); await vi.advanceTimersByTimeAsync(1000); await flushPromises();
    expect(document.body.textContent).toContain('Home');
});

it('checks setup after SPA login and supplies the native wizard config cache across route reloads', async () => {
    vi.stubGlobal('LmnVue_lmn_links', { mount: () => () => {} });
    const seen = [];
    vi.stubGlobal('LmnVue_lmn_setup_wizard', { mount(el, aj) { seen.push([el.dataset.step, aj.wizard.readConfig()]); return () => {}; } });
    const { o, setConfigured } = await setup(); setConfigured(false);
    await o.navigate('/'); await flushPromises();
    expect(o.router.currentRoute.value.path).toBe('/view/lmn/init/welcome');
    expect(seen).toEqual([['welcome', {}]]);
    o.aj.wizard.setConfigLanguage('de'); o.reload(); await flushPromises();
    expect(seen.at(-1)).toEqual(['welcome', { language: 'de' }]);
});

it('finishes sudo authentication when refresh changes an already signed-in identity', async () => {
    vi.stubGlobal('LmnVue_lmn_links', { mount: () => () => {} });
    vi.stubGlobal('LmnVue_lmn_landingpage', { mount(el) { el.textContent = 'landing fixture'; return () => {}; } });
    const { o, setUser } = await setup();
    await o.navigate('/view/login/sudo:root/old/path'); await flushPromises();
    setUser('root');
    const input = document.querySelector('input[name=password]'); input.value = 'fixture'; input.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await flushPromises();
    expect(o.router.currentRoute.value.path).toBe('/view/lmn/landingpage');
    expect(document.body.textContent).toContain('landing fixture');
});
