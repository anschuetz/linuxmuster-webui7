# Legacy HTTP/session oracle (P107)

Unmodified `ajenti.plugin.core==0.116` release sources from the P106 package inventory:

- `resources/vendor/angular/angular.min.js` (AngularJS 1.8.3, MIT; license alongside)
- `resources/js/core/interceptors.es`
- `resources/js/core/services/identity.service.es`

`legacy.mjs` loads these only in an isolated test window. The backend double records
`$http` requests and supplies XHR-decoded responses; undefined/null headers are
omitted as in the real XHR transport. No production resource imports these files.

The contract tests compare all six methods, JSON/raw text, params, headers, blob
responses, FormData and errors. Existing consumers checked: `adapter/ajenti.mjs`,
`common/smbclient.mjs` (blob download), Samba-shares HEAD and plugin API wrappers.
The prefix interceptor's literal concatenation and `$http`'s literal parameter
append (including hashes) are retained. Session API/route-activity/countdown and
logout-delay references are the same release's `views/api.py` and
`resources/js/core/controllers/root.controller.es` (P106 source archive).

The new session core is explicit (`start`, `activity`, `dispose`); the future router
reports route activity. Login code must await `identity.refresh()` after successful
authentication. Expiry/logout immediately discard the snapshot; an epoch prevents
late identity responses from restoring another identity. Error policy still applies to older requests. The production Angular
adapter, bootstrap and bundles are unchanged. Session/identity tests and the local
HTTP mock server need no VM.

## Presentation oracle (P108)

`presentation/` contains the unmodified core 0.116 `gettext`, `messagebox`,
`notify`, `pageTitle`, `core` and `favicon` services from the same P106 archive,
plus its vendored angular-gettext 2.4.2 (MIT license included).
`presentation.mjs` runs the services in a separate AngularJS injector with fake
HTTP, toaster and timeout boundaries; favicon tests compare real service drawing
commands with a canvas double. The unchanged Links IIFE also verifies live locale
updates. `locale-server.test.mjs` uses an actual local HTTP server and the new HTTP
adapter. No test contacts a VM.

`createLocale.start()` loads languages and the initial catalog independently;
`setLanguage()` only loads runtime JSON, exactly like core. Explicit persistence
stays with Settings' existing config POST; core `views/config.py` requires UID 0
and `core:config:write` (GET additionally requires `core:config:read`). This task
does not change that authorization or introduce a user-config language setting.
Regional fallback deliberately follows angular-gettext's underscore-only rule.

Presentation owners are explicit: mount `ShellServices` and pass its services to
the future adapter; compose locale's `gettext` and supply `getAj` for full modal
injection. Initialize favicon explicitly like core, then dispose owners on route/
session teardown. The session identity now exposes the already loaded `color`.
No production entry imports these modules. Messagebox close hides without
settling; disposal rejects even hidden handles. Messageboxes keep core's lack of
Escape/backdrop dismissal; Vue modals implement the adapter's independent
keyboard/backdrop options and sm/lg sizes. Restart preserves core's early
confirmation result and schedules the same subsequent reloads.

Intentional differences: no 1s hidden-message retention/Angular animation;
notification bodies (including custom URL notifications) render text instead of
trusted HTML; server error data renders as escaped JSON instead of ng-include.
Restart transport failures show an error notice (core references an uninjected
`notify`). Pending UI handles reject and timers/listeners stop on disposal.
