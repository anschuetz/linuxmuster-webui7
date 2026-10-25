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
