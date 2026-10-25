import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { nextTick } from 'vue';
import { navigationOracle } from '../../test-fixtures/shell/navigation.mjs';
import { createNavigation } from './navigation.mjs';
import { ShellNavigation } from './navigation-components.mjs';
import { createMockAj } from '../adapter/mock.mjs';

const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); vi.useRealTimers(); });
const linksFrom = node => [...node.querySelectorAll('a.link')].map(link => link.getAttribute('href'));
const tree = { children: [
    { name: 'Empty', children: [] },
    { name: 'Settings', children: [
        { id: 'b', name: 'Zulu', weight: 20, icon: 'cog', url: '/view/lmn/settings', children: [] },
        { id: 'a', name: 'Alpha', weight: 10, icon: 'fa fa-user', url: '/view/lmn/users', children: [
            { name: 'Child', weight: 0, icon: 'user', url: 'https://example.test', children: [] },
        ] },
    ] },
] };
function setup(options = {}) {
    const routes = [], storage = options.storage ?? {};
    const aj = createMockAj({ identity: { user: 'fixture', isSuperuser: true, profile: { school_show: true, activeSchool: 'school' }, ...options.identity },
        http: options.http ?? (async request => ({ data: request.url === '/api/core/sidebar' ? { sidebar: tree } : [{ title: 'Users', icon: 'user', url: '/view/lmn/users' }] })) });
    const nav = createNavigation({ aj, storage, prefix: '/panel', navigate: path => routes.push(path), logout: options.logout ?? (() => {}), customization: options.customization });
    cleanups.push(nav.dispose);
    return { aj, nav, storage, routes };
}
it.each([{}, { showSidebar: false, isWidescreen: true }])('matches original persisted toggles, events and mobile route close: %j', storage => {
    const old = navigationOracle({ storage: { ...storage } }); cleanups.push(old.close);
    const { nav, storage: saved } = setup({ storage: { ...storage } });
    expect(nav.layout.sidebar).toBe(old.scope.showSidebar);
    expect(nav.layout.widescreen).toBe(old.scope.isWidescreen);
    for (const value of [undefined, false, true, undefined]) {
        nav.toggleNavigation(value); old.root.toggleNavigation(value);
        nav.toggleWidescreen(value); old.scope.toggleWidescreen(value);
        expect([nav.layout.sidebar, nav.layout.widescreen]).toEqual([old.scope.showSidebar, old.scope.isWidescreen]);
        expect(saved).toEqual(old.storage);
    }
    nav.toggleOverlayNavigation(); old.root.toggleOverlayNavigation();
    expect(nav.layout.overlay).toBe(old.scope.showOverlaySidebar);
    nav.routeChanged('/view/lmn/users'); old.root.$broadcast('$routeChangeSuccess');
    expect(nav.layout.overlay).toBe(old.scope.showOverlaySidebar);
});
it('renders the original sidebar hierarchy/order/links and only expands non-top-level children on demand', async () => {
    const old = navigationOracle({ sidebar: tree }); cleanups.push(old.close);
    const legacy = old.mount('<core-sidebar></core-sidebar>');
    await flushPromises(); old.flush();
    // Use original recursive template, rather than a test implementation of its rules.
    const { nav, aj } = setup(); await nav.loadSidebar();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    expect([...legacy.querySelectorAll('h5')].map(el => el.textContent.trim())).toContain('Settings');
    expect(linksFrom(legacy)).toEqual(['/panel/view/lmn/users/', 'https://example.test/', '/panel/view/lmn/settings/']);
    const links = wrapper.findAll('.sidebar.hide-tablet .link');
    expect(links.map(link => link.attributes('href'))).toEqual(['/panel/view/lmn/users/', 'https://example.test/', '/panel/view/lmn/settings/']);
    expect(wrapper.findAll('h5').map(el => el.text())).toEqual(['Settings', 'Settings']);
    expect(wrapper.find('.sidebar.hide-tablet a[href="https://example.test/"]').isVisible()).toBe(false);
    await wrapper.find('.sidebar.hide-tablet .expander').trigger('click');
    expect(wrapper.find('.sidebar.hide-tablet a[href="https://example.test/"]').isVisible()).toBe(true);
});
it('reserves a spaced fixed-width icon slot in desktop and overlay links, including empty icons', async () => {
    const items = ['user', 'fas fa-users', ''].map((icon, index) => ({
        name: `Item ${index}`, icon, url: `/view/item-${index}`, children: [],
    }));
    const { nav, aj } = setup({ http: async () => ({ data: { sidebar: { children: [{ name: 'Group', children: items }] } } }) });
    await nav.loadSidebar();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } });
    cleanups.push(() => wrapper.unmount());
    for (const selector of ['.sidebar.hide-tablet', '.overlay-sidebar']) {
        const links = wrapper.findAll(`${selector} .link`);
        expect(links).toHaveLength(3);
        for (const link of links) {
            expect(link.get('i').classes()).toEqual(expect.arrayContaining(['sidebar-link-icon', 'fa-fw']));
        }
    }
});
it('preserves navbox Ctrl-P, model trimming/debounce, retained results, Enter first result and Esc', async () => {
    vi.useFakeTimers();
    const old = navigationOracle({ results: [{ title: 'Users', url: '/view/lmn/users' }] }); cleanups.push(old.close);
    const { nav, aj, routes } = setup();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true }); document.dispatchEvent(event);
    old.hotkeys.handler('P', { ctrlKey: true }); expect(nav.search.visible).toBe(old.navbox.visible);
    expect(event.defaultPrevented).toBe(true); await nextTick();
    const input = wrapper.get('input[type=search]');
    await input.setValue('  users '); expect(input.element.value).toBe('  users ');
    await vi.advanceTimersByTimeAsync(499); expect(nav.search.results).toBeNull();
    await vi.advanceTimersByTimeAsync(1); await flushPromises();
    old.navbox.query = 'users'; old.flush();
    expect(nav.search.results).toEqual(old.navbox.results.map(item => ({ icon: 'user', ...item })));
    await input.trigger('keydown', { key: 'Enter' });
    expect(() => old.navbox.onSearchboxKeyDown({ keyCode: 13 })).toThrow(/j is not defined/);
    expect(routes).toEqual(old.routes);
    expect(nav.search.visible).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true })); await nextTick();
    await wrapper.get('input').trigger('keyup', { key: 'Escape' }); old.navbox.onSearchboxKeyUp({ keyCode: 27 });
    expect(nav.search.visible).toBe(old.navbox.visible); expect(nav.search.query).toBe(old.navbox.query);
});
it.each(['/view/login/normal', '/view/reset_password_send', '/view/lmn/users'])('matches initial navigation visibility on %s', path => {
    const old = navigationOracle({ path }); cleanups.push(old.close);
    const { nav } = setup(); nav.routeChanged(path);
    expect(Boolean(nav.layout.navigationPresent)).toBe(Boolean(old.scope.navigationPresent));
});
it('keeps profile/school routes, customization and mobile gestures, and delegates logout', async () => {
    const logout = vi.fn(), customization = { plugins: { core: { bodyClass: 'fixture', logoURL: '/logo', extraProfileMenuItems: [{ name: 'Extra', url: '/extra', icon: 'cog' }] }, settings: { hideLanguageSettings: true } } };
    const { nav, aj, routes } = setup({ logout, customization });
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    expect(nav.customization.plugins.settings.hideLanguageSettings).toBe(true);
    // P112 corrects the original absolute link so a configured prefix is retained.
    expect(wrapper.get('a.school-change').attributes('href')).toBe('/panel/view/lmn/change-school');
    await wrapper.get('.profile-button').trigger('click');
    expect(wrapper.get('a.extra-profile').attributes('href')).toBe('/extra');
    await wrapper.get('a.totp').trigger('click'); expect(routes).toEqual(['/panel/view/totp']);
    await wrapper.get('a.logout').trigger('click'); expect(logout).toHaveBeenCalledOnce();
    await wrapper.get('button.mobile-navigation').trigger('click'); expect(nav.layout.overlay).toBe(true);
    await wrapper.get('.shell-content').trigger('touchstart', { changedTouches: [{ clientX: 100 }] });
    await wrapper.get('.shell-content').trigger('touchend', { changedTouches: [{ clientX: 20 }] }); expect(nav.layout.overlay).toBe(false);
    await wrapper.get('.shell-content').trigger('touchstart', { changedTouches: [{ clientX: 20 }] });
    await wrapper.get('.shell-content').trigger('touchend', { changedTouches: [{ clientX: 100 }] }); expect(nav.layout.overlay).toBe(true);
    nav.routeChanged('/view/lmn/users'); expect(nav.layout.overlay).toBe(false);
});
it('keeps sidebar/search state on HTTP errors and removes search listeners and timers on dispose', async () => {
    vi.useFakeTimers(); const error = { status: 500 };
    const { nav, aj } = setup({ http: async () => { throw error; } });
    await nav.loadSidebar(); expect(nav.sidebar.item).toBeUndefined();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true })); await nextTick();
    await wrapper.get('input').setValue('users'); await vi.advanceTimersByTimeAsync(500);
    expect(nav.search.results).toBeNull();
    nav.cancelSearch(); nav.dispose();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true })); expect(nav.search.visible).toBe(false);
});
it('persists native layout using the original ngStorage keys across owners', async () => {
    const { createLayoutStorage } = await import('./navigation.mjs');
    localStorage.clear(); localStorage.setItem('ngStorage-showSidebar', 'false'); localStorage.setItem('ngStorage-isWidescreen', 'true');
    const a = setup({ storage: createLayoutStorage(localStorage) });
    expect([a.nav.layout.sidebar, a.nav.layout.widescreen]).toEqual([false, true]);
    a.nav.toggleNavigation(); a.nav.toggleWidescreen();
    const b = setup({ storage: createLayoutStorage(localStorage) });
    expect([b.nav.layout.sidebar, b.nav.layout.widescreen]).toEqual([true, false]);
    expect(localStorage.getItem('ngStorage-showSidebar')).toBe('true'); localStorage.clear();
});
it('matches original floatingToolbar columns when the original shell toggles', async () => {
    const old = navigationOracle(); cleanups.push(old.close);
    const toolbar = old.mount('<floating-toolbar><button>Save</button></floating-toolbar>');
    expect(toolbar.querySelector('.col-md-9 .bar button').textContent).toBe('Save');
    old.root.toggleNavigation(false); old.flush();
    expect(toolbar.querySelector('.col-md-12 .bar button').textContent).toBe('Save');
    expect(toolbar.querySelector('.col-md-3')).toBeNull();
});
it('keeps a new query result in original server order and retains it after clear or cancellation', async () => {
    vi.useFakeTimers(); const { nav } = setup();
    nav.setQuery('Users'); await vi.advanceTimersByTimeAsync(500); const previous = nav.search.results;
    nav.setQuery(''); await vi.advanceTimersByTimeAsync(500); expect(nav.search.results).toBe(previous);
    nav.cancelSearch(); expect(nav.search.results).toBe(previous);
    expect(() => nav.openResult(undefined)).not.toThrow();
});
it('uses the original body/container CSS structure and dismisses the profile menu outside or with Escape', async () => {
    const { nav, aj } = setup({ customization: { plugins: { core: { bodyClass: 'fixture-shell' } } } });
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    expect(document.body.classList.contains('widescreen-mode-off')).toBe(true);
    nav.toggleWidescreen(); await nextTick(); expect(document.body.classList.contains('widescreen-mode-on')).toBe(true);
    expect(document.body.classList.contains('fixture-shell')).toBe(true);
    expect(wrapper.find('.container > .row > .sidebar').exists()).toBe(true);
    await wrapper.get('.profile-button').trigger('click'); expect(wrapper.get('.profile-button').attributes('aria-expanded')).toBe('true');
    document.body.click(); await nextTick(); expect(wrapper.get('.profile-button').attributes('aria-expanded')).toBe('false');
    await wrapper.get('.profile-button').trigger('click'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick(); expect(wrapper.get('.profile-button').attributes('aria-expanded')).toBe('false');
});
it.each(['javascript:alert(1)', 'https://example.test/extra', '/view/totp'])('retains Angular href sanitization for profile customization: %s', url => {
    const old = navigationOracle(); cleanups.push(old.close); old.scope.testURL = url;
    const link = old.mount('<a ng:href="{{testURL}}">Extra</a>');
    const { nav, aj } = setup({ customization: { plugins: { core: { extraProfileMenuItems: [{ name: '<script>extra</script>', icon: 'user', url }] } } } });
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    expect(wrapper.get('.extra-profile').attributes('href')).toBe(link.getAttribute('href'));
    expect(wrapper.find('script').exists()).toBe(false);
});
it('cancels the pending debounced search when input returns to the already committed model', async () => {
    vi.useFakeTimers(); const http = vi.fn(async () => ({ data: [] })); const { nav } = setup({ http });
    nav.setQuery('users'); await vi.advanceTimersByTimeAsync(500);
    nav.setQuery('usersX'); nav.setQuery('users'); await vi.advanceTimersByTimeAsync(500);
    expect(http.mock.calls.map(([request]) => request.url)).toEqual(['/api/core/navbox/users']);
});

it('intentionally renders clickable navbox results where the original template renders zero matches', async () => {
    vi.useFakeTimers();
    const results = [{ title: 'Users', icon: 'user', url: '/view/lmn/users' }];
    const old = navigationOracle({ results }); cleanups.push(old.close);
    const template = readFileSync('test-fixtures/shell/navigation/main_view.html', 'utf8')
        .match(/<div class="list-group">[\s\S]*?<\/div>/)[0];
    const legacy = old.mount(template, old.navbox);
    old.navbox.query = 'Users'; old.flush();
    expect(old.navbox.results).toEqual(results);
    expect(legacy.querySelectorAll('.list-group-item')).toHaveLength(0);
    const { nav, aj, routes } = setup();
    const wrapper = mount(ShellNavigation, { props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
    nav.setQuery('Users'); await vi.advanceTimersByTimeAsync(500);
    expect(wrapper.findAll('.list-group-item')).toHaveLength(1);
    await wrapper.get('.list-group-item').trigger('click');
    expect(routes).toEqual(['/view/lmn/users']);
});
it('keeps the authenticated development restart control and delegates to the existing forceRestart service', async () => {
    const { nav, aj } = setup(); aj.forceRestart = vi.fn();
    const wrapper = mount(ShellNavigation, { props: { nav, aj, devMode: true } }); cleanups.push(() => wrapper.unmount());
    await wrapper.get('[data-action=restart-panel]').trigger('click');
    expect(aj.forceRestart).toHaveBeenCalledOnce();
});

it('uses BS5 navigation links and Vue-controlled show for the profile dropdown', async () => {
    const { nav, aj } = setup(); await nav.loadSidebar();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } }); cleanups.push(() => wrapper.unmount());
    expect(wrapper.get('nav').classes()).toEqual(expect.arrayContaining(['navbar', 'fixed-top', 'shell-navbar']));
    expect(wrapper.find('.navbar-default, .navbar-fixed-top, .open').exists()).toBe(false);
    expect(wrapper.findAll('.sidebar .nav-item .nav-link').length).toBeGreaterThan(0);
    expect(wrapper.get('.dropdown-menu').classes()).toContain('dropdown-menu-end');
    expect(wrapper.get('.dropdown-menu').classes()).not.toContain('show');
    await wrapper.get('.profile-button').trigger('click');
    expect(wrapper.get('.dropdown-menu').classes()).toContain('show');
    expect(wrapper.get('.logout').classes()).toContain('dropdown-item');
    document.body.click(); await nextTick();
    expect(wrapper.get('.dropdown-menu').classes()).not.toContain('show');
});
it('shares the measured header height and restores the previous CSS variable on unmount', () => {
    let resize; const disconnect = vi.fn(), observe = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback) { resize = callback; } observe = observe; disconnect = disconnect; });
    const root = document.documentElement;
    root.style.setProperty('--shell-header-height', '55px');
    const { nav, aj } = setup();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj } });
    try {
        const navbar = wrapper.get('nav').element;
        navbar.getBoundingClientRect = () => ({ height: 120 });
        expect(observe).toHaveBeenCalledWith(navbar); resize();
        expect(root.style.getPropertyValue('--shell-header-height')).toBe('120px');
        const css = readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', 'utf8');
        const dependencies = [
            ['body > .container > .row > .shell-content', 'padding-top', 'var(--shell-header-height)'],
            ['body > .container > .row > .sidebar', 'padding-top', 'var(--shell-header-height)'],
            ['body > .container > .sidebar', 'padding-top', 'var(--shell-header-height)'],
            ['body > .container > .row > .sidebar.overlay-sidebar', 'padding-top', 'var(--shell-header-height)'],
            ['body > .container > .sidebar.overlay-sidebar', 'padding-top', 'var(--shell-header-height)'],
            ['.auth-page', 'min-height', 'calc(100dvh - var(--shell-header-height))'],
        ];
        const value = (source, selector, property) => {
            const values = [];
            postcss.parse(source).walkRules(rule => {
                if (rule.selectors.includes(selector)) rule.walkDecls(property, declaration => values.push(declaration.value));
            });
            return values.at(-1);
        };
        for (const [selector, property, expected] of dependencies) {
            expect(value(css, selector, property), selector).toBe(expected);
            // A literal height must fail the same exact-selector check, including the built overlay rules.
            expect(value(css.replaceAll('var(--shell-header-height)', '60px'), selector, property), selector).not.toBe(expected);
        }
    } finally { wrapper.unmount(); }
    expect(disconnect).toHaveBeenCalledOnce();
    expect(root.style.getPropertyValue('--shell-header-height')).toBe('55px');
    root.style.removeProperty('--shell-header-height'); vi.unstubAllGlobals();
});
it('keeps the original mobile overlay: no backdrop or Escape handling, and content actions remain usable', async () => {
    const { nav, aj } = setup(); await nav.loadSidebar();
    const action = vi.fn();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj },
        slots: { default: '<button data-action="content">Content action</button>' } }); cleanups.push(() => wrapper.unmount());
    wrapper.get('[data-action=content]').element.addEventListener('click', action);
    await wrapper.get('.mobile-navigation').trigger('click');
    expect(wrapper.find('.navigation-backdrop').exists()).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await nextTick();
    expect(nav.layout.overlay).toBe(true);
    await wrapper.get('[data-action=content]').trigger('click');
    expect(action).toHaveBeenCalledOnce(); expect(nav.layout.overlay).toBe(true);
    await wrapper.get('.mobile-navigation').trigger('click'); expect(nav.layout.overlay).toBe(false);
});
it('leaves the destination focus untouched after a mobile menu link and route change', async () => {
    const { nav, aj } = setup(); await nav.loadSidebar();
    const wrapper = mount(ShellNavigation, { attachTo: document.body, props: { nav, aj },
        slots: { default: '<button data-action="destination">Destination focus</button>' } }); cleanups.push(() => wrapper.unmount());
    const toggle = wrapper.get('.mobile-navigation'), destination = wrapper.get('[data-action=destination]').element;
    toggle.element.focus(); await toggle.trigger('click'); await flushPromises();
    const link = wrapper.get('.overlay-sidebar .link');
    link.element.addEventListener('click', event => {
        event.preventDefault(); nav.routeChanged('/view/lmn/users'); destination.focus();
    });
    await link.trigger('click'); await flushPromises();
    expect(nav.layout.overlay).toBe(false);
    expect(document.activeElement).toBe(destination);
});
