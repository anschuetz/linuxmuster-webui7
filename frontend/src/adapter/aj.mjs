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
 * @property {(url: string, cfg?: HttpConfig) => Promise<HttpResponse>} head
 * @property {(url: string, data: unknown, cfg?: HttpConfig) => Promise<HttpResponse>} post
 * @property {(url: string, data: unknown, cfg?: HttpConfig) => Promise<HttpResponse>} put
 * @property {(url: string, cfg?: HttpConfig) => Promise<HttpResponse>} delete
 * @property {(url: string, data: unknown, cfg?: HttpConfig) => Promise<HttpResponse>} patch
 *
 * @typedef {(title: string, text?: string, options?: {sticky?: boolean, timeout?: number}) => void} Notification
 * @typedef {Object} Notify
 * @property {Notification} success
 * @property {Notification} info
 * @property {Notification} warning
 * @property {Notification} error
 *
 * @typedef {Object} Identity Reactive identity supplied by the shell/adapter.
 * @property {() => Promise<void>} refresh Renew identity and publish a fresh snapshot.
 * @property {string|null} user
 * @property {Record<string, unknown>} profile
 * @property {(profileFields: Record<string, unknown>) => void} patch Merge profile fields through the shell and publish a fresh reactive snapshot.
 * @property {boolean} isSuperuser
 *
 * @typedef {Object} PageTitle
 * @property {(text: string) => void} set
 *
 * @typedef {{title?: string, text?: string, positive?: string, negative?: string}} MessageOptions
 * @typedef {Promise<unknown> & {close: () => void}} MessagePromise close only hides the message.
 * @typedef {Object} Messagebox
 * @property {(options: MessageOptions) => MessagePromise} show Resolves on positive, rejects on negative.
 * @property {(text: string, value: string, inputType?: string) => Promise<{value: string}>} prompt
 *
 * @typedef {Object} Modal
 * @property {(Component: import('vue').Component, props?: Record<string, unknown>, options?: {backdrop?: 'static' | true, keyboard?: boolean, size?: 'lg'}) => Promise<unknown>} open
 * Component supplies modal-header/body/footer; emit('close', result) resolves,
 * emit('cancel'), Escape, backdrop or route disposal reject.
 * Defaults: backdrop: true, keyboard: true. backdrop: 'static' disables backdrop dismissal;
 * keyboard: false disables Escape independently. Route disposal still rejects. size: 'lg' opts into the Bootstrap large frame.
 *
 * @typedef {Object} ShellLayout
 * @property {{sidebar: boolean, widescreen: boolean, overlay: boolean}} layout Read-only reactive layout.
 * @property {Record<string, unknown>} customization Read-only plugin customization supplied by the shell.
 * @property {(state?: boolean) => void} toggleNavigation Persist the sidebar choice.
 * @property {(state?: boolean) => void} toggleWidescreen Persist the widescreen choice.
 * @property {(state?: boolean) => void} toggleOverlayNavigation Mobile state, never persisted.
 *
 * @typedef {Object} Aj
 * @property {ShellLayout} [shell] Native shell capability shared by all mounted plugins.
 * @property {{setLanguage: (language: string) => Promise<unknown>}} locale Change the shell language and load its catalog.
 * @property {() => Promise<unknown>} restart Open the shell restart confirmation and preserve its result.
 * @property {(fn: () => boolean|void) => (() => void)} guardLeave Register a synchronous route guard; exactly false prevents a location change. Returns an idempotent unsubscribe. The route owner also removes it on disposal.
 * @property {() => void} reload Reload the active route through the shell.
 * @property {PageTitle} pageTitle
 * @property {Messagebox} messagebox
 * @property {Modal} modal
 * @property {Http} http Resolves the response, never just its data payload.
 * @property {Notify} notify
 * @property {(text: string) => string} gettext
 * @property {Identity} identity
 * @property {(path: string, options?: {replace?: boolean}) => void} navigate
 */
export {};
