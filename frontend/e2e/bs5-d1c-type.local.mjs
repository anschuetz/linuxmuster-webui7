// P176: all typography contracts, including unrendered legacy hooks and native states.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { buildStyles } from '../static-assets.mjs';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const output = process.argv[2];
assert.ok(output, 'Pass evidence directory');
await mkdir(output, { recursive: true });
const baseline = '0c459c49bf404d7fd45dd319765baa20df231b66';
const css = {
    before: execFileSync('git', ['show', `${baseline}:usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css`], { cwd: frontend, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }),
    after: await buildStyles(frontend),
};
const html = await readFile(join(frontend, 'test-fixtures/typography.html'), 'utf8');
const browser = await chromium.launch({ headless: true });
const results = [];
try {
    for (const width of [390, 767, 768, 1440]) {
        const pages = {};
        for (const side of ['before', 'after']) {
            const page = await browser.newPage({ viewport: { width, height: 1000 } });
            await page.route('**/*', route => route.abort());
            await page.setContent(`<!doctype html><html><head><style>${css[side]}</style></head><body>${html}</body></html>`);
            pages[side] = page;
        }
        const snapshot = page => page.evaluate(() => [...document.querySelectorAll('html, body, body *')].map(el => {
            const styles = pseudo => {
                const style = getComputedStyle(el, pseudo);
                const properties = ['font-family', 'font-size', 'font-weight', 'line-height', 'color', 'background-color', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'display', 'width', 'max-width', 'height', 'vertical-align', 'text-align', 'text-transform', 'text-shadow', 'white-space', 'list-style-type', 'list-style-position', 'border-radius', 'border-top-width', 'border-top-style', 'border-top-color', 'box-sizing', 'appearance', 'outline-style', 'outline-width', 'outline-color', 'outline-offset', 'cursor', 'content', '-webkit-tap-highlight-color'];
                return Object.fromEntries(properties.map(prop => [prop, style.getPropertyValue(prop)]));
            };
            return { tag: el.tagName, classes: el.className, styles: styles(null), before: styles('::before'), after: styles('::after') };
        }));
        const compare = async state => {
            const before = await snapshot(pages.before), after = await snapshot(pages.after);
            const differences = before.flatMap((el, i) => ['styles', 'before', 'after'].flatMap(part => Object.keys(el[part]).filter(prop => el[part][prop] !== after[i][part][prop]).map(prop => ({ i, tag: el.tag, classes: el.classes, part, prop, before: el[part][prop], after: after[i][part][prop] }))));
            results.push({ width, state, elements: before.length, differences });
        };
        await compare('normal');
        const targets = await pages.before.locator('a, input, button, textarea, select').count();
        for (let i = 0; i < targets; i++) {
            for (const page of Object.values(pages)) await page.locator('a, input, button, textarea, select').nth(i).focus();
            await compare(`focus-${i}`);
        }
        const links = await pages.before.locator('a').count();
        for (let i = 0; i < links; i++) {
            for (const page of Object.values(pages)) await page.locator('a').nth(i).hover();
            await compare(`hover-${i}`);
            for (const page of Object.values(pages)) await page.mouse.down();
            await compare(`active-${i}`);
            for (const page of Object.values(pages)) await page.mouse.up();
        }
        for (const page of Object.values(pages)) await page.close();
    }
    await writeFile(join(output, 'computed.json'), JSON.stringify({ baseline, chromium: browser.version(), results }, null, 2));
    const failures = results.filter(r => r.differences.length);
    console.log(`${results.length} typography states, ${failures.length} differing states`);
    assert.equal(failures.length, 0, 'See computed.json for every differing property');
} finally {
    await browser.close();
}
