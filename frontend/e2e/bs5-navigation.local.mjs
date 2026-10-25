// Offline real Vue navigation comparison; no VM, network or credentials.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2]; assert.ok(output, 'Pass a local log directory');
await mkdir(output, { recursive: true });
const reference = process.argv.includes('--reference') ? process.argv[process.argv.indexOf('--reference') + 1] : 'e86905b0f';
const previous = path => execFileSync('git', ['show', `${reference}:${path}`], { cwd: frontend, encoding: 'utf8' });
const css = { before: previous('usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'), after: await buildStyles(frontend) };
const auth = (await readFile(join(frontend, 'test-fixtures/bs5-auth.html'), 'utf8')).match(/<div class="container auth-page"[\s\S]*?<dialog/)[0].replace(/<dialog$/, '');
const entry = `import { createApp, h } from 'vue';
import { ShellNavigation } from 'fixture-navigation';
import { createNavigation } from '${frontend}/src/shell/navigation.mjs';
const options = window.fixtureOptions;
const aj = { identity: { user: options.auth ? null : 'fixture', isSuperuser: !options.regular, profile: { school_show: true, activeSchool: 'Standard-Schule' } },
    state: { pageTitle: 'Hauptseite' }, gettext: text => text === 'School Console' ? (options.long ? 'Schulkonsole mit einem langen Schulnamen' : 'Schulkonsole') : text,
    http: { get: async () => ({ data: { sidebar: { children: [{ name: 'Allgemein', children: [{ name: 'Hauptseite', url: '/view/lmn/landingpage', icon: 'fas fa-home', children: [] }] }] } } }) } };
const nav = createNavigation({ aj, storage: { isWidescreen: options.wide }, navigate: value => { window.lastRoute = value; }, logout: () => { window.loggedOut = true; },
    customization: { plugins: { core: { bodyClass: 'customized', logoURL: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="40"><rect width="100" height="40" fill="white"/></svg>' } } } });
if (options.auth) nav.routeChanged('/view/login/normal');
await nav.loadSidebar();
const app = createApp({ render: () => h(ShellNavigation, { nav, aj, identityDetails: { machine: { name: 'lmn-server' }, effective: 0 }, sessionState: { counter: ['01','00'] } },
    { default: () => options.auth ? h('div', { innerHTML: ${JSON.stringify(auth)} }) : h('div', [h('h2', 'Willkommen bei Linuxmuster.net'), h('div', { class: 'alert alert-info' }, 'Hinweis'), h('ul', { class: 'nav nav-tabs' }, [h('li', { class: 'active' }, [h('a', 'Allgemein')])]), h('div', { style: 'height:1400px' }, 'Seiteninhalt')]) }) });
app.mount(document.body); window.fixture = { nav, dispose: () => { app.unmount(); nav.dispose(); } };`;
const bundles = {};
for (const name of ['before', 'after']) {
    const result = await build({ root: frontend, configFile: false, logLevel: 'error', plugins: [{ name: 'fixture', resolveId(id) { if (id === 'fixture-entry' || id === 'fixture-navigation') return '\0' + id; },
        load(id) { if (id === '\0fixture-entry') return entry; if (id === '\0fixture-navigation') return name === 'before' ? previous('frontend/src/shell/navigation-components.mjs') : readFile(join(frontend, 'src/shell/navigation-components.mjs'), 'utf8'); } }],
        build: { write: false, target: 'esnext', minify: false, rolldownOptions: { input: 'fixture-entry', output: { format: 'es', inlineDynamicImports: true } } } });
    bundles[name] = result.output[0].code;
}
const browser = await chromium.launch({ headless: true, args: ['--disable-lcd-text', '--disable-gpu'] }), results = [];
try {
    for (const scene of (process.argv.includes('--active-only') ? ['profile-active','profile-user-active'] : process.argv.includes('--mobile-only') ? ['mobile'] : ['page', 'profile', 'profile-active', 'profile-user-active', 'mobile', 'long', 'login', 'wide', 'zoom200'])) {
        for (const width of scene === 'zoom200' ? [720] : [1440, 768, 576, 390]) {
            const shots = [], states = [];
            for (const name of ['before', 'after']) {
            const page = await browser.newPage({ viewport: { width, height: scene === 'zoom200' ? 450 : width === 390 ? 844 : width === 768 ? 1024 : 900 }, deviceScaleFactor: scene === 'zoom200' ? 2 : 1 });
            await page.route('**/*', route => route.abort());
                await page.setContent('<!doctype html><html><head></head><body></body></html>');
                await page.addStyleTag({ content: css[name] });
                await page.evaluate(options => { window.fixtureOptions = options; }, { auth: scene === 'login', wide: scene === 'wide', long: scene === 'long' || scene === 'login', regular: scene === 'profile-user-active' });
                await page.addScriptTag({ type: 'module', content: bundles[name] });
                await page.waitForFunction(() => document.querySelector('.shell-content'));
                await page.waitForTimeout(100);
                if (scene === 'profile') await page.locator('.profile-button').click();
                if (scene === 'mobile' && width < 992) await page.locator('.mobile-navigation').click();
                await page.waitForTimeout(350);
                // Common neutral pointer/focus for comparison; focus behavior is tested below.
                await page.evaluate(() => document.activeElement?.blur());
                await page.mouse.move(width - 1, 800);
                if(scene==='profile-active'||scene==='profile-user-active'){await page.locator('.profile-button').hover();await page.mouse.down();await page.waitForTimeout(350);}
                shots.push(await page.screenshot({ path: join(output, `${scene}-${width}-${name}.png`) }));
                states.push(await page.evaluate(() => {
                    const rect = selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, height: r.height, bottom: r.bottom } : null; };
                    const profile=document.querySelector('.profile-button'), appearance=profile?getComputedStyle(profile):null;
                    return { profile: appearance && {background:appearance.backgroundColor,color:appearance.color,border:appearance.borderColor}, navbar: rect('nav'), heading: rect('.shell-content h2'), auth: rect('.auth-page'), card: rect('.auth-card'),
                        offset: getComputedStyle(document.querySelector('.shell-content')).paddingTop,
                        sidebarOffset: getComputedStyle(document.querySelector('.overlay-sidebar')).paddingTop,
                        variable: getComputedStyle(document.documentElement).getPropertyValue('--shell-header-height').trim() };
                }));
                if (name === 'after') {
                    assert.equal(Number.parseFloat(states[1].offset), states[1].navbar.height);
                    assert.equal(Number.parseFloat(states[1].sidebarOffset), states[1].navbar.height);
                    if (states[1].heading) assert.ok(states[1].heading.y >= states[1].navbar.bottom);
                    if (states[1].auth) assert.equal(states[1].auth.height, (await page.evaluate(() => innerHeight)) - states[1].navbar.height);
                    if (scene === 'mobile' && width < 992) {
                        assert.equal(await page.locator('.navigation-backdrop').count(), 0);
                        await page.keyboard.press('Escape');
                        assert.equal(await page.evaluate(() => window.fixture.nav.layout.overlay), true);
                        // Real pointer hit on exposed content must activate it, as before B2.
                        await page.evaluate(() => {
                            const button = document.createElement('button'); button.id = 'outside-action'; button.textContent = 'Go';
                            button.style.cssText = 'position:fixed;right:0;top:300px;width:30px;z-index:90';
                            button.onclick = () => { window.contentAction = true; }; document.body.append(button);
                        });
                        await page.locator('#outside-action').click();
                        assert.equal(await page.evaluate(() => window.contentAction), true);
                        assert.equal(await page.evaluate(() => window.fixture.nav.layout.overlay), true);
                        await page.evaluate(() => { window.fixture.nav.routeChanged('/view/target'); document.querySelector('#outside-action').focus(); });
                        await page.waitForFunction(() => !window.fixture.nav.layout.overlay);
                        assert.equal(await page.locator('#outside-action').evaluate(el => el === document.activeElement), true);
                        await page.locator('.mobile-navigation').click();
                        assert.equal(await page.locator('.mobile-navigation').evaluate(el => el === document.activeElement), true);
                        await page.locator('.mobile-navigation').click();
                        assert.equal(await page.evaluate(() => window.fixture.nav.layout.overlay), false);
                    }
                    if (scene === 'long') {
                        await page.evaluate(() => window.scrollTo(0, 400));
                        assert.equal(await page.locator('nav').evaluate(el => el.getBoundingClientRect().top), 0);
                    }
                }
                await page.evaluate(() => { window.fixture.dispose(); delete window.fixture; });
                await page.close();
            }
            const identical = shots[0].equals(shots[1]);
            // Mandatory desktop/tablet comparison is exact. Narrow mobile renders
            // also record every changed pixel; no pixel tolerance hides a difference.
            let raster = null;
            if (!identical) {
                const comparison = await browser.newPage();
                raster = await comparison.evaluate(async images => {
                    const pixels = await Promise.all(images.map(async source => { const img = new Image(); img.src = source; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0); return ctx.getImageData(0, 0, c.width, c.height).data; }));
                    let count = 0, max = 0; for (let i = 0; i < pixels[0].length; i += 4) { let delta = 0; for (let j = 0; j < 3; j++) delta = Math.max(delta, Math.abs(pixels[0][i+j] - pixels[1][i+j])); if (delta) count++; max = Math.max(max, delta); }
                    return { pixels: count, maxChannelDelta: max };
                }, shots.map(b => 'data:image/png;base64,' + b.toString('base64')));
                await comparison.close();
            }
            results.push({ scene, width, identical, raster, before: states[0], after: states[1] });
            await writeFile(join(output, 'comparison.json'), JSON.stringify(results, null, 2) + '\n');
            if (reference.startsWith('1608abb13')) assert.deepEqual(states[1], states[0], 'Review removal must preserve all measured geometry');
            if ((states[1].navbar.height === 60 || reference.startsWith('1608abb13')) && width >= 768) assert.equal(identical, true, `Unexpected desktop/tablet pixel delta: ${scene} ${width}`);
        }
    }
} finally { await browser.close(); }
console.log(`${results.filter(r => r.identical).length}/${results.length} PNG pairs identical; wrapped offsets, auth height, original overlay/content-click/focus/Escape behavior and scrolling verified`);
