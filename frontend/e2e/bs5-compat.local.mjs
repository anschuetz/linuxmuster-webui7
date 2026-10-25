// Offline CSS contract check, no server, credentials or VM. Run: node e2e/bs5-compat.local.mjs /LOG-DIR
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2];
assert.ok(output, 'Pass a local log directory');
await mkdir(output, { recursive: true });
const before = execFileSync('git', ['show', 'a176c2c0b:usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css'], { cwd: frontend, encoding: 'utf8' });
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
            await page.setContent(html);
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
} finally { await browser.close(); }
await writeFile(join(output, 'differences.json'), JSON.stringify(differences, null, 2) + '\n');
console.log(`${differences.length} style differences; evidence ${output}/differences.json`);
assert.equal(differences.length, 0, 'Legacy CSS contracts differ; inspect differences.json');
