import { createApp, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { createSession } from './session.mjs';
import { createPresentation, ShellServices } from './presentation.mjs';
import { mountAuthentication } from './auth-components.mjs';

/** Test-only explicit composition, never imported by a product entry or router. */
export function mountAuthHarness(element, { fetch, prefix = '', path, navigate, pwReset = 'False', gettext = text => text }) {
    let services;
    const session = createSession({ fetch, prefix, path: () => `${prefix}${path}`, navigate, gettext,
        notify: { error: (...args) => services.notify.error(...args) },
        messagebox: { show: (...args) => {
            const dialog = services.messagebox.show(...args); dialog.catch(() => {}); return dialog;
        } } });
    services = createPresentation({ http: session.http, identity: session.identity, navigate, gettext });
    let stop;
    const Root = defineComponent({
        setup() {
            const host = ref(null);
            onMounted(() => {
                if (path === '/view/totp') void session.identity.refresh();
                stop = mountAuthentication(host.value, { path, session, services, navigate, pwReset }); });
            onBeforeUnmount(() => { stop?.(); session.dispose(); services.dispose(); });
            return () => [h('div', { ref: host }), h(ShellServices, { services })];
        },
    });
    const app = createApp(Root); app.mount(element);
    return { session, services, dispose: () => app.unmount() };
}
