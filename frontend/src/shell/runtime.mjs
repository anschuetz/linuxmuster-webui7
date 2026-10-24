import { createApp, defineComponent, effectScope, h, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch, watchEffect } from 'vue';
import { createSession } from './session.mjs';
import { createLocale } from './locale.mjs';
import { createNavigation, createLayoutStorage } from './navigation.mjs';
import { ShellNavigation } from './navigation-components.mjs';
import { createNotifications } from './notifications.mjs';
import { createPresentation, ShellServices } from './presentation.mjs';
import { createTaskServices } from './tasks.mjs';
import { TaskSidebar, mountPlugins } from './task-components.mjs';
import { mountAuthentication } from './auth-components.mjs';
import { dashboardDefaults } from './dashboard.mjs';
import { mountDashboardRoute } from './dashboard-routes.mjs';
import { mountStockSettings } from './settings-harness.mjs';
import { createShellRouter } from './router.mjs';
import RouteHost from './RouteHost.mjs';
import { StaticPage } from './static-pages.mjs';

function customization(prefix, gettext) {
    return { plugins: { core: {
        startupURL: '/view/lmn/landingpage', loginredir: '/', bodyClass: 'customized', title: ' ',
        faviconURL: `${prefix}/resources/lmn_common/resources/img/favicon.png`,
        logoURL: `${prefix}/resources/lmn_common/resources/img/logo-text-white.png`,
        bigLogoURL: `${prefix}/resources/lmn_common/resources/img/logo-full.png`, hidePersonaLogin: true,
        get extraProfileMenuItems() { return [{ url: `${prefix}/view/lmn/change-password`, name: gettext('Change password'), icon: 'key' }]; },
    } } };
}

const StockRoute = defineComponent({
    props: ['route', 'aj', 'session', 'boot', 'customization', 'registerStop'],
    setup(props) {
        const host = ref(); let stop;
        onMounted(() => {
            const { route, aj, session, boot, customization: custom } = props;
            const path = route.path.replace(/\/$/, ''), kind = route.meta.kind;
            if (kind === 'auth') stop = mountAuthentication(host.value, { path, session, services: aj, navigate: aj.navigate, pwReset: boot.pwReset, prefix: boot.prefix, customization: custom, mode: route.params.mode, serial: route.params.serial });
            if (kind === 'settings') stop = mountStockSettings(host.value, aj, { customization: custom.plugins.settings }).dispose;
            if (kind === 'dashboard' || kind === 'session_list') stop = mountDashboardRoute(host.value, { aj, path, initialConfig: boot.config, customization: custom.plugins.dashboard ?? dashboardDefaults });
            if (kind === 'plugins') stop = mountPlugins(host.value, aj, { version: boot.version });
            props.registerStop(() => { stop?.(); stop = undefined; });
        });
        onBeforeUnmount(() => { stop?.(); stop = undefined; });
        return () => h('div', { ref: host });
    },
});

