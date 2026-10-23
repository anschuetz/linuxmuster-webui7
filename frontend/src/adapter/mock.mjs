import { reactive } from 'vue';

/**
 * @typedef {Object} MockOptions
 * @property {(request: {method: string, url: string, data?: unknown, cfg?: import('./aj.mjs').HttpConfig}) => Promise<import('./aj.mjs').HttpResponse>} [http]
 * @property {(level: string, title: string, text?: string) => void} [notify]
 * @property {(text: string) => string} [gettext]
 * @property {Partial<import('./aj.mjs').Identity>} [identity]
 * @property {(path: string) => void} [navigate]
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
} = {}) {
    return {
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
