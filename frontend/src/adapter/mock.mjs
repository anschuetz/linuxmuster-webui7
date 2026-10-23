import { reactive } from 'vue';

/**
 * @typedef {Object} MockOptions
 * @property {(request: {method: string, url: string, data?: unknown, cfg?: import('./aj.mjs').HttpConfig}) => Promise<import('./aj.mjs').HttpResponse>} [http]
 * @property {(level: string, title: string, text?: string) => void} [notify]
 * @property {(text: string) => string} [gettext]
 * @property {Partial<import('./aj.mjs').Identity>} [identity]
 * @property {() => void} [reload]
 * @property {(path: string) => void} [navigate]
 * @property {import('./aj.mjs').PageTitle} [pageTitle]
 * @property {import('./aj.mjs').Messagebox} [messagebox]
 * @property {import('./aj.mjs').Modal} [modal]
 */

/**
 * In-memory adapter. Callbacks allow tests to supply responses and observe effects.
 * No Ajenti dependencies and no network access.
 * @param {MockOptions} options
 * @returns {import('./aj.mjs').Aj}
 */
export function createMockAj({
    http = async () => ({ data: null, status: 200 }),
    notify = () => {},
    gettext = (text) => text,
    identity = {},
    navigate = () => {},
    reload = () => {},
    pageTitle = { set: () => {} },
    messagebox = {
        show: (options) => Object.assign(Promise.resolve({ ...options }), { close: () => {} }),
        prompt: async (text, value) => ({ value }),
    },
    modal = { open: async () => undefined },
} = {}) {
    return {
        pageTitle, messagebox, modal, reload,
        http: Object.fromEntries(['get', 'delete', 'post', 'put', 'patch'].map((method) => [
            method,
            async (url, ...args) => {
                const hasBody = ['post', 'put', 'patch'].includes(method);
                return http({ method, url, data: hasBody ? args[0] : undefined, cfg: args[hasBody ? 1 : 0] });
            },
        ])),
        notify: Object.fromEntries(['success', 'info', 'warning', 'error'].map((level) => [
            level, (title, text) => notify(level, title, text),
        ])),
        gettext,
        identity: reactive({ user: null, profile: {}, isSuperuser: false, ...identity }),
        navigate,
    };
}
