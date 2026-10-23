import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

for (const role of settings.roles) {
    test(`${role.name}: login, landing page, logout (read-only)`, async ({ page }) => {
        const username = page.locator('input[ng\\:model="username"]');
        await page.goto('/');
        await username.fill(role.login);
        await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
        await page.locator('a[ng\\:click^="login"]').click();
        // Same landing-page contract as tests/e2e/{global-admin,teacher}.js.
        try {
            await expect(username).toBeHidden();
            await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
        } finally {
            const logout = page.locator('a[ng\\:click^="identity.logout"]');
            if (await logout.count()) {
                await page.locator('a[uib-dropdown-toggle]').click();
                await logout.click();
            }
        }
        await expect(username).toBeVisible();
    });
}
