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

## Dashboard/session_list oracle (P113)

`dashboard/` pins unmodified dashboard 0.42, session_list 0.7 and filesystem 0.51
sources from the P106 archives, core 0.116 user-config/format/root-access sources,
and the fork's `lmn_w_datetime` sources at `c53086d6a`. Only executed scripts
and templates compiled by tests are retained; unused source duplicates and backend
files are omitted. `dashboard.mjs` executes the
shipped dashboard, session-list and datetime scripts in real AngularJS 1.8.3;
HTTP/Promise, interval and prompt boundaries are fixture doubles. Rejections from
the original's unhandled chains are recorded by the HTTP boundary. Template tests
compile the original session table/root-access directive and widget templates for
uptime, CPU, memory, disk, load average, sessions and datetime, including empty values.
The local HTTP server checks prefixed endpoints, exact whole-config/value payloads,
500 policy and UID-0 versus three synthetic non-root roles; Python/psutil/LDAP and
real sessions are not executed. Backend contracts were checked in the P106 archives
and fork at `c53086d6a`: session values are only an update signal, disk data has
memory's shape, and datetime text (including the original import-time clock) is
formatted by the server, never by the client.

`mountDashboardRoute(element, {aj, path, initialConfig, customization})` is explicit
and isolated. It accepts only `/view/dashboard` and `/view/session_list`, provides
`aj`, and returns its disposer. Pass the existing bootstrap config for
`session_max_time` and the dashboard customization fields; the defaults match the
original. Components use `aj` exclusively. No product entry, Angular adapter,
route registry or landing-page startup imports these modules. Polling starts after
user config (dashboard: first tick at 1s, all tabs) or immediately (session list:
then every 15s); unmount stops timers and ignores pending results.

Behavior retained: hexadecimal instance IDs, legacy one-tab migration without an
initial write, all unrelated user-config fields, full-config saves, hidden right
column values, live widget config, datetime's three format strings/default, no
auto-config dialog on adding a widget (original instance lacks config_template),
and no immediate persistence when only switching width. The stock session list
is unrelated to `lmn_session_new`'s teaching-group list/API and remains separate.

Differences: native buttons/progress/dialog and HTML drag events replace Angular
UI/animations; only known Vue widget types render, never server-supplied Angular
templates. Late results after unmount are discarded; a removed active last tab selects
an existing tab. The sessions widget fixes the original shipped strict-mode
`for (let session in dict) session.date = …` exception for nonempty dictionaries;
the original exception is asserted while the port renders identities/addresses.
The unused per-row `date` assignment is omitted (table formats timestamp seconds
like the original), and no client-side datetime clock/strftime is introduced.

## Stock settings and passwd (P115)

`settings/` copies unmodified settings 0.35 controller/template/views, core 0.116
config service/views and passwd 0.28 service/views from the P106 archives.
`settings.mjs` invokes the real controller function through Angular's injector
(the distributed ES arrow controller needs transpilation for `$controller`'s
constructor call); config/passwd are real Angular services, ngModel/date are real
Angular directives/filters. HTTP, confirmation, notifications and locale are
fixture boundaries. The template is compiled without Bootstrap layout directives.
`settings/backend.py` executes the original Python Handler method bodies after
removing imports/decorators/class base via AST. UID, authorize, config providers,
pwd and chpasswd are fixtures; it never imports OS authentication or executes
chpasswd. This proves endpoint guards and payload parsing, not Ajenti's auth
middleware, PAM or filesystem permissions. The local HTTP server uses these
methods for core/user/SMTP/TFA/passwd and synthetic certificate responses only.

`mountStockSettings(element, aj, {path:'/view/settings', machine, customization})`
explicitly mounts the stock route with an already refreshed identity. It returns
`{model, dispose}`; no product entry/router imports it. LM settings remains its
own route. `createConfiguration(http)` exposes core, user-config, SMTP, TFA,
authprovider and permissions operations without guessing API permissions from
sidebar/customization. Root UI entry checks `identity.isSuperuser`; core read and
write guards are independently exercised on the original endpoint bodies.
The shared session now exposes its loaded machine metadata and writable color
preview; a subsequent identity refresh replaces that preview as in the original.
Language changes load locale only; persistence is still the explicit config POST.
No new user-config UI or password-change form is invented for stock settings.

