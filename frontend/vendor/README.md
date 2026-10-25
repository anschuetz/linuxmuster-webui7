# Pinned static shell assets

Copied without JavaScript wrappers from the P106 release archives:
- ajenti.plugin.core 0.116: Bootstrap 3.3.7/Ajenti compiled CSS, Toaster/loadingbar CSS, Glyphicons fonts.
- ajenti.plugin.ace 0.32: Ace 1.4.1 minified distribution and editor CSS.
- ajenti.plugin.dashboard 0.42: dashboard CSS.
- ajenti.plugin.filesystem 0.51: standalone Flow.js 2.14.1.

`SHA256.json` records these exact inputs. Upstream license notices are retained;
Ajenti source is MIT (AJENTI-LICENSE, https://github.com/ajenti/ajenti/blob/master/LICENSE). Bootstrap/Ace/Flow and CSS licenses accompany
the assets. npm builds copy Ace/Flow and concatenate CSS. Retired Glyphicons fonts are
not copied or shipped. No Angular JavaScript is included. Stock packages stay
installed and unchanged; Fontawesome/PT Sans remain direct stock resources.

## P149: separate Bootstrap 3 and Ajenti theme inputs

`core.css` remains the unchanged 196,262-byte evidence copy, SHA-256
`f13d8b526cf033d5a5dfad31fef28b64393f25c5487a44f3d0585798e4bebeb8`.
The build now consumes these generated, project-owned inputs:

| Input (relative to frontend/) | Provenance / role |
| --- | --- |
| `vendor/bootstrap3.css` | Rules identical to npm Bootstrap **3.3.7**, MIT (`BOOTSTRAP-LICENSE`); includes its unchanged Glyphicons font-face/URLs. |
| `theme/ajenti.css` | Remaining rules from **ajenti.plugin.core 0.116**, Ajenti MIT (`AJENTI-LICENSE`), including modified Bootstrap/Normalize rules under their retained MIT notices. |
| `theme/core-order.json` | Generated ordering, original line ranges, source offsets and SHA-256 per segment; preserves mixed media blocks and the complete original cascade. |
| `theme/core-selectors.tsv`, `theme/core-audit.md` | Complete selector/context inventory, every interleaving boundary and every modified upstream rule with both declaration lists (A2 handover). |

The two CSS files are independently valid CSS. Segment wrappers keep media and
keyframe context valid in each file. A1's build takes only the recorded segment
bodies and reconstructs the original wrappers/comments/whitespace from the
manifest. **Do not simply concatenate the files**: original BS3/theme rules
interleave. Reconstruction is byte-identical to `core.css`; normal font URL
relocation and all other CSS inputs retain their original order. No Bootstrap 5
or additional CSS reset is active. A2 can consume the theme directly when it
replaces BS3 and supplies the required compatibility rules.

Reproduce from an external scratch directory (the package is reference-only;
it is never copied to the repository or the application bundle):

```sh
# In an empty /SCRATCH directory outside the repository:
npm pack bootstrap@3.3.7
tar -xzf bootstrap-3.3.7.tgz
# From frontend/:
node split-core-css.mjs /SCRATCH/package/dist/css/bootstrap.css
node split-core-css.mjs /SCRATCH/package/dist/css/bootstrap.css --check
node check-core-css.mjs
```

The generator pins the reference CSS SHA-256
`7e630d90c7234b0df1729f62b8f9e4bbfaf293d91a5a0ac46df25f2a6759e39a`.
Rule identity retains grouping context, the complete selector list and ordered
property/value/important declarations. It ignores comments, indentation and
selector comma spacing. Changed/mixed selector lists stay wholly in the theme;
mixed media queries are split at leaf-rule boundaries. Generated files must
never be hand-maintained. `check-core-css.mjs` verifies byte and normalized rule
equality for both the core reconstruction and the **complete** built styles.css;
`check-ajenti-bundles.mjs` also invokes it.

`SHA256.json` still pins every original input. New `../theme/…` entries are
relative to this vendor directory, just like the existing asset paths; they
pin the project-owned theme, manifest and extraction evidence too.

## P150: active Bootstrap 5 pipeline

Exactly pinned **bootstrap@5.3.8**, `dist/css/bootstrap.css`, copied unmodified
with `npm pack bootstrap@5.3.8` (npm release 2025-08-26, older than two weeks on
2026-10-25). MIT license: `BOOTSTRAP5-LICENSE`; exact CSS/license SHA-256:
`SHA256.json`. Release: https://blog.getbootstrap.com/2025/08/25/bootstrap-5-3-8/.
No Bootstrap JavaScript, Popper or jQuery is installed or bundled.

Active order: `bootstrap5.css` (the only reset, BS5 Reboot),
`core-vendor.css` (Toaster/loadingbar), `theme/compat-bs3.css`, `theme/compat-bs5.css`, `theme/ajenti-bs5.css`,
then Ace, dashboard and alphabetically sorted
plugin SCSS. The original A1 inputs above remain **evidence only**; neither
`core.css` nor `bootstrap3.css` nor `theme/ajenti.css` is bundled.
The A1 manifest still reconstructs the unchanged original for provenance checks.
`check-core-css.mjs` now checks archival equality and the active BS5 build separately.

`ajenti-bs5.css` retains the A1 theme after its initial Normalize/print prelude;
all remaining declarations stay unchanged except the eight dead global-color
tab rules removed after the P174 customized-state comparison. `theme/bs5-audit.md` and `theme/bs5-counterparts.tsv` record the A2
disposition of all 368 entries in `core-audit.md`. The temporary compatibility rules restore old DOM
contracts until B/C port those structures. The remaining compatibility rules retain their P137 evidence and removal owner.
P174 removes the unused Glyphicons mappings and all five fonts, including stale
incremental output. `bootstrap3.css`, `core.css` and `BOOTSTRAP-LICENSE` remain
archival reconstruction inputs; the license also covers the remaining BS3
compatibility declarations. They are not a second active Bootstrap pipeline. This is not a second reset or a full BS3 sheet:
carousel, tooltip, popover, jumbotron, media objects, pager/pagination,
navbar-inverse/form and justified-navigation support are not copied.
Font Awesome/v4-shims and PT Sans remain unchanged stock resources.


P174 freshness check: `check-built-resources.mjs` imports `check-core-css.mjs`,
which calls `verifyStyles()` from `check-styles.mjs`. It rebuilds all active CSS
and plugin SCSS inputs, then compares their SHA-256 with the generated
`styles.css`, independently of the Git index. The negative regression test
removes C11 button rules from a copy and requires rejection. The existing
`verifyShellBundle()` separately rebuilds and verifies the shell JavaScript.
