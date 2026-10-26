// @vitest-environment node
import { beforeAll, afterAll, expect, it } from 'vitest';
import { chromium } from '@playwright/test';
import { buildStyles } from './static-assets.mjs';
let browser, css;
beforeAll(async () => { css = await buildStyles(process.cwd()); browser = await chromium.launch(); });
afterAll(async () => { await browser?.close(); });
const markup = size => `<div class="modal fade show" style="display:block"><div class="modal-dialog ${size}"><div class="modal-content"><div class="modal-header"><button class="close">×</button><h4 class="modal-title">Title</h4></div><div class="modal-body">Body</div><div class="modal-footer"><button class="btn">Cancel</button><button class="btn">OK</button></div></div></div></div>`;
it('preserves modal size transitions and exposes adjustable Ajenti size and spacing tokens', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style>${markup('')}`);
        for (const width of [390,575,576,767,768,991,992,1199,1200,1440]) {
            await page.setViewportSize({width,height:900});
            for (const size of ['', 'modal-sm', 'modal-lg']) {
                await page.locator('.modal-dialog').evaluate((el,size) => el.className=`modal-dialog ${size}`,size);
                expect(await page.locator('.modal-dialog').evaluate(el => [el.getBoundingClientRect().width,getComputedStyle(el).marginTop])).toEqual([
                    width<768?width-20:size==='modal-sm'?300:size==='modal-lg'&&width>=992?900:600,width<768?'10px':'30px']);
            }
        }
        await page.evaluate(() => {
            document.documentElement.style.setProperty('--aj-modal-width-large','850px');
            document.documentElement.style.setProperty('--aj-modal-space-x','24px');
        });
        expect(await page.locator('.modal-dialog').evaluate(el=>el.getBoundingClientRect().width)).toBe(850);
        expect(await page.locator('.modal-body').evaluate(el=>getComputedStyle(el).paddingLeft)).toBe('24px');
    } finally { await page.close(); }
});
it('preserves open state, body lock, block content, footer spacing and backdrop tokens', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style><body class="modal-open"><div class="modal-backdrop fade show"></div>${markup('')}</body>`);
        await page.addStyleTag({content:'*,*::before,*::after { transition:none!important; }'});
        const read = selector => page.locator(selector).first().evaluate(el => {
            const s=getComputedStyle(el);return [s.display,s.opacity,s.overflowX,s.overflowY,s.transform,s.zIndex,s.marginLeft,s.borderRadius];
        });
        expect((await read('body')).slice(2,4)).toEqual(['hidden','hidden']);
        expect((await read('.modal')).slice(1,4)).toEqual(['1','hidden','auto']);
        expect((await read('.modal-dialog'))[4]).toBe('matrix(1, 0, 0, 1, 0, 0)');
        for (const selector of ['.modal-content','.modal-header','.modal-footer']) expect((await read(selector))[0]).toBe('block');
        expect((await read('.modal-footer'))[7]).toBe('0px');
        expect(await page.locator('.modal-title').evaluate(el=>[getComputedStyle(el).marginTop,getComputedStyle(el).lineHeight])).toEqual(['0px','25.7143px']);
        expect((await read('.modal-footer .btn + .btn'))[6]).toBe('5px');
        expect((await read('.modal-backdrop')).slice(1,2)).toEqual(['0.5']);
        await page.evaluate(()=>document.documentElement.style.setProperty('--aj-modal-backdrop-opacity','.4'));
        expect((await read('.modal-backdrop'))[1]).toBe('0.4');
    } finally { await page.close(); }
});
