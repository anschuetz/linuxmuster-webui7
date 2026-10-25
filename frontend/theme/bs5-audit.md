# P150 · Bootstrap 5 disposition of the A1 audit

A1 evidence (`core.css`, `bootstrap3.css`, `ajenti.css`, `core-order.json`,
`core-selectors.tsv`, `core-audit.md`) stays unchanged and reconstructible.
`bs5-counterparts.tsv` covers **all 368** modified BS3 counterparts from
`core-audit.md`, with their original line ranges and the number of BS5 peers
having the same complete selector and grouping context. A different selector
is not evidence of equivalent behavior; the offline browser fixtures exercise
critical old DOM contracts as well.

## Reset and order

Only the BS5 distribution provides Reboot. The active `ajenti-bs5.css` starts
at A1's first `body` rule (theme line 92, original core line 1068); its Normalize
and print prelude is omitted. The remaining theme rules/declarations are
unchanged. The archived file includes the original prelude for A1 reproduction.
The compatibility sheet starts after the BS3 reset/print section and includes
only selected component/typography/grid contracts, never Normalize.
715 of 730 A1 theme leaf rules remain, with identical ordered declarations.

BS5 → Toaster/loadingbar base CSS → legacy Glyphicons → selected BS3 structural
compatibility → BS5 bridges → active Ajenti theme → Ace, dashboard → sorted
plugin SCSS. Base Toaster CSS precedes Ajenti so the original 0.85/0.9 toast
opacity and theme precedence remain intact.
The order gives the Ajenti colors and Common customization the final word.
A1's 324 interleaving boundaries show why simple concatenation alone is
insufficient: generic `.btn`, `.panel` and `.navbar` theme rules originally
preceded some of the unchanged BS3 variants. The bridges restore those variants
with component-scoped specificity. They do not reorder or edit theme rules.
The old float grid stays until B2/C1: converting the old DOM to flex during this
foundation change would violate the 1:1 goal. `sm` is 768, `md` 992, `lg` 1200;
BS5's earlier 576 container maximum and row child defaults are neutralized.

## Counterpart effects and bridges

| A1 rule families | Checked effect against BS5 / disposition |
| --- | --- |
| Normalize/print prelude | Removed from active theme; Reboot supplies the only reset. |
| Body, headings, lists, code, tables | Keep theme declarations. Legacy pixel typography restores rem/spacing differences; table cell paint/shadows and inherited borders are restored. |
| `.row`, `.col-*`, `.container*` | Keep theme gutters and fixed shell widths. Restore original widths/offsets/push/pull/float order; width reset precedes those rules. |
| `.form-control`, input groups, validation/feedback | Keep theme declarations. Restore table/addon DOM, native appearance, inherited control weight and single-control TOTP shrink-wrap; neutralize BS5 negative margins. |
| `.btn*`, `.btn-flat`, `.btn-lmn*` | Theme/Common variants unchanged. Compound selectors restore xs/sm/block after base button declarations, with the final Common border-radius retained. |
| `.modal*`, `.fade.in`, native dialogs | Keep Ajenti sizes/padding/backgrounds. Restore block header/footer/content, `.in` transform/opacity, old 768/992 modal sizes; native messagebox keeps outer `z-index:auto`, its modal retains Common's **2000**. |
| `.navbar*`, sidebar, overlay | Keep 60px Ajenti height and all theme/Common sidebar/overlay z-indices. Restore block container, fixed positioning and square corners; P132's `calc(100dvh - 60px)` remains untouched. |
| Tabs/pills, `.open`, dropdowns | Retain old li/a and state selectors; restore anchor colors when href is absent, including BS5's higher-specificity Reboot selector. |
| Panels, wells, labels, badges, progress, alerts | Keep theme decorations; restore contextual panel border precedence, block progress bars and old alert positioning. |
| `.text-*`, `.bg-*` | BS5's important utilities otherwise defeat old colors. Scope BS5 RGB variables to each legacy utility (text and background success have different original colors). |
| Own selector lists, animation/keyframes, responsive Ajenti helpers | Carry unchanged; no source-class or JS-state migration in A2. |

Each compatibility rule names P137 evidence and removal package. Static counts
in those comments count only `kind=class` rows, not CSS selectors or dynamic
expressions. Zero static uses for Glyphicons/BS hidden-visible helpers is
explicit; their retention was required by P150. The three compatibility files total 177025 bytes, of which 69388 remain
without comments (including whitespace); the rest is per-rule documentation.

## Handover to B/C/D