Preserved subtleties: changed certificate => test then config POST, no SMTP POST;
unchanged certificate => config/loaded SMTP POST independently; oldCertificate
stays the originally loaded path. Server generation disables forced client auth
before request, clears client certificates on success, then saves. Client request
includes `generating:true` and subsequent generations retain original extra
fields; descriptors and data URL/download filename match. User selection resets
CN to the signed-in identity's user@hostname, not the selected user's name. TFA
uses a string timestamp. Trusted removals confirm; revocation and TFA do not.
Text fields trim models while preserving spaces during typing, passwords retain
spaces unless the revealed text field is edited. Loading/failed config is not
replaced by an empty successful configuration.

Known original defect deliberately retained: passwd service sends `{user,password}`
while passwd 0.28 Python reads `data['users']` (root also fails during chpasswd
construction). The fixture demonstrates the failure; raw backend `{users,password}`
proves root/own-identity authorization and CR/LF removal. No password change is
claimed to succeed with this unchanged upstream contract. Certificate endpoints
in settings 0.35 lack their own UID/core permission guards; those are not added
or inferred by the fixture, and the new workflow restricts all certificate actions
to the root route. Backend hardening is outside this port and needs independent
coordinator review before activation.

Differences: non-root route skips even controller requests (original rootAccess
only replaces DOM); passwd service denies list/non-own changes locally in addition
to backend checks. Teardown discards late responses/follow-up writes and clears
loaded config/SMTP/certificate data; confirmation cancellation is consumed. Changed
certificate config-save rejection now produces SSL Error instead of the original
unhandled nested promise. Buttons/selects and an inline Bootstrap-styled client
dialog replace uib tabs/radios/overlay and icon-only controls; no Escape/backdrop
handling is added. SMTP fields wait for a loaded smtp object instead of creating
one after a failed load. Help text remains text/title content, no trusted HTML.

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
`routeChanged(path)`. The path must include `prefix`, exactly like browser
`location.pathname` (e.g. `/panel/view/lmn/users/students`); sidebar active state
compares it with `prefix + item.url`, as in the original template. `useShell(aj)`
must run in a Vue scope. With `aj.shell` it returns the native capability; until activation it shares a facade over the
existing Angular root scope, delegates original toggles through `$evalAsync` and
releases its watchers with the last consumer. It creates no session or socket.
The product Angular adapter/bootstrap/router remain unchanged. Settings and
Nextcloud are the only rebuilt consumers; F14 and F17 local seams are removed.
F15 continues to use the unchanged shared Vue Users workflow from P119.

`mountNavigationHarness(element, {session, storage, prefix, path, navigate,
reload, customization, plugin, gettext})` composes session, presentation, native
navigation and RouteHost explicitly. Its `path` follows the same prefixed
`location.pathname` contract; the default is `${prefix}/view/lmn/landingpage`.
A full fixture page mounts on `document.body`
so existing `body > .container` CSS selectors apply; embedded test hosts inspect
DOM/state. ShellNavigation applies/restores its body classes, and the owner disposes
services and session. No product entry imports this mount. The session exposes
its already loaded UID/machine snapshot for the profile, without another request.

The localhost HTTP fixture uses four roles' shipped Users permission entries
for synthetic sidebar filtering and API status responses. The tests use the same
`permission()` helper for expectations: they are pass-through tests of supplied
sidebar/identity/API responses, not independent authorization tests. UID and
`school_show` are invented fixture values, not verified role behavior. No
Python/LDAP/aj.auth execution is covered. The synthetic Navbox response is not
filtered by sidebar grants. All saves, Check/Apply and log content are synthetic.
No VM is accessed.

Explicit differences from Core: the navbox fixes its `j` ReferenceError and avoids
its invalid `rankMatch:'title|translate'` lookup. With actual results, the original
filter accesses the undefined `title|translate` property and renders **zero list
entries**; only Enter navigation works. The native Navbox intentionally renders a
clickable result list instead. A DOM comparison runs the original list fragment
and filter to pin that difference. Server result order is retained,
nonfunctional Shift-number badges/shortcuts are omitted, Enter with no result is
ignored. Custom sidebar upper/lower content is escaped text rather than trusted
HTML, and the legacy feedback telemetry hook is omitted. Native teardown removes
listeners/timers and ignores late HTTP results; it never restores persisted layout
preferences. The harness has no tasks sidebar (P114), global loading overlay or
session countdown decoration; those owners remain separate. Touch swipe thresholds
match ngTouch; mouse-swipe emulation and Angular animations are omitted. Production
layout behavior is still delegated to Angular until the final switch.

