# lmn73 VM smoke

Run from `frontend/`, separately from `npm test`:

1. `npm ci` and `npx playwright install chromium` (on the Mac only).
2. Open the existing SSH route in another terminal:
   `ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:18443:127.0.0.1:443 lmn-server`.
   The local `lmn-server` alias uses root via `lmn-laptop` → localhost:8022.
3. Copy `e2e/authconfig.json.sample` to the ignored `e2e/authconfig.json`
   and supply authorized synthetic global-admin and teacher credentials.
   Protect this local file with `chmod 600 e2e/authconfig.json`.
4. `npm run e2e`.

Alternatively supply `E2E_BASE_URL`, `E2E_ADMIN_LOGIN`, `E2E_ADMIN_PASSWORD`,
`E2E_TEACHER_LOGIN`, `E2E_TEACHER_PASSWORD` through the environment.
Each environment value overrides its local-file value. Missing values fail the
run; the two tests are never silently skipped. No real credentials belong in Git.

The smoke logs in, reads the landing page and logs out, once per role, serially
in fresh browser contexts. It changes no school data. HTTPS certificate checking
is disabled for this synthetic VM. Traces, screenshots and videos are disabled
to avoid saving authentication data. Never commit browser state or local secrets.

On 2026-10-23 the intended `lmn73Server 1` runs webui7 7.4.13 on 10.32.0.1:443,
but its AD has no global-admin or teacher. Two-role acceptance needs those
accounts supplied by the human first. Do not create users, change VM settings or
touch snapshots as part of this smoke.