Not copied from BS3: carousel, tooltip, popover, jumbotron, media objects,
pager/pagination, navbar-inverse/form, justified navigation, image helpers and
BS3 print styling. Theme-specific selectors for these remain unchanged as A1
evidence/own theme declarations; no full BS3 support is promised for them.
If a real page requires these structures, its B/C package must port them or
justify a small compatibility addition. B1/B2/B3/B4/B5/B6 own shared modal,
nav/auth/form contracts; each C package removes its plugin's old classes;
D1 removes the residual grid/helpers/Glyphicons and the evidence assets.
P141 D01–D14 are unchanged work for their named B/C packages.

Local check: `node e2e/bs5-compat.local.mjs /LOG-DIR` runs offline Chromium,
blocks every network request, compares computed geometry/visual styles and PNG
bytes against A1 commit `a176c2c0b`. Six scenes × five widths (1440/768/767/576/390)
cover shell/page, three modal sizes, native messagebox and P132 login/TOTP.
This is a local critical-contract check, not the pending all-page Satz-E capture
or a Safari/Firefox/Edge visual acceptance.

## Teil 2: actual Satz-E findings (temporary compatibility, not B/C fixes)

The first 8755a1d36 capture exposed contracts absent from the initial local
fixtures. Each is now represented once by the corresponding DOM fragment in
`test-fixtures/bs5-compat.html` and the same offline image/style comparison:

- Landing `.info-cards` panel border precedence and the unclassed action anchor.
- List-group block flow, inherited foreground and complete overlapping borders.
- Native Dashboard tab button painting/foreground and summary marker.
- Non-column `.row` children: restore zero padding and remove BS5 max-width caps
  before column/component rules supply their own dimensions; LINBO/footer cases.
- Column base widths outside `.row`, before the original 768/992/1200 rules;
  Quotas check form at 768 must not pick up BS5's earlier md width.
- Native zero cell padding in `.lm-table`, before Common's header/padded variants;
  Devices and ListTable editable cells must keep their original height.
- Divider opacity/UA geometry/foreground from the old hr contract.
- Direct `.input-group > .btn-lmn` action keeps its old corners, static position
  and Common margins; it is not the BS3 `.input-group-btn` wrapper structure.
- Toaster notifications have Vue-owned lifetime and no BS5 `.show`. Restore
  visibility and native font/border sizing; retain original vendor→theme order.
- Formerly inert `.card` wrappers around `.list-group-flush` in GlobalEdulution
  and Wireguard keep plain block geometry until C12/C5 port that structure.

P140 sidebar spacing, P148 translated catalog keys (2a4187927), session counts,
bind-user ordering and live Dashboard statistics are independent of the A2 CSS.
Missing VDI error toasts in the first capture were an A2 visibility defect, not
a service-state classification; the notification fixture catches it.
Existing P141 mobile clipping remains B/C work and must not grow in the A2 build.

## P151 / B1: Vue-owned modal state
Shell modal frames/backdrops now use `fade show`; messagebox/task-detail frames and Toaster use `show`.
The three explicit `.show` compatibility selectors preserve Ajenti's final transform, frame opacity and 50% backdrop opacity;
Ajenti's later `.modal.fade .modal-dialog` / `.modal-backdrop.fade` otherwise override Bootstrap's state.
No Bootstrap JavaScript, additional close control or rem-sized control is introduced.
Scrollbar policy remains unchanged: Vue adds/removes `body.modal-open`, preserving a pre-existing lock;
there is no scrollbar measurement or body padding compensation. The unused `.modal-scrollbar-measure` rule was removed after a source/resources search (zero consumers). The viewport's scrollbar disappears while locked.
Nested service frames/backdrops start above 1050 and are clamped to 1998/1997, below native messageboxes at 2000; the first pair keeps A2 geometry. Two deliberate B1 interaction refinements: Escape does not cancel a service frame while an open native messagebox is above it; backdrop cancellation also checks `isTop()`, matching the upper full-screen frame's pointer interception (P151/CHAT 284–285).
Legacy `.in`, header/footer/body/size rules remain for Common/plugin consumers (B4/B5/C/D1);
see `frontend/src/common/users/UserDetails.vue`, `common/FileDialog.vue`, `plugins/lmn_groupmembership/Details.vue`,
`plugins/lmn_clients/Clients.vue`, and `usr/lib/linuxmuster-webui/plugins/lmn_common/resources/styles.scss`.
Local proof: `node e2e/bs5-modals.local.mjs /ABS/LOG-DIR` compares 30 A2/BS5-state PNG pairs and exercises the actual service in Chromium.

