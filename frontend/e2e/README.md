# VM set E smoke

Run from `frontend/`, separately from `npm test`:

1. `npm ci` and `npx playwright install chromium` (on the Mac only).
2. Reserve VM set E in the project `CHAT.md` and reset it with
   `tools/vm-reset-e.sh E1-bereit` from the migration project. Open its SSH tunnel:
   `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:8443:localhost:443 lmn-server-e`.
   Only `lmn-E-Server` and `lmn-E-OpnSense` are authorized; sets A–D must not
   be accessed, even read-only.
3. Copy `e2e/authconfig.json.sample` to the ignored `e2e/authconfig.json`
   and supply authorized synthetic global-admin and teacher credentials.
   Protect this local file with `chmod 600 e2e/authconfig.json`.
4. `npm run e2e`.
5. Stop the SSH tunnel and release VM set E in `CHAT.md`.

Alternatively supply `E2E_BASE_URL`, `E2E_ADMIN_LOGIN`, `E2E_ADMIN_PASSWORD`,
`E2E_TEACHER_LOGIN`, `E2E_TEACHER_PASSWORD` through the environment.
Each environment value overrides its local-file value. Missing values fail the
run; the two tests are never silently skipped. No real credentials belong in Git.

The smoke logs in, reads the landing page and logs out, once per role, serially
in fresh browser contexts. It changes no school data. HTTPS certificate checking
is disabled for this synthetic VM. Traces, screenshots and videos are disabled
to avoid saving authentication data. Never commit browser state or local secrets.

VM set E runs webui7 7.4.13 and has synthetic global-admin and teacher accounts.
Use the role accounts from the migration project's `notes/vm-zugang.md`; keep
credentials outside Git. Do not create users, change school data or create
snapshots as part of this smoke. The reset leaves both VMs at `E1-bereit`;
login and logout only affect the test sessions.

`e2e/shell.pw.mjs` compares the complete Angular and Vue entries on E. In addition
to the admin/teacher settings above, set `E2E_SCHOOL_LOGIN`,
`E2E_SCHOOL_PASSWORD`, `E2E_STUDENT_LOGIN`, and `E2E_STUDENT_PASSWORD` from the
migration project's authorized E accounts. Run this file explicitly with
`npx playwright test --config e2e/playwright.config.mjs e2e/shell.pw.mjs`.
The same API fixtures exercise both shells; only the separate real-session smoke
uses actual login/logout/session APIs. No fixture config/TOTP/school/package
write reaches the VM. The `/panel` cases simulate a reverse proxy in the browser
and leave the VM listener configuration unchanged.

## Offline D1c theme comparison

No VM or server is used by `bs5-d1c-compare.mjs`. From the repository root:

```
node frontend/e2e/bs5-d1c-compare.mjs BEFORE AFTER /absolute/evidence [c1 c2 c4 ...]
node frontend/e2e/bs5-d1c-inventory.mjs /absolute/evidence /absolute/inventory [corrected-evidence ...]
```

For grid migrations, prefix the comparison command with `D1C_GRID_BREAKPOINTS=1`
to add 575/576, 767, 991/992, 1199/1200 and 1399/1400 pixels to each selected
suite. The existing 768px case and navigation zoom cases remain; `shell-rest`
keeps its separate 21-pair contract. The manifest records the effective widths.
Both exports share three suite slots, with the large session group started first;
each fixture still renders both internal A/A variants without skipping assertions.

The runner exports both commits, reuses the real Vue local fixtures, and compares
PNG bytes across the exports. The 21 P174 shell renderer pairs always run;
without a suite filter all groups in `bs5-d1c-scenes.json` run. Both commit locks
must match the installed worker lock. Missing pairs, fixture errors and pixel
differences fail the run. `comparison.json` records refs and fixture hashes;
PNG pairs, selector observations and raw fixture logs remain in the output.
Selector observations show DOM reachability under active media/state conditions,
not cascade winners. Pseudo-elements are measured through their owning element.
Zero hits alone do not prove a rule dead. Inventory source paths are candidates.
Motion and carets are frozen identically for static snapshots. Animation timing
requires a separate behavioral check when a migration changes transitions.
The inventory targets the 643-rule P175 baseline; later evidence roots replace
only the corresponding suite probes, preserving raw comparison results.