/** Product owner: one identity/locale/nav and one socket per authenticated session. */
export function mountShell(element, boot, { fetch = window.fetch.bind(window), io, history, initialPath } = {}) {
    const prefix = boot.prefix || '', scope = effectScope(), active = shallowRef(), presentation = shallowRef();
    let app, aj, nav, locale, tasks, stopRoute, disposed = false, revision = 0;
    const bootstrapConfig = () => structuredClone(boot.config || {});
    let config = bootstrapConfig(), configLoaded = false, configEpoch = 0, configWrites = new Set();
    const clearRoute = () => { ++revision; stopRoute?.(); stopRoute = undefined; presentation.value?.dispose(); routing.clearGuards(); };
    const routing = createShellRouter({ prefix, history, plugins: Object.keys(boot.plugins || {}), onRoute(to, from) {
        // A fragment change is local state (e.g. Linbo's Images tab), not a new page.
        if (from && to.path === from.path && JSON.stringify(to.query) === JSON.stringify(from.query) && to.hash !== from.hash) return;
        void showRoute(to);
    } });
    const navigate = async (path, options) => {
        if (path === '/' && session.identity.user && Object.hasOwn(boot.plugins, 'lmn_setup_wizard')) {
            const { data } = await session.http.get('/api/lmn/setup-wizard/is-configured');
            if (!data) path = '/view/lmn/init/welcome';
        }
        return routing.navigate(path, options);
    };
    const forceNavigate = path => { clearRoute(); return routing.navigate(path); };
    const notifications = createNotifications(navigate);
    const notify = notifications.notify;
    const session = createSession({ fetch, prefix, path: () => routing.router.currentRoute.value.matched.length ? `${prefix}${routing.router.currentRoute.value.path}` : `${prefix}${initialPath ? new URL(initialPath, window.location.href).pathname : window.location.pathname.slice(prefix.length)}`,
        navigate: forceNavigate, notify, messagebox: { show: (...args) => { const p = presentation.value?.messagebox.show(...args); p?.catch(() => {}); return p; } },
        gettext: text => locale?.gettext(text) ?? text });
    // All three configuration writers share successful server snapshots. Never
    // publish an old session's late response into the next session's cache.
    const http = { ...session.http, ...Object.fromEntries(['get', 'post'].map(method => [method, async (...args) => {
        const epoch = configEpoch;
        const snapshot = args[0] === '/api/core/config' && method === 'post' ? JSON.parse(JSON.stringify(args[1])) : undefined;
        const request = session.http[method](...args), writes = configWrites;
        if (snapshot !== undefined) writes.add(request);
        let response;
        try { response = await request; }
        catch (error) { if (snapshot !== undefined && epoch === configEpoch) configLoaded = false; throw error; }
        finally { writes.delete(request); }
        if (args[0] === '/api/core/config' && epoch === configEpoch) {
            config = structuredClone(method === 'get' ? response.data : snapshot); configLoaded = true;
        }
        return response;
    }])) };
    locale = createLocale({ http: session.http, initialConfig: config });
    const custom = customization(prefix, locale.gettext);
    const storage = createLayoutStorage();
    // Keep the LM default for a new browser, preserve an existing explicit choice.
    if (storage.isWidescreen === undefined) storage.isWidescreen = true;
    nav = createNavigation({ aj: { http: session.http }, prefix, navigate: routing.navigate, logout: session.logout, customization: custom, storage });
    const makePresentation = () => createPresentation({ http: session.http, identity: session.identity,
        navigate: routing.navigate, gettext: locale.gettext, customization: custom, getAj: () => aj, notifications });
    presentation.value = makePresentation();
    function taskOwner() {
        tasks?.dispose(); tasks = undefined;
        if (!session.identity.user) return;
        tasks = createTaskServices({ http: session.http, prefix, notify, gettext: locale.gettext, ...(io ? { io } : {}) });
        if (session.identity.user) tasks.start();
    }
    taskOwner();
    const stopAuthGuard = routing.router.beforeEach(to => {
        if (!session.identity.user && to.meta.kind !== 'auth') return '/view/login/normal';
    });
    async function showRoute(route) {
        if (disposed) return;
        clearRoute(); const current = revision;
        active.value = undefined;
        await nextTick();
        if (disposed || current !== revision) return;
        presentation.value = makePresentation();
        if (route.meta.plugin === 'lmn_setup_wizard' && route.meta.attrs['data-step'] === 'welcome') {
            await Promise.allSettled([...configWrites]);
            if (disposed || current !== revision) return;
            if (!configLoaded) {
                try { await http.get('/api/core/config'); }
                catch { route = { ...route, meta: { kind: 'configuration-error' } }; }
            }
            if (disposed || current !== revision) return;
        }
        aj = { ...presentation.value, locale, shell: nav, navigate, reload: routing.reload, guardLeave: routing.guardLeave, identity: session.identity,
            http, prefix, path: route.path, sessionState: session.state,
            socket: tasks?.socket, push: tasks?.push, tasks: tasks?.tasks,
            wizard: { readConfig: () => ({ ...config }),
                setConfigLanguage: language => { config = { ...config, language }; },
                saveConfig: data => http.post('/api/core/config', data) },
        };
        presentation.value.favicon.init();
        nav.cancelSearch(); nav.routeChanged(`${prefix}${route.path}`);
        active.value = { route, aj, key: current };
        void session.activity().catch(() => {}); // Shared HTTP policy handles failures.
    }
    scope.run(() => {
        watch(() => session.identity.user, (user, previous) => {
            ++configEpoch; config = bootstrapConfig(); configLoaded = false; configWrites = new Set();
            if (previous != null && user !== previous) {
                notifications.clear(); nav.cancelSearch(); nav.routeChanged(`${prefix}/view/login/normal`);
                window.LmnVue_lmn_session_new?.resetSession?.();
                if (user == null || routing.router.currentRoute.value.meta.kind !== 'auth') {
                    clearRoute(); active.value = undefined;
                    if (user != null) void navigate('/');
                }
            }
            taskOwner();
            if (user) void nav.loadSidebar();
        }, { flush: 'sync' });
        watchEffect(() => {
            for (const name of [...document.body.classList]) if (name.startsWith('global-color-')) document.body.classList.remove(name);
            document.body.classList.add(`global-color-${session.identity.color || 'default'}`);
        });
    });
    const Root = defineComponent({ setup() {
        return () => {
            const a = active.value;
            const content = () => {
                if (!a) return h('div', { role: 'progressbar', 'aria-label': locale.gettext('Please wait') });
                const { route, aj: adapter } = a;
                if (route.meta.kind === 'plugin') return h(RouteHost, { key: a.key, plugin: route.meta.plugin, aj: adapter, attrs: route.meta.attrs,
                    registerStop: fn => { stopRoute = fn; } });
                if (['404', 'ui-test', 'quotas-disabled', 'configuration-error'].includes(route.meta.kind)) return h(StaticPage, { kind: route.meta.kind, prefix, route, gettext: locale.gettext });
                return h(StockRoute, { key: a.key, ...a, session, boot, customization: custom, registerStop: fn => { stopRoute = fn; } });
            };
            return [h(ShellNavigation, { nav, aj: a?.aj ?? { ...presentation.value, identity: session.identity }, identityDetails: session.identity, sessionState: session.state, devMode: boot.devMode === 'True' },
                { default: content, tasks: () => a && session.identity.user && tasks ? h(TaskSidebar, { aj: { gettext: locale.gettext, tasks: tasks.tasks } }) : null }),
            h(ShellServices, { key: revision, services: presentation.value })];
        };
    } });
    const click = event => {
        const anchor = event.target.closest?.('a[href]');
        if (!anchor || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || anchor.target || anchor.hasAttribute('download')) return;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin || !url.pathname.startsWith(`${prefix}/view/`)) return;
        event.preventDefault(); void routing.navigate(url.pathname + url.search + url.hash);
    };
    document.addEventListener('click', click);
    app = createApp(Root); app.mount(element);
    const ready = (async () => {
        await session.identity.refresh();
        await locale.setLanguage(config.language || 'en');
        if (session.identity.user) {
            if (Object.hasOwn(boot.plugins, 'lmn_setup_wizard')) {
                const { data } = await session.http.get('/api/lmn/setup-wizard/is-configured');
                if (!data) initialPath = '/view/lmn/init/welcome';
            }
        }
        await routing.navigate(initialPath ?? (window.location.pathname + window.location.search + window.location.hash));
        await nextTick();
    })();
    return { ...routing, navigate, session, ready, get aj() { return aj; },
        dispose() { if (disposed) return; disposed = true; clearRoute(); app.unmount(); scope.stop(); nav.dispose(); notifications.dispose(); tasks?.dispose(); locale.dispose(); session.dispose(); stopAuthGuard(); routing.dispose(); document.removeEventListener('click', click); },
    };
}