P151 review R: the old JavaScript check only compared generated paths to the Git index (plus pinned assets/metadata); it did not compile current sources.
`check-built-resources.mjs` now additionally compiles the shell in memory with the shared production `shellBuildConfig` and requires byte equality with `shell.js`.
A stale-artifact regression test exercises this check; plugin build conventions and output remain unchanged.

## B2 / P152: Navigation
`ShellNavigation` uses `navbar shell-navbar fixed-top`, sidebar `nav-item`/`nav-link`, profile `dropdown-menu-end`/`dropdown-item` and Vue-controlled `.show`; no Bootstrap JS. Existing Ajenti float layout, 768/992 breakpoints, colors/customization and P140 icon slot remain. The obsolete `.navbar-fixed-top` Compat selectors are removed; shared tabs/dropdowns/navbar-bottom and historical theme rules remain for later packages/D1.
`ResizeObserver` measures the actual navbar border box into `--shell-header-height` (single 60px fallback). Content and both sidebars use it as their top padding; auth min-height uses the same variable for vh/dvh. The overlay stays at top 0 with shared padding to preserve its desktop/tablet geometry. Login/Reset/TOTP renderers are unchanged. Observer/inline variable are cleaned up on unmount.
After review R / CHAT 290, the original mobile overlay behavior is retained: no backdrop, Escape handler or programmatic focus changes. Clicking the exposed content continues to activate it; menu routes/toggle close as before. Escape/focus support is a future accessibility proposal, not part of B2. No menu filtering, endpoint, school-change/logout or adapter logic changes. The obsolete `.navbar.navbar-fixed-top` selector in `compat-bs5.css` is removed; its shared navbar-bottom counterpart remains.

## P154 B4 · Common file dialogs
FileDialog/Editor/Backups/Diff use BS5 modal titles and `btn-light`; file rows add `list-group-item-action`, the CSV drop area is a card, PathSelector uses `input-group-text`, FlowUpload/wait use `bg-warning` with existing progress ARIA (wait additionally names the bar), LmLog uses a scoped spacing rule. `compat-bs5.css` retains their Ajenti appearance with scoped rules; no Bootstrap JS or state/payload/path/endpoint changes. Existing close/cancel buttons remain; no extra header close action.
`FileUpload`/`SmbUpload` inherit FlowUpload; `CodeEditor` already uses valid BS5 form-control and needs no source change. Header/body/footer, progress, form-control, lists and shared input-group bridges remain used by B5/C/B6. Remaining btn-default/input-group-addon/progress-bar-warning/form-group/btn-xs/pull-* consumers: coordination `logs/p154/remaining-consumers.txt`; do not remove their global rules before B5/C/D1. The archived well/theme rules are left for D1's complete theme audit.
Local real-Vue comparison against P152 final `4371b41d6`: file selection/save/error, editor/read-error, backups/diff, path (also customized focus), log, filesystem/SMB upload/progress/error and wait, including changed hover/focus states at 1440×900, 768×1024, 390×844. Server evidence is separately limited to P138 Globalsettings standard/tab-1 (PathSelector), DE/EN/four roles; P138 has no shared file-dialog states, and P152 has no Globalsettings pictures. No server-dialog measurement claimed.

P154 review CHAT 297: keyboard Space activation simultaneously matches `:active:focus-visible`; BS5 supplied an extra 2.5px light-button focus shadow. One additional real Chromium regression scene reproduces it at all three viewports (RED), and the variant token `.btn.common-file-button { --bs-btn-focus-box-shadow: none; }` restores pixel/style equality to P152 (GREEN). This state is absent from the approved E Globalsettings selection; E remains measured on the first commit.

CHAT 298 alignment: P153 uses the same BS5 token on `.auth-secondary`; P154 sets it on the common file-button variant. A global `.btn-default` rule cannot affect these renamed variants, while a global `.btn` token would also alter existing primary/contextual buttons. Keep the token scoped to each migrated neutral variant; D1 may consolidate neutral theme variants without changing contextual states.
## B3 / P153: Authentication
Auth renderers use BS5 `d-block w-100`, `position-relative`, `mb-3` (scoped original 30px spacing), and `btn-secondary` with Ajenti neutral colors/states. Eye feedback is positioned explicitly; the one-control TOTP group owns its shrink-wrap geometry. D04 alone permits wrapping on the reset-request submit button. Existing mismatch messages/disabled conditions and transport notifications remain the validation owners; there were no `has-error`/`input-group-addon`/`help-block` auth consumers, so no invented invalid border or validation is introduced. Login/Reset selectors, payloads and models are unchanged.
The auth-only color bridge moved from `compat-bs5.css` to Common auth SCSS. Shared feedback/form-group/input-group rules remain for Common/plugins through B4/B5/C12/D1; no global deletion while consumers remain.
Local proof: `node e2e/bs5-auth.local.mjs /ABS/LOG-DIR` renders actual before/after Vue components in DE/EN at 1440/768/390, verifies eyes/TOTP/cancel/mismatch and never sends reset mail.

