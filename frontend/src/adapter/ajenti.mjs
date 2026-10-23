import { reactive, shallowRef } from 'vue';

/**
 * Create the P01 contract using the existing Angular services and interceptors.
 * @returns {import('./aj.mjs').Aj}
 */
export function createAjentiAdapter({ $http, notify, gettext, identity, $location }) {
    const snapshot = () => ({
        user: identity.user ?? null,
        profile: identity.profile ?? {},
        isSuperuser: identity.isSuperuser ?? false,
    });
    const current = shallowRef(snapshot());
    // Angular writes to its original service, outside Vue's reactive proxy.
    // Keep the exposed identity stable and publish a fresh snapshot after init.
    identity.promise?.then(() => { current.value = snapshot(); }, () => {
        // The Angular HTTP interceptor already handles identity request errors.
    });

    return {
        http: Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((method) => [
            method, async (...args) => $http[method](...args),
        ])),
        notify: Object.fromEntries(['success', 'info', 'warning', 'error'].map((level) => [
            level, (title, text) => notify[level](title, text),
        ])),
        gettext,
        identity: reactive({
            get user() { return current.value.user; },
            get profile() { return current.value.profile; },
            get isSuperuser() { return current.value.isSuperuser; },
        }),
        navigate: (path) => { $location.path(path); },
    };
}
