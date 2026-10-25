// Local real Vue auth comparison against B2. No VM, server, secrets or reset mail.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import vue from '@vitejs/plugin-vue';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2]; assert.ok(output, 'Pass local evidence directory');
await mkdir(output, { recursive: true });
const previous = path => execFileSync('git', ['show', `4371b41d6:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const logo = 'data:image/png;base64,' + (await readFile(join(frontend, '../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/img/logo-full.png'))).toString('base64');
const fixtureFont = '@font-face { font-family: FixtureAwesome; src: url(data:font/woff2;base64,' + (await readFile(join(frontend, '../docs/_static/fonts/fontawesome-webfont.woff2'))).toString('base64') + ') } .fa,.fas,.far { font-family: FixtureAwesome; font-style: normal; } .fa-eye:before { content: "\\f06e"; } .fa-eye-slash:before { content: "\\f070"; } .fa-lock:before { content: "\\f023"; } .fa-envelope:before { content: "\\f0e0"; }';
const entry = `import { createApp, h, reactive } from 'vue';
import { Login, PasswordReset, Totp } from 'fixture-auth';
import PasswordChange from 'fixture-password.vue';
const o = window.options, calls = [];
const translations = { 'Send instructions to reset password': 'Anweisungen zum Zurücksetzen des Passworts senden', 'Log in': 'Anmelden', 'Password': 'Passwort', 'Username': 'Benutzername' };
const gettext = text => o.lang === 'de' ? translations[text] || text : text;
const state = reactive({ mode: o.scene === 'sudo' ? 'sudo' : 'normal', username: '', password: '', showPWReset: true,
    verif_code: o.scene === 'login-totp', code: '', mail: '',
    ...(o.scene.startsWith('reset-') && o.scene !== 'reset-send' ? { serial: 'fixture', ready: true, serial_ok: o.scene !== 'reset-invalid', password1: o.scene === 'reset-mismatch' ? 'one' : '', password2: o.scene === 'reset-mismatch' ? 'two' : '' } : {}),
    totp: [], add_new: o.scene === 'totp-edit', tmp_totp: { description: '', secret: '' }, verified: false });
const model = { state, gettext, dispose() {}, login() { calls.push('login'); }, verify(code) { calls.push(['verify', code]); }, cancel() { calls.push('cancel'); },
    send() { throw Error('Reset mail prohibited'); }, save() { calls.push('save'); }, identity: { user: 'fixture' }, add() {}, remove() {}, valid: () => false, updateQr() {}, randomSecret() {} };
const component = o.scene === 'password-change' || o.scene === 'password-mismatch' ? PasswordChange : o.scene.startsWith('totp') ? Totp : o.scene.startsWith('reset') ? PasswordReset : Login;
const app = createApp({ render: () => h(component, component === PasswordChange ? {} : { model, customization: { plugins: { core: { bigLogoURL: ${JSON.stringify(logo)} } } } }) });
app.provide('aj', { gettext, pageTitle: { set() {} }, navigate() {}, http: { post() { throw Error('No HTTP in visual fixture'); } }, notify: { error() {}, success() {} } });
app.mount('#host'); window.fixture = { state, calls, dispose: () => app.unmount() };`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [
        { name: 'auth-fixture', resolveId(id) { if (id === './auth.mjs') return join(frontend, 'src/shell/auth.mjs'); if (['fixture-entry', 'fixture-auth', 'fixture-password.vue'].includes(id)) return join(frontend, id); },
            load(id) {
                if (id === join(frontend, 'fixture-entry')) return entry;
                const path = id === join(frontend, 'fixture-auth') ? 'frontend/src/shell/auth-components.mjs' : id === join(frontend, 'fixture-password.vue') ? 'frontend/src/plugins/lmn_auth/PasswordChange.vue' : null;
                return path ? (name === 'before' ? previous(path) : readFile(join(frontend, '..', path), 'utf8')) : null;
            } }, vue()],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', external: [], output: { format: 'es', codeSplitting: false } } } });
    bundles[name] = result.output[0].code;
}
const browser = await chromium.launch({ headless: true }), results = [];
try {
    for (const scene of ['login', 'login-eye', 'login-totp', 'sudo', 'reset-send', 'reset-valid', 'reset-invalid', 'reset-mismatch', 'password-change', 'password-mismatch', 'totp', 'totp-edit']) {
    for (const lang of ['de', 'en']) {
    for (const [width, height] of [[1440, 900], [768, 1024], [390, 844]]) {
        const shots = [], geometry = [];
        for (const name of ['before', 'after']) {
            const page = await browser.newPage({ viewport: { width, height } });
            await page.route('**/*', route => route.abort());
            await page.setContent('<!doctype html><html><head></head><body class="customized"><div style="height:60px"></div><div id="host"></div></body></html>');
            await page.addStyleTag({ content: css[name] + fixtureFont });
            await page.evaluate(options => { window.options = options; }, { scene, lang });
            await page.addScriptTag({ type: 'module', content: bundles[name] });
            await page.waitForFunction(() => window.fixture);
            await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode())); });
            await page.waitForTimeout(100);
            if (scene === 'login-eye') {
                await page.locator('[data-action=show-password]').click();
                assert.equal(await page.locator('[name=password]').getAttribute('type'), 'text');
                await page.locator('[data-action=show-password]').click();
                assert.equal(await page.locator('[name=password]').getAttribute('type'), 'password');
            }
            if (scene === 'password-mismatch') {
                await page.locator('input').nth(0).fill('old');
                await page.locator('input').nth(1).fill('one');
                await page.locator('input').nth(3).fill('two');
            }
            if (scene === 'password-change') {
                await page.locator('.fa-eye').click();
                assert.equal(await page.locator('input[type=text]').isVisible(), true);
                await page.locator('.fa-eye-slash').click();
                assert.equal(await page.locator('input[type=text]').isVisible(), false);
            }
            await page.evaluate(() => document.activeElement?.blur());
            await page.mouse.move(width - 1, height - 1);
            await page.waitForTimeout(400);
            geometry.push(await page.evaluate(() => {
                const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
                return { card: document.querySelector('.auth-card') ? rect(document.querySelector('.auth-card')) : null,
                    controls: [...document.querySelectorAll('input,button')].map(el => ({ ...rect(el), whiteSpace: getComputedStyle(el).whiteSpace, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth })) };
            }));
            shots.push(await page.screenshot({ path: join(output, `${scene}-${lang}-${width}-${name}.png`) }));
            if (name === 'after') {
                assert.equal(await page.locator('.form-group,.has-feedback,.form-control-feedback,.btn-default,.btn-block,.has-error,.is-invalid').count(), 0);
                if (scene === 'reset-send') {
                    const button = geometry[1].controls.at(-1);
                    assert.equal(button.whiteSpace, 'normal'); assert.ok(button.scrollWidth <= button.clientWidth);
                }
                if (scene === 'login-totp') {
                    await page.locator('[name=code]').fill('123456');
                    assert.deepEqual(await page.evaluate(() => window.fixture.calls), [['verify', '123456']]);
                    await page.locator('[data-action=cancel]').click();
                    assert.equal(await page.evaluate(() => window.fixture.calls.at(-1)), 'cancel');
                }
                assert.equal(await page.evaluate(() => window.fixture.calls.includes('save') || window.fixture.calls.includes('login')), false);
            }
            await page.close();
        }
        const identical = shots[0].equals(shots[1]);
        const expectedD04 = scene === 'reset-send' && lang === 'de' && width === 390;
        results.push({ scene, lang, width, identical, expectedD04, before: geometry[0], after: geometry[1] });
        await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
        assert.ok(identical || expectedD04, `Unexpected pixel delta: ${scene}/${lang}/${width}`);
    }
    }
    }
} finally { await browser.close(); }
console.log(`${results.filter(r => r.identical).length}/${results.length} PNG pairs identical; D04 and auth interactions verified`);
