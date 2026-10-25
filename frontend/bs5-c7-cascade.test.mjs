// @vitest-environment node
import { expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import { buildStyles } from './static-assets.mjs';
it('C7 built CSS keeps customized tabs dark with a user color and no redundant color overrides', async () => {
    const css = await buildStyles(process.cwd());
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.route('**/*', route => route.abort());
        await page.setContent('<body class="customized global-color-red"><ul class="nav nav-tabs c7-tabs"><li class="nav-item"><a class="nav-link active" href="#">Container</a></li></ul></body>');
        await page.addStyleTag({ content: css + '\n*,*::before,*::after { transition: none !important; animation: none !important; }' });
        const tab = page.locator('.nav-link.active');
        for (const state of ['normal', 'hover', 'focus']) {
            if (state === 'hover') await tab.hover();
            if (state === 'focus') await tab.focus();
            const actual = await tab.evaluate(el => {
                const style = getComputedStyle(el);
                return { color: style.color, border: style.borderBottomColor };
            });
            expect(actual, state).toEqual({ color: 'rgb(35, 60, 76)', border: 'rgb(35, 60, 76)' });
        }
    } finally { await browser.close(); }
    expect(/body\.global-color-[\w-]+ \.c7-tabs/.test(css)).toBe(false);
}, 30000);
