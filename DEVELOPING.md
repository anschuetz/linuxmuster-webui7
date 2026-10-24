# Developing the Vue webui

For maintainers coming from the AngularJS frontend. Commands below assume the repository root on a
disposable linuxmuster.net server, with root privileges for server/package operations. Do not
develop against a production school. Put the checkout under a readable path such as `/srv/webui`;
all parents must be traversable by `nobody`. Under `/root` (0700), unauthenticated
Ajenti workers cannot read the Vue template and fall back to the old Core template.

## Prerequisites

Use Node **22.23.1**, exactly as pinned in `frontend/package.json`, with its npm. On the rehearsal's
Ubuntu x86-64 server, install the official distribution:
```sh
cd /tmp
curl -fLO https://nodejs.org/dist/v22.23.1/node-v22.23.1-linux-x64.tar.xz
curl -fLO https://nodejs.org/dist/v22.23.1/SHASUMS256.txt
grep ' node-v22.23.1-linux-x64.tar.xz$' SHASUMS256.txt | sha256sum -c -
tar -xJf node-v22.23.1-linux-x64.tar.xz -C /opt
export PATH=/opt/node-v22.23.1-linux-x64/bin:$PATH
node --version
npm --version
```
Return to the checkout. You need git, make, curl, rsync, xz and the Debian packaging tools:
```sh
apt-get update
apt-get install -y git debhelper fakeroot rsync curl xz-utils
```
Use an installed linuxmuster-webui7 server for its Python environment, system libraries,
configuration, Samba and linuxmuster-api. Python runs in the existing `/opt/linuxmuster` venv; do
not replace it with system Python or upgrade Ajenti.
`usr/lib/linuxmuster-webui/etc/requirements.txt` is authoritative: aj/panel 2.2.17, core 0.116, ace
0.32, dashboard 0.42, filesystem 0.51, plugins 0.55, settings 0.35, session-list 0.7. The package
installer provisions this environment.

## Where to edit

| Before | Now |
| --- | --- |
| AngularJS controller, CoffeeScript, HTML partial | `frontend/src/plugins/<plugin>/` Vue components and `entry.mjs` |
| Injected Angular services | `aj` from `frontend/src/adapter/aj.mjs` |
| Angular root/navigation | `frontend/src/shell/` |
| Shared directives/services | `frontend/src/common/` and the adapter |
| LESS styles | SCSS/CSS in Vue components and frontend styles |
Python handlers remain in `usr/lib/linuxmuster-webui/plugins/<plugin>/`; frontend changes do not
require rewriting that backend. Use `aj.http`, identity, gettext, dialogs and navigation rather than
direct backend/global shell access. The contract is `window.LmnVue_<plugin>.mount(element, aj)`,
returning an idempotent cleanup function. See
[lmn_common/README.md](usr/lib/linuxmuster-webui/plugins/lmn_common/README.md#vue-plugin-contract-ent10)
for resource URLs, routes and plugin-name normalization.

## Edit, test, build, commit

Install dependencies, then run the full suite from the root:
```sh
cd frontend && npm ci && npm test
```
Return to the repository root. `npm test` runs Vitest with coverage, builds all bundles, then checks
generated resources against the Git index. After changing source, its final check can fail until you
stage the rebuilt output:
```sh
make build
git add frontend/src usr/lib/linuxmuster-webui/plugins
node frontend/check-ajenti-bundles.mjs
cd frontend && npm test
```
Return to the root before other make targets. Review and commit source **and**
`usr/lib/linuxmuster-webui/plugins/*/resources/vue/` together, including common runtime, styles,
manifest and assets when changed. Staging alone is not a commit. `make build` uses npm/Vite; it does
not run the old Angular Multitool. `check-ajenti-bundles.mjs` verifies pinned vendor SHA256 values,
copied static assets, Angular-free plugin metadata, font paths and generated resources versus the
index. It does **not** rebuild source itself. Typical failures: `Changed pinned asset`, `Stale
static asset`, or `Vue assets differ from the index; rebuild and stage the generated resources.`
Check missing dependencies with npm ci and rebuild; do not hand-edit bundles or update pins to hide
errors.

## Start and package

Build first: neither start target watches or compiles Vue source. Stop the installed service before
binding its port, then start from the repository root:
```sh
systemctl stop linuxmuster-webui
make rundev
```
In a second terminal on that server:

```sh
curl --max-time 15 -k -L https://localhost/
```

Expect HTTP 200 with the `lmn-shell` HTML host. `-k` is for the test certificate. `make run` also
works without the legacy dev resource compilation attempt. Both targets enable **autologin**; keep
them confined to the test environment. `AJENTI_PANEL` is overrideable; its default uses
`/usr/local/bin/ajenti-panel` when present, otherwise `/opt/linuxmuster/bin/ajenti-panel` (the
current venv). `make rundev` may log `Resource compilation failed: please install
ajenti-dev-multitool.` from stock Core's legacy dev hook; Vue still requires an explicit `make
build` and page reload. Do not rely on that hook for Vue changes. Stop the foreground process with
Ctrl-C before starting another one.

```sh
make deb
```

This creates `../linuxmuster-webui7_<version>_all.deb`. Packaging uses prebuilt bundles under
`usr/`; it needs **no Node/npm** and does not compile translations.

## Example: show an existing link URL as a field


In `frontend/src/plugins/lmn_links/components/Links.test.mjs`, add this assertion inside the
existing `for (const [index, link] ...)` loop:
```js
expect(card.get('input.link-url').element.value).toBe(link.link);
```

```sh
cd frontend && npx vitest run src/plugins/lmn_links/components/Links.test.mjs
```

It must fail first. In the same directory's `Links.vue`, below the description's panel-body, add a
field bound to the existing backend `link.link` value:
```vue
<input class="form-control link-url" :aria-label="aj.gettext('Link URL')" :value="link.link" readonly>
```

Use a configured link permitted for your role. Autologin root has no school role; stop
the process and use `make rundevlogin` with a test administrator for this example.
Rerun the targeted test (green), then the build/stage/full-test cycle above. Reload
`/view/lmn/links`: permitted link cards show their URL in a readonly field. No backend schema or
write endpoint changes; the example is a local exercise, not a feature shipped by this documentation
change.

## Translations and verification limits


Use `aj.gettext` for visible strings. Existing catalogs are `locale/*/LC_MESSAGES/app.js` (JSON
despite the suffix); `.po` files are their translation sources. `make push-crowdin`, `make
add-crowdin` and `make pull-crowdin` still invoke Multitool. Its extractor misses Vue/.mjs sources
but scans generated plugin JS: xgettext extracted the example's `Link URL` from the rebuilt bundle.
Build first. Remote Crowdin operations were **not checked** (credentials/network writes). **Known
gap:** editing a `.po` then running `make build` leaves `app.js` stale. The previous `--msgfmt` step
is gone; Multitool 1.4.0 writes JSON `app.js`, not `.mo` (its native msgfmt call is commented out).
`pull-crowdin` still calls it, but needs separately installed legacy Multitool/gettext tools; not
checked here. The rehearsal package contains 966 JSON catalogs, zero `.mo`. Existing German
translations and DE/EN/DE switching passed through the real HTTP/locale adapters against rundev.
Browser language switching and the example display are **not checked**: native browser input
automation failed. The Vue login form was visible from the readable checkout. No pipeline fix is included.

Rehearsed on set F (Ubuntu 26.04.1/webui 7.4.13): full suite, build, example RED/GREEN,
HTTP 200 for run/rundev, package without Node/npm. `runprod` was dry-run checked only.
The example DOM value passed its test. All unmarked guide commands were executed.
