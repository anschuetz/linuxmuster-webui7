import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';
const admin = settings.roles.find(r => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const target = 'https://nextcloud.p53.invalid';
for (const role of roles) {
    test(`${role.name}: hidden sidebar, identity, iframe, layout, loading and errors`, async ({ page }) => {
        test.setTimeout(120_000);
        const errors = []; let authenticated = false;
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (m.type() === 'error' && !(!authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) errors.push({ text: m.text(), url: m.location().url }); });
        let data = [200, target, true, true], release;
        let delayed = false;
        const calls = [], destinations = [];
        await page.route('**/api/lmn/nextcloud', async route => {
            calls.push({ method: route.request().method(), body: route.request().postData() });
            if (delayed) await new Promise(resolve => { release = resolve; });
            await route.fulfill({ json: data });
        });
        await page.route(`${target}/**`, route => {
            destinations.push(route.request().url());
            return route.fulfill({ contentType: 'text/html', body: '<html lang="de"><body>P53 synthetische Nextcloud</body></html>' });
        });
        await page.goto('/');
        await page.locator('input[ng\\:model="username"]').fill(role.login);
        await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
        await page.locator('a[ng\\:click^="login"]').click();
        await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
        authenticated = true;
        // APIRequestContext bypasses page fixtures: verify the real absent-service
        // response and route access for every role before testing iframe fixtures.
        const real = await page.request.get('/api/lmn/nextcloud');
        expect(real.status()).toBe(200);
        expect(await real.json()).toEqual([0, null, null, null]);
        await expect(page.locator('a[href^="/view/lmn/nextcloud"]')).toHaveCount(0);
        const shell = () => page.evaluate(() => {
            const s = angular.element(document.documentElement).scope();
            return { wide: s.isWidescreen, navigation: s.showSidebar };
        });
        // Use Angular's real router: full-document reloads race the unrelated
        // Socket.IO polling connection on E (400/500 in diagnostic log).
        const route = (reload = false) => page.evaluate(reload => {
            const i = angular.element(document).injector();
            i.get('$rootScope').$evalAsync(() => reload ? i.get('$route').reload() : i.get('$location').path('/view/lmn/nextcloud'));
        }, reload);
        const before = await shell();
        await route();
        await expect(page).toHaveURL(/\/view\/lmn\/nextcloud$/);
        await expect(page.frameLocator('iframe[name="iframe_nextcloud"]').getByText('P53 synthetische Nextcloud')).toBeVisible();
        expect(destinations).toEqual([`${target}/index.php/login?user=${role.login}`]);
        const full = { wide: !before.wide, navigation: !before.navigation };
        await expect.poll(shell).toEqual(full);
        await expect(page.locator('body')).toHaveClass(new RegExp(`widescreen-mode-${full.wide ? 'on' : 'off'}`));
        await expect(page).toHaveTitle(/Nextcloud/);
        data = [200, target, false, false]; delayed = true;
        await route(true);
        await expect(page.locator('progress-spinner:visible, .nextcloud-spinner:visible')).toHaveCount(1);
        await expect.poll(() => typeof release).toBe('function');
        const loadingShell = await shell();
        release(); delayed = false;
        await expect(page.frameLocator('iframe[name="iframe_nextcloud"]').getByText('P53 synthetische Nextcloud')).toBeVisible();
        expect(destinations.at(-1)).toBe(`${target}/`);
        expect(await shell()).toEqual(loadingShell);
        for (const code of [0, 404]) {
            data = [code, null, null, null]; await route(true);
            const message = page.locator('.alert-info').filter({ hasText: /URL/ });
            await expect(message).toBeVisible();
            await expect(message).toContainText('Bitte');
            await expect(page.locator('iframe[name="iframe_nextcloud"]')).toBeHidden();
            await expect(page.locator('progress-spinner:visible, .nextcloud-spinner:visible')).toHaveCount(0);
        }
        expect(calls).toEqual(Array(4).fill({ method: 'GET', body: null }));
        expect(errors).toEqual([]);
    });
}
