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

BS5 → legacy Glyphicons → selected BS3 structural compatibility → BS5 bridges
→ active Ajenti theme → Toaster/loadingbar, Ace, dashboard → sorted plugin SCSS.
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
explicit; their retention was required by P150. The three compatibility files total 172357 bytes, of which 67458 remain
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