P153 review R / CHAT 296: removed unreachable dropdown/fieldset/state-class selectors. The minimal auth-secondary rules sit next to Ajenti's original neutral variant (before btn-flat), with the same selector weight; this retains flat Cancel colors/backgrounds in normal/hover/focus/active states. A local real-component state comparison first failed with the end-of-SCSS override and passes after relocation; no behavior/payload change.
The A2 integrity test still requires all 715 original active rules unchanged and in order; exactly five named auth-secondary rules are accounted for separately. A1 evidence is unchanged.
The same actual-component test also holds Space with :active:focus-visible; Bootstrap secondary otherwise adds a 2.5px focus ring absent on the old default variant. The auth variant sets --bs-btn-focus-box-shadow:none (no new event/state owner); RED/green evidence is local only.
Disabled TOTP helper buttons retain the baseline inherited foreground/currentColor border and transparent background, rather than secondary's white foreground; the same browser state comparison covers this attribute state (RED before the scoped correction).

## P155 B5 — common/users
Six dialog templates use modal-title, scoped btn-light, cards/card-header/card-body, badges/bg-* and BS5 nav-item/nav-link active links; Vue owns parent-search show/active. Scripts and name/id/data-* attributes stay byte-identical to P154 da2f691f0; no bootstrap JS, endpoint/adapter/rights changes. No well/input-group-addon/has-error existed here; password validation stays notification-based, Check errors stay alert-danger (no invented invalid input state).
Dynamic inventory resolved explicitly in templates: UserDetails status label color → secondary(default)/primary/success/info/warning/danger bg-*; quotaDetails only produces success/warning/danger → badge and progress bg-* (share label, min/max/now retained/added); CheckResults sections info/warning/danger → common-user-card-info/warning/danger; attic warning → bg-danger. Original Ajenti panel borders/header colors, label padding/palette, form spacing, tab appearance and button focus token retained with scoped compat declarations. No Apply progress bar existed: existing working spinner and LmLog retained.
Shared legacy panel/label/form/nav/dropdown rules still serve plugins (C4/C6/C10/C11/C12 etc.) and remain until those packages/D1. No global rule removed on the strength of B5 alone. P138 only contains admin-add dialogs in lmn_users, no common/users details/password/check/apply/delete states; the latter require local fixtures only. No password/account/list action is allowed on E.

