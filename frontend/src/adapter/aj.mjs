/**
 * Backend-neutral subset of the aj contract.
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
 * @typedef {(title: string, text?: string, options?: {sticky?: boolean}) => void} Notification
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
 * @typedef {Object} PageTitle
 * @property {(text: string) => void} set
 *
 * @typedef {{title?: string, text?: string, positive?: string, negative?: string}} MessageOptions
 * @typedef {Promise<unknown> & {close: () => void}} MessagePromise close only hides the message.
 * @typedef {Object} Messagebox
 * @property {(options: MessageOptions) => MessagePromise} show Resolves on positive, rejects on negative.
 * @property {(text: string, value: string) => Promise<{value: string}>} prompt
 *
 * @typedef {Object} Modal
 * @property {(Component: import('vue').Component, props?: Record<string, unknown>, options?: {static?: boolean}) => Promise<unknown>} open
 * Component supplies modal-header/body/footer; emit('close', result) resolves,
 * emit('cancel'), Escape, backdrop or bridge scope destruction reject.
 * With {static: true}, Escape and backdrop do nothing; scope destruction still rejects.
 *
 * @typedef {Object} Aj
 * @property {() => void} reload Reload the active route through the shell digest.
 * @property {PageTitle} pageTitle
 * @property {Messagebox} messagebox
 * @property {Modal} modal
 * @property {Http} http Resolves the response, never just its data payload.
 * @property {Notify} notify
 * @property {(text: string) => string} gettext
 * @property {Identity} identity
 * @property {(path: string) => void} navigate
 */
export {};
