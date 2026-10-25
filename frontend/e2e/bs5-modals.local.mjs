// Offline CSS contract check, no server, credentials or VM. Run: node e2e/bs5-modals.local.mjs /LOG-DIR
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { build } from 'vite';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2];
assert.ok(output, 'Pass a local log directory');
await mkdir(output, { recursive: true });
const before = execFileSync('git', ['show', '6f4aea0bf:usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'], { cwd: frontend, encoding: 'utf8' });
const after = await buildStyles(frontend);
const shell = await readFile(new URL('../test-fixtures/bs5-compat.html', import.meta.url), 'utf8');
const auth = await readFile(new URL('../test-fixtures/bs5-auth.html', import.meta.url), 'utf8');
const native = shell.replace('<div class="modal fade in" style="display:block"', '<dialog open class="messagebox" data-check="messagebox"><div class="modal" style="display:block"').replace('</body>', '</dialog></body>');
const scenes = [['page', shell.slice(0, shell.indexOf('<!-- shell/modal.mjs')) + '</body></html>'], ['shell', shell], ['messagebox', native], ['login', auth], ['large-modal', shell.replace('class="modal-dialog"', 'class="modal-dialog modal-lg"')], ['small-modal', shell.replace('class="modal-dialog"', 'class="modal-dialog modal-sm"')]];
const properties = ['display', 'position', 'top', 'right', 'bottom', 'left', 'float', 'width', 'height', 'padding', 'margin', 'font-size', 'font-family', 'font-weight', 'line-height', 'color', 'background-color', 'border-width', 'border-color', 'border-radius', 'box-shadow', 'text-align', 'vertical-align', 'opacity', 'transform', 'z-index', 'overflow'];
const browser = await chromium.launch({ headless: true });
const differences = [];
try {
    const page = await browser.newPage();
    await page.route('**/*', route => route.abort());
    for (const [scene, html] of scenes) {
    for (const width of [1440, 768, 767, 576, 390]) {
        await page.setViewportSize({ width, height: 900 });
        const snapshots = [], screenshots = [];
        for (const [name, css] of [['before', before], ['after', after]]) {
            await page.setContent(name === 'after' ? html.replaceAll('fade in', 'fade show').replaceAll('class="modal"', 'class="modal show"').replaceAll('toast toast-', 'toast show toast-') : html);
            await page.addStyleTag({ content: css });
            // Let the existing modal transition settle without disabling production styles.
            await page.waitForTimeout(350);
            snapshots.push(await page.locator('[data-check]').evaluateAll((elements, props) => Object.fromEntries(elements.map(el => {
                const computed = getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return [el.dataset.check, { ...Object.fromEntries(props.map(p => [p, computed.getPropertyValue(p)])), x: rect.x, y: rect.y }];
            })), properties));
            screenshots.push(await page.screenshot({ path: join(output, `${scene}-${name}-${width}.png`), fullPage: true }));
        }
        if (!screenshots[0].equals(screenshots[1])) differences.push({ scene, width, element: 'screenshot', property: 'pixels', expected: 'byte-identical PNG', actual: 'different PNG' });
        for (const [element, styles] of Object.entries(snapshots[0])) {
            for (const [property, expected] of Object.entries(styles)) {
                const actual = snapshots[1][element][property];
                if (actual !== expected) differences.push({ scene, width, element, property, expected, actual });
            }
        }
    }
    }
    // Exercise the real Vue service in Chromium, without a server or VM.
    const bundle = await build({ configFile: false, logLevel: 'silent', define: { 'process.env.NODE_ENV': '"production"' }, build: { write: false,
        lib: { entry: join(frontend, 'test-fixtures/bs5-modal.mjs'), name: 'ModalFixtureBundle', formats: ['iife'] } } });
    await page.setContent('<button id="trigger">Open</button>');
    await page.addStyleTag({ content: after });
    await page.addScriptTag({ content: (Array.isArray(bundle) ? bundle[0] : bundle).output[0].code });
    await page.locator('#trigger').focus();
    await page.evaluate(() => { window.modalFixture.open({ backdrop: 'static', keyboard: false }); });
    assert.equal(await page.locator('.modal').evaluate(el => el === document.activeElement), true);
    await page.locator('.modal button').focus();
    await page.evaluate(() => { window.modalFixture.open({}); });
    assert.equal(await page.locator('.modal').last().evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('.modal').last().evaluate(el => {
        const backdrop = document.querySelectorAll('.modal-backdrop')[1];
        return Number(getComputedStyle(backdrop).zIndex) > Number(getComputedStyle(document.querySelector('.modal')).zIndex)
            && Number(getComputedStyle(el).zIndex) > Number(getComputedStyle(backdrop).zIndex);
    }), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelectorAll('.modal').length === 1);
    assert.equal(await page.locator('.modal button').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.body.classList.contains('modal-open')), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.modal').count(), 1);
    await page.locator('.modal button').click();
    await page.waitForFunction(() => !document.querySelector('.modal'));
    assert.equal(await page.locator('#trigger').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.evaluate(() => document.body.classList.contains('modal-open')), false);
} finally { await browser.close(); }
await writeFile(join(output, 'differences.json'), JSON.stringify(differences, null, 2) + '\n');
console.log(`${differences.length} style differences; evidence ${output}/differences.json`);
assert.equal(differences.length, 0, 'Legacy CSS contracts differ; inspect differences.json');