P155 review R1: common-user card/badge duplicate selectors consolidated without changing effective declarations. Badge padding is **0.4em 0.6em 0.3em** (Ajenti's later `.label` rule overrides the earlier 0.2em top padding), margin-right 3px; card body 15px. B5 rules share one scoped P137/removal-owner section annotation; the integrity check accepts grouped provenance only inside that section and only for common-user selectors. E2E detail groups use shared stable data-action/data-section selectors; Angular keeps its original panel locators.

## B6 / P156: Dashboard and stock pages
Dashboard tabs use nav-item/nav-link with Vue-owned active on the button; stock settings retain their inline button layout with active nav-link. Native widget-config dialogs and messagebox behavior are unchanged. Widgets already had their own header/value wrappers (no panels to replace); keep these masking anchors, switch xs columns to col-4/col-8 and warnings/session labels to scoped BS5 badge/bg-* variants. The transitional float grid remains until D1.
Stock fields retain valid BS5 form-control as the Ajenti focus/customization hook, add form-select with no new arrow, and replace form-group with the original 30px scoped spacing. Neutral buttons use btn-light and the same focus-shadow token as B3/B4; low selector weight before btn-flat preserves the existing flat/color theme cascade. Status/error alerts already use valid BS5 classes; static default buttons are ported. Stock Plugins B1 modal.show structure verified, no source/action changes; remaining plugin classes belong to C/D1.
The dedicated native dashboard button bridge is replaced by the scoped nav-link rule. Shared nav/list/form/label/button compatibility still has Common/plugin consumers; retain until their packages/D1. Local real-Vue fixtures compare merge 302 (984a0006c) at 1440/768/390 with tabs/widgets, configuration selects, button pointer/keyboard states, sessions, all settings tabs, denied routes and static/error pages. No backend, permission, endpoint or model changes.
P156 review R / CHAT 308–309: actual keyboard Tab traversal confirmed the direct Bootstrap `.nav-link:focus-visible` shadow on inactive StockSettings tabs and dashboard tabs, plus B2 desktop/mobile sidebar links against P151. The button focus-shadow token does not control nav-link's separate shadow. Two scoped focus rules remove only that measured shadow; the prior colors/borders/outline remain. Two built-CSS regression cases cover the tab families and sidebar separately. The local B6 fixture now exercises every dashboard/settings tab in normal/hover/focus/mouse-active/Space states at all three viewports. P152's navigation comparison explicitly blurred focus before screenshots, so it did not include the sidebar's keyboard-focused state. E remains measured on 588b3d4f4; only local focus correction afterward.
B1/B3/B4 introduced no nav-link/nav-item focus targets. Separate B5/P155 introduces nav-link in CheckResultsDialog.vue (Summary/Sections/Errors) without a shadow reset; code-only finding reported to coordinator, not changed by B6. Audit evidence: coordination logs/p156/nav-focus-audit.md.

## P160 / C4: Quotas, group membership and permissions
Quotas/Permissions tabs use nav-item/nav-link, with Vue active state on the link and an explicit focus-visible shadow reset. Quota and group search dropdowns use show/dropdown-item and selected state on the interactive link; existing option roles, mouse/keyboard handlers and aria attributes remain. Group panels become scoped c4-card danger/info cards; no well or progress color variants exist in C4. Neutral c4-button variants preserve flat/LMN priority and the B3/B4 focus token. Forms retain 768px Compat grid behavior; the actual quota clear icon is scoped rather than pretending to be validation. No has-error state exists here.
Dynamic inventory: Groupmembership class count label danger/default → explicit bg-danger/bg-secondary; project admin/member labels → bg-danger/bg-secondary. Permissions methodClass get/post/put/delete/patch/fallback → explicit bg-success/bg-primary/bg-info/bg-danger/bg-danger/bg-secondary map in the template; permission IDs → bg-secondary. No panel-${…}, label-${…} or progress-bar-${…} expressions remain in these templates. The btn-default substring in Groupmembership's translated legacy HTML key is deliberately unchanged and never rendered as HTML.
D02/D07/D14 changes are confined below 768px: toolbar actions wrap, membership tiles use one available-width column, permission tables scroll horizontally. Desktop/tablet geometry is retained. All seven script blocks, payloads, cancel and authorization logic remain byte-identical to 2ffbc6257.
No shared BS3 rule removed: panels, labels, floats, input-group-btn, fade.in, feedback and tab rules still have consumers in frontend/src and usr/**/resources outside C4; removal belongs to D1. fonts/rem base remains 10px; no Bootstrap JS introduced. Vue permissions.pw.mjs uses the new badge selector only after detecting .shell-content; the Angular .label-default branch is preserved.

C4 empty-ID evidence: real core-api methods without permission_id exposed the legacy `.badge:empty` priority conflict after migration; `.badge.c4-badge:empty` keeps the old hidden empty-label behavior. Local browser data now includes a method without permission_id; built-CSS RED→GREEN and repeated Permissions captures cover it.

## P157 C1: landing/common/links/nextcloud
`lmn_common/components/SchoolSwitcher.vue`, `lmn_links/components/Links.vue` and six landing cards now use `.card.c1-card/.card-header/.card-body`; scoped C1 CSS preserves Common SCSS's 20px body and dark header (including inline 50/55px school/link headers). Only `.c1-landing` becomes full width minus existing 10px margins below the BS3 768px breakpoint (P141 D03); desktop/tablet keep 46%.
`Landingpage.vue` resolves `progress-bar-${quota.type}` explicitly to `bg-success/bg-warning/bg-danger` (model emits only success/warning/danger, including ERROR→danger); RGB values preserve Ajenti colors. Warning labels and CustomFields list labels become scoped badges; neutral Links/CustomFields/WebappQR actions use `btn-light c1-button` with B3/B4 focus token. Floats become `float-end`. No tabs/new nav-link, wells, form-group, input-group-addon, has-error or open/in/active state classes in these SFCs. Wireguard and Nextcloud have zero legacy classes; Nextcloud iframe dimensions/negative margins remain byte-identical.
Shared `.panel*`, `.label*`, `.pull-right` and `.progress-bar-*` rules remain: searches in `frontend/src` and `usr/**/resources` still find other C packages/stock resources. Removal belongs to D1; no global rule removed. Script blocks, permission gates, payload/Cancel behavior and selector attributes remain unchanged.
F44: `frontend/e2e/lmn_common.pw.mjs` heading assertion detects the Vue shell (`.shell-content`) and selects `.card-header`; Angular continues to select `.panel-heading`. Static audit only, no E2E request against E.
