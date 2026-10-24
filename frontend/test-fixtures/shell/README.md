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

## Authentication oracle (P109)

`auth/` copies the unmodified login, TOTP, password-reset controllers/templates and
identity service from the P106 `ajenti_plugin_core-0.116` source archive. `auth.mjs`
loads them in a separate AngularJS injector. HTTP and browser navigation are doubled;
identity.auth runs the real success/error conversion, templates exercise real
ngModel text/password trimming and the date filter. The promise boundary uses
native promises for deterministic controller settling, not a replacement controller.
Backend payloads were also checked against core `views/api.py`; LM's
`lmn_common/resources/js/module.coffee` sets `loginredir='/'`.

`mountAuthHarness(element, { fetch, prefix, path, navigate, pwReset, gettext })`
in `src/shell/auth-harness.mjs` explicitly composes the P107 session and P108
presentation owners. `path` is a prefix-free existing login/TOTP/reset route;
HTTP uses `prefix`, `navigate` records full-page navigation. Dispose the returned
owner on teardown. Nothing imports this mount from a product entry; the production
Angular adapter, router, resources and bundles remain untouched. The node HTTP
mock exercises synthetic login+nonce, QR/verify/save/delete, reset errors and logout.
No VM, real credentials or real TOTP storage are involved.

Preserved: exact string provider flag `'True'`, lowercase username, password
spaces (revealed text input trims), six-character codes, three failed TOTP
attempts, envelopes/endpoints, confirmation before deletion, LM redirect `/`,
immediate reset-mail success/redirect even on HTTP failure, serial/complexity/update
failure messages and shared HTTP policy (401 suppressed on login/reset only).
Successful login refreshes identity before navigation as required by P107.

Intentional differences: crypto.getRandomValues replaces Math.random for secrets;
changing the key invalidates verification and ignores late QR/verify answers;
teardown clears temporary secrets and ignores late workflow results. Reset Enter
submits the actual save workflow (the original template calls a missing function).
The isolated forms keep Bootstrap classes but omit the customization logo and
animated lock/layout decorations; these are not a product entry. No server-side
nonce/attempt/rate-limit behavior is replaced by the client.

## Navigation/layout oracle (P110)

`navigation/` pins the unmodified Core 0.116 root/navbox controllers, sidebar and
floatingToolbar directives, sidebar template, customization/hotkey services and
filters from the P106 package archive. It also includes Core's Sidebar/Navbox
Python implementations, LM's current `main_view.html` and the original
`globalSettings.html` from fork commit `7a9aa7018^` (before the Settings port).
`navigation.mjs` executes the original controllers, recursive sidebar, toolbar
and Settings visibility expressions with real AngularJS. Only HTTP, identity,
clock, translation and hotkey boundaries are fixture services.

`createNavigation` owns the native read-only reactive `layout` (sidebar,
widescreen, overlay), customization, sidebar tree and navbox. Toggles accept an
optional explicit boolean; the first two persist under the original
`ngStorage-showSidebar` / `ngStorage-isWidescreen` JSON keys, overlay closes on
`routeChanged(path)`. `useShell(aj)` must run in a Vue scope. With `aj.shell` it
returns the native capability; until activation it shares a facade over the
existing Angular root scope, delegates original toggles through `$evalAsync` and
releases its watchers with the last consumer. It creates no session or socket.
The product Angular adapter/bootstrap/router remain unchanged. Settings and
Nextcloud are the only rebuilt consumers; F14 and F17 local seams are removed.
F15 continues to use the unchanged shared Vue Users workflow from P119.

`mountNavigationHarness(element, {session, storage, prefix, path, navigate,
reload, customization, plugin, gettext})` composes session, presentation, native
navigation and RouteHost explicitly. A full fixture page mounts on `document.body`
so existing `body > .container` CSS selectors apply; embedded test hosts inspect
DOM/state. ShellNavigation applies/restores its body classes, and the owner disposes
services and session. No product entry imports this mount. The session exposes
its already loaded UID/machine snapshot for the profile, without another request.

The actual localhost HTTP fixture reads four roles' shipped Users permission
entries. Sidebar grants and direct Students/Check/Apply authority are independent:
teachers have Students API access despite a hidden Students sidebar link. Core
Navbox searches provider entries without sidebar authorization; the port retains
this behavior and lets the backend enforce direct API rights. These tests emulate
those decisions and response shapes, not Python/LDAP/aj.auth execution. All saves,
Check/Apply and log content are synthetic. No VM is accessed.

Explicit differences from Core: the navbox fixes its `j` ReferenceError and avoids
its invalid `rankMatch:'title|translate'` lookup; server result order is retained,
nonfunctional Shift-number badges/shortcuts are omitted, Enter with no result is
ignored. Custom sidebar upper/lower content is escaped text rather than trusted
HTML, and the legacy feedback telemetry hook is omitted. Native teardown removes
listeners/timers and ignores late HTTP results; it never restores persisted layout
preferences. The harness has no tasks sidebar (P114), global loading overlay or
session countdown decoration; those owners remain separate. Touch swipe thresholds
match ngTouch; mouse-swipe emulation and Angular animations are omitted. Production
layout behavior is still delegated to Angular until the final switch.
