// @vitest-environment node
import { expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import { buildStyles } from './static-assets.mjs';

it('C13 built CSS preserves the pink background of both invalid holiday dates on focus', async () => {
    const css = await buildStyles(process.cwd());
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent('<body class="customized global-color-red"><table><tbody><tr><td class="c13-date-invalid"><input id="start" class="form-control" value="invalid"></td><td class="c13-date-invalid"><input id="end" class="form-control" value="invalid"></td></tr></tbody></table></body>');
        await page.addStyleTag({ content: css + '\n* { transition: none !important; }' });
        for (const field of ['start', 'end']) {
            const input = page.locator('#' + field);
            await input.focus();
            const actual = await input.evaluate(el => ({ focused: document.activeElement === el, background: getComputedStyle(el).backgroundColor }));
            expect(actual, field).toEqual({ focused: true, background: 'rgba(255, 178, 178, 0.29)' });
        }
    } finally { await browser.close(); }
}, 30000);
