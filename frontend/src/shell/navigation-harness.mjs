import { createApp, h } from 'vue';
import { createNavigation } from './navigation.mjs';
import { ShellNavigation } from './navigation-components.mjs';
import { createPresentation, ShellServices } from './presentation.mjs';
import RouteHost from './RouteHost.mjs';

/** Explicit fixture composition. No product entry/router imports this mount. */
export function mountNavigationHarness(element, { session, storage, prefix = '', path = `${prefix}/view/lmn/landingpage`,
    navigate, reload = () => {}, customization, plugin = null, gettext = text => text }) {
    let aj;
    const services = createPresentation({ http: session.http, identity: session.identity, navigate, gettext, customization,
        getAj: () => aj });
    const nav = createNavigation({ aj: services, storage, prefix, navigate, logout: session.logout, customization });
    nav.routeChanged(path);
    aj = { ...services, shell: nav, reload };
    const app = createApp({ render: () => [
        h(ShellNavigation, { nav, aj, identityDetails: session.identity }, { default: () => h(RouteHost, { plugin, aj }) }),
        h(ShellServices, { services }),
    ] });
    app.mount(element);
    const ready = Promise.all([session.identity.refresh(), nav.loadSidebar()]);
    return { aj, nav, services, ready,
        dispose() { app.unmount(); nav.dispose(); services.dispose(); session.dispose(); },
    };
}
