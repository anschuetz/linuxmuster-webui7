import { computed, reactive, shallowRef } from 'vue';
import { createHttp } from './http.mjs';

const anonymous = () => ({ user: null, profile: {}, isSuperuser: false });
const counter = seconds => [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map(value => ('00' + value).slice(-2));

/** Isolated owner; callers explicitly start it and report route activity. No product bootstrap. */
export function createSession({ fetch, prefix = '', path, navigate, notify, messagebox, gettext = text => text }) {
    const current = shallowRef(anonymous()), remaining = shallowRef(0);
    let epoch = 0, expired = false, disposed = false, timer, redirectTimer, finishLogout;
    const loginPath = () => `${prefix}/view/login/normal/${path()}`;
    // Login and both reset controllers disable the original expired-session interceptor.
    const isAuthenticationRoute = () => path().startsWith(`${prefix}/view/login`)
        || path().startsWith(`${prefix}/view/reset_password`);
    const clearTimer = () => { clearInterval(timer); timer = undefined; };
    function clearIdentity() {
        current.value = anonymous();
        remaining.value = 0;
        clearTimer();
    }
    function onError(error) {
        if (disposed) return;
        if (error.status === 500) {
            if (error.data?.exception === 'SecurityError') notify.error(gettext('Security error'), error.data.message);
            else if (error.data?.exception !== 'EndpointError') messagebox.show({
                title: gettext('Server error'), data: error,
                template: '/core:resources/partial/serverErrorMessage.html', scrollable: true, negative: gettext('Close'),
            });
        } else if (error.status === 403) notify.error(gettext('Security error'), error.data);
        else if (error.status === 401 && !expired && !isAuthenticationRoute()) {
            expired = true;
            ++epoch;
            clearIdentity();
            notify.error(gettext('Your session has expired'));
            navigate(loginPath());
        }
    }
    const http = createHttp({ fetch, prefix, onError, context: () => epoch });
    async function refresh() {
        if (disposed) throw new Error('Session disposed');
        const requestEpoch = ++epoch;
        let data;
        try { ({ data } = await http.get('/api/core/identity')); }
        catch { return; } // HTTP policy reports errors; legacy init resolves and retains its snapshot.
        if (disposed || requestEpoch !== epoch) return;
        const identity = data.identity;
        current.value = identity.user == null ? anonymous() : {
            ...identity, profile: structuredClone(identity.profile ?? {}),
            machine: structuredClone(data.machine), color: data.color, isSuperuser: identity.effective === 0,
        };
        if (identity.user != null) {
            expired = false;
            clearTimeout(redirectTimer);
            finishLogout?.(); finishLogout = undefined;
        }
    }
    const identity = reactive({
        color: computed({ get: () => current.value.color, set: color => { current.value = { ...current.value, color }; } }),
        machine: computed(() => current.value.machine),
        user: computed(() => current.value.user), profile: computed(() => current.value.profile),
        isSuperuser: computed(() => current.value.isSuperuser),
        refresh,
        patch: fields => { current.value = { ...current.value, profile: { ...current.value.profile, ...structuredClone(fields) } }; },
    });
    function logout() {
        if (disposed || expired) return Promise.resolve();
        expired = true; ++epoch; clearIdentity();
        // Like the legacy service, redirect after 1s even if terminating the worker closes HTTP.
        void http.post('/api/core/logout').catch(() => {}); // HTTP policy already reports errors.
        return new Promise(resolve => {
            finishLogout = resolve;
            redirectTimer = setTimeout(() => { navigate(loginPath()); finishLogout = undefined; resolve(); }, 1000);
        });
    }
    async function activity() {
        if (disposed || expired || path() === '/view/login/normal') return;
        const requestEpoch = epoch;
        const { data } = await http.get('/api/core/session-time');
        if (disposed || expired || requestEpoch !== epoch) return;
        remaining.value = data;
        if (data > 0 && timer === undefined) timer = setInterval(() => {
            if (remaining.value <= 0) void logout();
            else remaining.value -= 1;
        }, 1000);
    }
    function dispose() {
        disposed = true; ++epoch; clearIdentity(); clearTimeout(redirectTimer);
        finishLogout?.(); finishLogout = undefined;
    }
    return {
        http, identity, state: reactive({ remaining: computed(() => remaining.value), counter: computed(() => counter(remaining.value)) }),
        activity, logout, dispose, start: async () => { await refresh(); await activity(); },
    };
}
