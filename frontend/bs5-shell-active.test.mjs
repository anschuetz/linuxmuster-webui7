// @vitest-environment node
import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
it('retains the measured P171 first-child active palette for profile and flat shell buttons', async () => {
    const css = await readFile('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', 'utf8');
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage(); await page.route('**/*', route => route.abort());
        for (const [classes, color] of [
            ['shell-profile-button profile-button', 'rgb(51, 51, 51)'],
            ['shell-profile-button profile-button superuser', 'rgb(255, 193, 7)'],
            ['shell-rest-button btn-flat', 'rgb(51, 51, 51)'],
        ]) {
            await page.setContent('<!doctype html><body class="customized"><nav class="navbar"><div><button class="btn btn-light ' + classes + '">Synthetic</button></div></nav></body>');
            await page.addStyleTag({ content: css });
            await page.locator('button').hover(); await page.mouse.down(); await page.waitForTimeout(250);
            expect(await page.locator('button').evaluate(el => {
                const style = getComputedStyle(el);
                return { active: el.matches(':first-child:active'), background: style.backgroundColor, color: style.color, shadow: style.boxShadow };
            }), classes).toEqual({ active: true, background: 'rgb(212, 212, 212)', color, shadow: 'none' });
            await page.mouse.up();
        }
    } finally { await browser.close(); }
}, 20000);
