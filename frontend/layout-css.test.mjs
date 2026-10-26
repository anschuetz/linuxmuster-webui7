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
it('uses the BS5 flex row with explicit Ajenti gutters and no float/clearfix items', async () => {
    const page = await browser.newPage({ viewport: { width: 768, height: 900 } });
    try {
        await page.setContent(`<!doctype html><style>${css}</style><div class="row aj-theme-grid"><div class="aj-theme-half">One</div><div class="aj-theme-half">Two</div></div>`);
        const read = () => page.evaluate(() => {
            const row = document.querySelector('.aj-theme-grid'), child = row.firstElementChild;
            const s = getComputedStyle(row), c = getComputedStyle(child);
            return [s.display, s.alignItems, c.cssFloat, c.paddingLeft, getComputedStyle(row, '::before').content, child.getBoundingClientRect().width / row.getBoundingClientRect().width];
        });
        expect(await read()).toEqual(['flex', 'flex-start', 'none', '15px', 'none', 0.5]);
        await page.setViewportSize({ width: 767, height: 900 });
        expect((await read()).at(-1)).toBe(1);
        await page.evaluate(() => document.documentElement.style.setProperty('--aj-layout-gutter', '40px'));
        expect((await read())[3]).toBe('20px');
    } finally { await page.close(); }
});

it('keeps container widths at the existing 992/1200 transitions and exposes their theme tokens', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style><div class="container"></div>`);
        for (const [width, expected] of [[575,575],[576,576],[767,767],[768,768],[991,991],[992,970],[1199,970],[1200,1170],[1399,1170],[1400,1170]]) {
            await page.setViewportSize({ width, height: 900 });
            expect(await page.locator('.container').evaluate(el => el.getBoundingClientRect().width)).toBe(expected);
        }
        await page.evaluate(() => document.documentElement.style.setProperty('--aj-layout-container-large','1100px'));
        expect(await page.locator('.container').evaluate(el => el.getBoundingClientRect().width)).toBe(1100);
    } finally { await page.close(); }
});

it('keeps toolbar sidebar offsets separate from the responsive field-column spans', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style><div style="width:800px"><div class="row aj-theme-toolbar-layout"><div class="aj-theme-toolbar-offset"></div><div class="aj-theme-toolbar-main">Save</div></div></div></div>`);
        const geometry = () => page.locator('.aj-theme-toolbar-main').evaluate(el => {
            const a=el.getBoundingClientRect(), b=el.parentElement.getBoundingClientRect();
            return [a.width,b.width-a.width,a.y-b.y,getComputedStyle(el).cssFloat];
        });
        expect(await geometry()).toEqual([625,205,1,'none']);
        expect(await page.locator('.aj-theme-toolbar-offset').evaluate(el=>el.getBoundingClientRect().width)).toBe(207.5);
        await page.evaluate(() => document.documentElement.style.setProperty('--aj-layout-sidebar','220px'));
        expect(await geometry()).toEqual([610,220,1,'none']);
        await page.locator('.aj-theme-toolbar-main').evaluate(el => el.className='aj-theme-toolbar-full');
        expect(await page.locator('.aj-theme-toolbar-full').evaluate(el => el.getBoundingClientRect().width)).toBe(830);
    } finally { await page.close(); }
});

it('keeps the wide field-column break at 992 while widgets retain their permanent thirds', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style><div class="row aj-theme-grid"><div class="aj-theme-wide-quarter"></div><div class="aj-theme-wide-half"></div></div><div class="row aj-theme-grid"><div class="col-4 shell-widget-column"></div><div class="col-8 shell-widget-column"></div></div>`);
        const widths = () => page.locator('.aj-theme-grid > *').evaluateAll(els => els.map(el => el.getBoundingClientRect().width/el.parentElement.getBoundingClientRect().width));
        await page.setViewportSize({width:991,height:900});
        const narrow=await widths();expect(narrow.slice(0,2)).toEqual([1,1]);expect(narrow[2]).toBeCloseTo(1/3,4);expect(narrow[3]).toBeCloseTo(2/3,4);
        await page.setViewportSize({width:992,height:900});
        expect((await widths()).slice(0,2)).toEqual([0.25,0.5]);
    } finally { await page.close(); }
});

it('lets the existing mobile C12 toolbar wrap override the default toolbar flow', async () => {
    const page = await browser.newPage({viewport:{width:390,height:844}});
    try {
        await page.setContent(`<!doctype html><style>${css}</style><div class="bar aj-theme-toolbar c12-toolbar"><a class="btn btn-lmn">Save</a><a class="btn btn-lmn">Restart</a></div>`);
        expect(await page.locator('.bar').evaluate(el=>getComputedStyle(el).display)).toBe('flex');
    } finally { await page.close(); }
});

it('lets the shares loading indicator occupy its flow row without adding a top gap', async () => {
    const page = await browser.newPage();
    try {
        await page.setContent(`<!doctype html><style>${css}</style><div class="aj-theme-flow" style="width:600px"><progress-spinner class="shares-spinner aj-theme-shares-loading"><div><div class="one"></div><div class="two"></div></div></progress-spinner></div>`);
        expect(await page.locator('progress-spinner').evaluate(el=>{
            const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();
            return [r.width,r.y-parent.y,getComputedStyle(el).marginTop];
        })).toEqual([600,0,'0px']);
    } finally { await page.close(); }
});
