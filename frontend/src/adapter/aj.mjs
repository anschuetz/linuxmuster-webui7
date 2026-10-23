/**
 * Backend-neutral subset of the aj contract for P01.
 * Components obtain this object exclusively through inject('aj').
 * The mount boundary also exposes aj.gettext as template $gettext.
 * URL prefixes, authentication and HTTP error policy belong to the adapter.
 *
 * @typedef {{data: unknown, status: number}} HttpResponse
 * @typedef {Record<string, unknown>} HttpConfig
 * @typedef {Object} Http
 * @property {(url: string, cfg?: HttpConfig) => Promise<HttpResponse>} get
 * @property {(url: string, data: unknown, cfg?: HttpConfig) => Promise<HttpResponse>} post
 * @property {(url: string, data: unknown, cfg?: HttpConfig) => Promise<HttpResponse>} put
 * @property {(url: string, cfg?: HttpConfig) => Promise<HttpResponse>} delete
 * @property {(url: string, data: unknown, cfg?: HttpConfig) => Promise<HttpResponse>} patch
 *
 * @typedef {(title: string, text?: string) => void} Notification
 * @typedef {Object} Notify
 * @property {Notification} success
 * @property {Notification} info
 * @property {Notification} warning
 * @property {Notification} error
 *
 * @typedef {Object} Identity Reactive identity supplied by the shell/adapter.
 * @property {string|null} user
 * @property {Record<string, unknown>} profile
 * @property {boolean} isSuperuser
 *
 * @typedef {Object} Aj
 * @property {Http} http Resolves the response, never just its data payload.
 * @property {Notify} notify
 * @property {(text: string) => string} gettext
 * @property {Identity} identity
 * @property {(path: string) => void} navigate
 */
export {};
