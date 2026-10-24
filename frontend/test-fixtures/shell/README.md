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

## Tasks/push/plugins (P114)

`tasks/` contains unmodified core 0.116 socket/push/tasks services and sidebar
markup, plus plugins 0.55 controller/template from the P106 package archives.
`tasks.mjs` runs the actual services/controller and Angular's repository filter in
an isolated AngularJS injector; HTTP, transport, native promises and dialogs are
fixture boundaries. Tests compare refresh order/loading, version comparison,
all three task classes/arguments, completion/failure and notifications. No test
executes pip, Python task processes, real credentials or a real panel restart.
`tasks-server.test.mjs` uses an actual local Socket.IO 4 server/client and HTTP
server for prefix, namespace, acknowledgements, reconnect, task lifecycle, plugin
refresh/update/restart confirmation and fixture class/action denial. The mock
models the allowlist in core `views/tasks.py` and per-action decorators in plugins
`tasks.py`; it does not prove Python authorization at runtime.

Server inventory: aj 2.2.17 pins python-socketio 5.16.2 / Engine.IO 4; JS client
4.8.3 uses Socket.IO protocol 5 / Engine.IO 4. Compatibility reference:
https://python-socketio.readthedocs.io/en/stable/intro.html#version-compatibility
This deliberately replaces the core service's legacy `resource`/reconnect/Safari
JSONP options with the supported client API (`path`, Manager reconnect events,
same-origin cookies). Namespace remains `/socket`, transport path is
`<prefix>/socket.io`. Tests use polling through this path; no VM is contacted.

Explicit future composition: create one `createTaskServices({ http, notify,
gettext, prefix })`, assign its `socket`, `push`, `tasks` to the shared aj object,
subscribe consumers before calling `start()`, mount `TaskSidebar` with that aj.
Subscriptions return an unsubscribe function. Dispose the owner on session teardown;
this removes Socket/Manager listeners and rejects outstanding tasks/acks. It never
replays a task start on reconnect; each connect requests the current task list.
As in the original protocol, terminal events missed while offline are not replayed
by request-update; there is no status-history endpoint or completion guarantee.
`mountPlugins(element, aj, { version })` returns route cleanup for `/view/plugins`;
no product entry, Angular facade, route registry or bundle imports these modules.
Presentation now exposes its existing `forceRestart` for the original post-task
confirmation; normal toolbar restart still uses `restart()` with confirmation.

The page retains superuser gating, core-not-uninstallable/pip availability,
original numeric version comparison (including the boolean core-upgrade display),
official/community lists, case-insensitive/negated filter and selected details.
Task classes are unchanged; backend class allowlist and plugins:install/uninstall/
upgrade authorization remain authoritative. LmLog is unchanged HTTP polling.
Differences: task snapshots are replaced rather than copied into old objects;
malformed JSON is ignored, request-update errors are exposed in owner state;
cleanup ignores late responses and rejects pending promises; start failures close
the install progress and notify instead of stranding it. Install version selection
uses local variables instead of original accidental globals. Uninstall has no
undefined `msg.close()` call; dismissing restart/confirmation is handled normally.
Direct page actions also stop for denied/disposed owners (original relies on the
root-access template and backend). Native buttons/progress/icons replace custom Angular directives and animation;
details use the existing Bootstrap modal classes, escaped text and safe HTTP(S)/
mailto links. They have Close buttons and, like the original inline `dialog`, no
Escape/backdrop dismissal. Core/pip metadata errors remain subject to the shared
HTTP error policy (also exposed as state.error), not a new empty-list fallback.
