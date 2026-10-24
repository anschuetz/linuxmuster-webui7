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
`notify`, `pageTitle`, `core` and `favicon` services and the `messageboxContainer` directive from the same P106 archive,
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

P111: `files/` contains unmodified filesystem 0.51 (`filesystem.service.es`,
`pathSelector.es`, `fileDialog.es/html`, `views.py`) and ace 0.32 (`ace.es`)
from the P106 package archives. `files.mjs` loads these directives/services into
real AngularJS; only HTTP, hotkeys, the dialog layout and the Ace engine are
fixture services. It compares defaults, encoding/payloads, selection/cancel,
path-selector binding and upload descriptors/progress. The local HTTP server
uses the read/write decorators and response shapes from `views.py`; it does
not execute Python, POSIX ACLs, symlink resolution, or a real Flow chunk server.

Shared Vue counterparts: `common/CodeEditor.vue`, `FileDialog.vue`,
`PathSelector.vue`, `FileUpload.vue`, `filesystem.mjs` and `fileBrowser.mjs`.
FileEditor/Backups, clients/linbo embedded editors, settings path selectors and
SMB uploads reuse them; no Angular adapter or shell bootstrap is changed.
The old Ace assets/global Flow remain required until the final shell switch.
The browser retains eager loading and directory position per selector.
Differences: paths/query parts are escaped; navigation and selection reject
outside-root paths before use (the original only used a string prefix after
loading); stale loads/disposal cannot overwrite newer state; load errors are
visible and failed/busy save/directory selections are disabled. Upload failures
reject and detach instead of leaving the original promise pending (shared with
the existing SMB implementation). These are UI constraints, not server ACLs.
`write` retains the original raw UTF-8 HTTP body and encoding query; the legacy
Python implementation decodes UTF-8 and writes in its process encoding, even
when a different encoding was requested. No new transcoding is claimed.
