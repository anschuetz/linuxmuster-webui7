import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

test('global-admin: Vue bridge mounts and destroys the demo (read-only)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const onConsole = (message) => {
        if (message.type() === 'error') errors.push(message.text());
    };
    const admin = settings.roles.find((role) => role.name === 'global-admin');
    const username = page.locator('input[ng\\:model="username"]');
    await page.goto('/');
    await username.fill(admin.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(admin.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    try {
        await expect(username).toBeHidden();
        await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
        // The existing login/logout flow requests protected APIs without a session (401).
        // Observe console errors throughout the authenticated bridge lifecycle.
        page.on('console', onConsole);
        expect(await page.evaluate(() => ({
            vue: typeof window.Vue?.createApp,
            bridge: typeof window.LmnVueBridge?.mountBridge,
            entry: typeof window.LmnVue_lmn_common?.mount,
        }))).toEqual({ vue: 'function', bridge: 'function', entry: 'function' });
        await page.evaluate(() => {
            const injector = angular.element(document.body).injector();
            const scope = injector.get('$rootScope').$new();
            const container = document.createElement('div');
            container.id = 'p09-bridge';
            document.body.append(container);
            window.p68BridgeDemo = window.LmnVue_lmn_common.demo;
            container.innerHTML = '<lmn-vue-mount entry="p68BridgeDemo"></lmn-vue-mount>';
            injector.get('$compile')(container)(scope);
            scope.$digest();
            window.p09BridgeCleanup = () => scope.$destroy();
        });
        const demo = page.locator('#p09-bridge lmn-vue-mount');
        await expect(demo.locator('h1')).toHaveText('Frontend ready');
        await expect(demo.locator('p')).toHaveText(admin.login);
        await expect(demo.locator('small')).toHaveText('Demo');
        await page.evaluate(() => window.p09BridgeCleanup());
        await expect(demo).toBeEmpty();
    } finally {
        await page.evaluate(() => {
            window.p09BridgeCleanup?.();
            delete window.p09BridgeCleanup;
            delete window.p68BridgeDemo;
            document.getElementById('p09-bridge')?.remove();
        });
        page.off('console', onConsole);
        const logout = page.locator('a[ng\\:click^="identity.logout"]');
        if (await logout.count()) {
            await page.locator('a[uib-dropdown-toggle]').click();
            await logout.click();
        }
    }
    await expect(username).toBeVisible();
    expect(errors).toEqual([]);
});