## Complete shell activation (P112)

`routes.json` is the exact 55-route register from P106's read-only E1-bereit
inventory (`logs/p106-e-inventory.json`, 2026-10-24, core 0.116/webui7 7.4.13).
The router test compares the complete register (plus a root redirect/catch-all),
not just its count. Original controllers, services and directives above remain
the contract oracle. `e2e/shell.pw.mjs` runs both full entries on Satz E with the
same fixtures from `shell-fixtures.mjs`: four synthetic roles, TOTP nonce/three
failures/success, all stock routes, school switch, dirty guards, route teardown,
F5/History/404 and a prefixed reverse-proxy fixture. A separate real-session
login/logout/F5 test runs each entry for all four E accounts; Vue additionally
requires a real successful socket task-update request and absence of Angular.
No TOTP data, school switch, configuration write or package operation is sent to
the VM by the fixture tests. Synthetic UID/permission fixtures prove frontend
behavior, not server authorization. The prefix test proxies to the unchanged VM
root; it does not reconfigure Ajenti's actual listener. Existing part oracles
continue to verify the exact stock service/controller payloads.

Activation-specific differences: leave guards cannot block an expired-session
redirect; route changes reject dialogs/modals and stop route-owned timers/abos;
notifications survive normal navigation but clear when identity changes. The
old Angular UI retained some global messageboxes across routes. Native login
keeps the logo and fields with native buttons rather than the animated lock and
Angular layout/disabled links. The prefix is applied to school/reset links,
Ace workers and standalone Flow chunk targets (the old absolute school link lost
it). Existing stored widescreen choices are preserved instead of the LM run hook
forcing `true` on each bootstrap. The SPA rechecks wizard configuration after
login and clears the session plugin's cached exam/session state on logout,
including re-login as the same user. `/view/ui-test` retains its inert stock
sample controls; 404 includes the escaped URL. Only one shell is ever bootstrapped,
so the Angular adapter's modal owner and the Vue owner's modal stacks cannot mix.

The installed-ID fixture (`installed-plugins.json`, same P106 inventory) also
checks route availability against the actual metadata names. Device Manager is
`lmn.device-manager` in that inventory, while its directory is
`lmn_device-manager`. Core 0.116's static handler only matches `\w+` plugin URL
segments. The build therefore copies this one IIFE byte-for-byte into
`lmn_common/resources/vue/lmn_device-manager.js`; the explicit manifest maps the
metadata ID to that URL. No stock endpoint or foreign package is patched.

Review correction: stock settings, LM global settings and the wizard now share
confirmed Core config GET/POST snapshots through the native HTTP adapter. Before
its first welcome page the wizard loads a complete authorized config; failure
shows an error instead of allowing a partial bootstrap config to overwrite it.
The cache is cleared at identity changes, and late responses cannot repopulate
another session's cache. Local unsaved language changes survive a wizard reload;
unsaved settings-form changes are not transferred to another page. The legacy
shared mutable config object could expose those unsaved edits between pages.
The global auth guard also protects 404, UI sample and disabled-quota pages
(the old shell displayed those without login). Route-owned titles reset before
the next plugin sets its title.
The welcome route also waits for pending Core config writes before taking its
form snapshot. This covers an immediate Settings-Save→Wizard click while the
save response is still in flight; failed saves cause an authorized reload.

## Angular removal (P116)

The production package has no Angular sources, templates, bridge, Bower or
Multitool build. Historical Angular files above remain isolated test oracles;
`src/adapter/ajenti.mjs` and its bridge-only tests are retired. The native adapter,
HTTP/session/presentation and exact 55-route tests remain the replacement oracle.
`e2e/shell.pw.mjs` now runs only Vue on Satz E, for all four roles with the same
fixtures and real login/logout/F5. Every case checks network resources, DOM and
trapped Angular global accesses. An old query/tab preference cannot restore Angular.
`installed-plugins.json` lists all 36 installed IDs (8 unchanged Stock/Core,
28 project plugins), `routes.json` lists all 55 routes; no third-party frontend
is supported. `frontend/vendor/README.md` records the pinned static assets.
Four remaining old toolbar event seams now use `aj.shell`; Devices' former
Angular route listener uses the native leave guard and disposes with its route.
Legacy plugin Alt/Neu Playwright runs belong to their original port commits;
the shell suite is the acceptance entry for the Angular-free package.
