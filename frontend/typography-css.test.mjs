// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import { buildStyles } from './static-assets.mjs';
let browser, css;
beforeAll(async () => {
    css = await buildStyles(process.cwd());
    browser = await chromium.launch({ headless: true });
});
afterAll(async () => { await browser?.close(); });

const styles = async (html, tokens, selector, properties) => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style>${html}`);
        return await page.evaluate(({ tokens, selector, properties }) => {
            for (const [name, value] of Object.entries(tokens)) document.documentElement.style.setProperty(`--aj-type-${name}`, value);
            const style = getComputedStyle(document.querySelector(selector));
            return properties.map(prop => style.getPropertyValue(prop));
        }, { tokens, selector, properties });
    } finally { await page.close(); }
};

it('lets the Ajenti root token control the existing rem scale', async () => {
    expect(await styles('<div style="width:2rem"></div>', { root: '12px' }, 'div', ['width'])).toEqual(['24px']);
});
it('lets heading and small tokens control nested heading text', async () => {
    expect(await styles('<h1>Title<small>Subtitle</small></h1>', { h1: '40px', 'heading-small': '50%' }, 'small', ['font-size'])).toEqual(['20px']);
});
it('lets spacing and list tokens control description lists', async () => {
    expect(await styles('<dl><dt>Term</dt><dd>Description</dd></dl>', { 'section-space': '24px' }, 'dl', ['margin-bottom'])).toEqual(['24px']);
    expect(await styles('<dl><dt>Term</dt></dl>', { 'list-line': '2' }, 'dt', ['line-height'])).toEqual(['28px']);
});
it('uses Ajenti color tokens through BS5 important text and background utilities', async () => {
    expect(await styles('<a class="text-success">Link</a>', { 'success-rgb': '1, 2, 3' }, 'a', ['color'])).toEqual(['rgb(1, 2, 3)']);
    expect(await styles('<div class="bg-danger">Background</div>', { 'danger-bg-rgb': '4, 5, 6' }, 'div', ['background-color'])).toEqual(['rgb(4, 5, 6)']);
});
it('lets native label and check tokens control field spacing', async () => {
    expect(await styles('<label>Label</label>', { 'field-label-gap': '8px' }, 'label', ['margin-bottom'])).toEqual(['8px']);
    expect(await styles('<input type="checkbox">', { 'check-gap': '6px' }, 'input', ['margin-top'])).toEqual(['6px']);
});
it('lets the mono token control code independently of body text', async () => {
    expect(await styles('<pre><code>code</code></pre>', { mono: 'monospace' }, 'code', ['font-family'])).toEqual(['monospace']);
});
