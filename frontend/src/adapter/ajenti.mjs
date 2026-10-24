import { getCurrentScope, onScopeDispose, reactive, shallowRef } from 'vue';
import { createModalService } from './modal.mjs';

/**
 * Create the adapter contract using the existing Angular services and interceptors.
 * @returns {import('./aj.mjs').Aj}
 */
export function createAjentiAdapter({ $http, notify, toaster, gettextCatalog, identity, $location, $route, pageTitle, messagebox, core, locale, $rootScope, $scope, browserLocation = window.location }) {
    const translationVersion = shallowRef(0);
    if (getCurrentScope() && $rootScope?.$on) {
        // angular-gettext broadcasts this for both language and string changes.
        onScopeDispose($rootScope.$on('gettextLanguageChanged', () => {
            translationVersion.value += 1;
        }));
    }
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

    const inDigest = (callback) => $rootScope ? $rootScope.$evalAsync(callback) : callback();
    const shellAction = (callback) => new Promise((resolve, reject) => inDigest(() => {
        try { resolve(callback()); } catch (error) { reject(error); }
    }));
    const showMessage = (method, args) => {
        let handle;
        const promise = new Promise((resolve, reject) => inDigest(() => {
            try {
                handle = messagebox[method](...args);
                // Core's then accepts only one argument; catch first preserves cancellation.
                handle.catch(reject).then(resolve, reject);
            } catch (error) { reject(error); }
        }));
        return Object.assign(promise, { close: () => inDigest(() => handle.close()) });
    };
    const aj = {
        locale: { setLanguage: (language) => shellAction(() => locale.setLanguage(language)) },
        restart: () => shellAction(() => core.restart()),
        guardLeave: (fn) => {
            const offChange = $scope.$on('$locationChangeStart', (event) => {
                if (fn() === false) event.preventDefault();
            });
            let active = true;
            const unsubscribe = () => {
                if (!active) return;
                active = false;
                offChange();
                offDestroy();
            };
            const offDestroy = $scope.$on('$destroy', unsubscribe);
            return unsubscribe;
        },
        reload: () => inDigest(() => $route.reload()),
        pageTitle: { set: (text) => inDigest(() => pageTitle.set(text)) },
        messagebox: {
            show: (options) => showMessage('show', [{ ...options }]),
            prompt: (text, value, inputType = 'text') => showMessage('prompt', [text, value, inputType]),
        },
        modal: createModalService(() => aj, $scope),
        http: Object.fromEntries(['get', 'post', 'put', 'delete', 'patch'].map((method) => [
            method, async (...args) => $http[method](...args),
        ])),
        notify: Object.fromEntries(['success', 'info', 'warning', 'error'].map((level) => [
            level, (title, text, options) => options?.sticky
                ? inDigest(() => toaster.pop({ type: level, title, body: text, timeout: 0 }))
                : notify[level](title, text),
        ])),
        gettext: (text) => {
            // Track catalog changes in every template/effect that translates text.
            translationVersion.value;
            return gettextCatalog.getString(text);
        },
        identity: reactive({
            patch: (profileFields) => inDigest(() => {
                identity.profile = { ...identity.profile, ...profileFields };
                current.value = snapshot();
            }),
            refresh: () => new Promise((resolve, reject) => inDigest(() => {
                try {
                    Promise.resolve(identity.init()).then(() => {
                        current.value = snapshot();
                        resolve();
                    }, reject);
                } catch (error) { reject(error); }
            })),
            get user() { return current.value.user; },
            get profile() { return current.value.profile; },
            get isSuperuser() { return current.value.isSuperuser; },
        }),
        navigate: (path, options) => {
            if (options?.replace) browserLocation.replace(path);
            else $location.path(path);
        },
    };
    return aj;
}
