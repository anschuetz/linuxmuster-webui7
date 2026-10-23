import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// Synthetic configuration only; reset set E to E1-bereit after the run.
const configPath = '/etc/linuxmuster/webui/links/links_list.json';
const links = {
    admin: { title: 'P06 Admin', description: 'Admin description', icon: '/favicon.ico', link: 'https://example.org/admin', permissions: { 'globaladministrator': false } },
    teacher: { title: 'P06 Teacher', description: 'Teacher description', icon: '/favicon.ico', link: 'https://example.org/teacher', permissions: { teacher: true } },
    shared: { title: 'P06 Shared', description: 'Shared description', icon: '/favicon.ico', link: 'https://example.org/shared', permissions: { globaladministrator: true, teacher: false } },
    student: { title: 'P06 Student', description: 'Student description', icon: '/favicon.ico', link: 'https://example.org/student', permissions: { student: true } },
};
function configure(data) {
    execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', data === null
        ? `rm -f ${configPath}`
        : `mkdir -p /etc/linuxmuster/webui/links && cat > ${configPath}`], {
        input: data === null ? undefined : JSON.stringify(data), timeout: 30_000,
    });
}

for (const role of settings.roles) {
    test(`${role.name}: links direct route, role cards and empty states`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        const onConsole = (message) => { if (message.type() === 'error') errors.push(message.text()); };
        configure(null);
        const username = page.locator('input[ng\\:model="username"]');
        await page.goto('/');
        await username.fill(role.login);
        await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
        await page.locator('a[ng\\:click^="login"]').click();
        try {
            await expect(username).toBeHidden();
            await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
            // Existing unauthenticated 401 messages during login/logout are outside this view.
            page.on('console', onConsole);
            await expect(page.locator('a[href="/view/lmn/links"]')).toHaveCount(0);
            const openLinks = async () => {
                await page.goto('/view/lmn/links');
                await expect(page).toHaveTitle(/Links/);
            };
            await openLinks();
            const empty = page.locator('.alert-info').filter({ hasText: /Currently no links defined!|Derzeit keine Links definiert!/ });
            await expect(empty).toBeVisible();
            await page.route('**/api/lmn/links', (route) => route.fulfill({ json: { status: 'success', data: links } }));
            await openLinks();
            const visible = role.name === 'global-admin' ? [links.admin, links.shared] : [links.teacher, links.shared];
            const cards = page.locator('.info-cards');
            await expect(cards).toHaveCount(2);
            await expect(empty).toBeHidden();
            for (const link of visible) {
                const card = cards.filter({ hasText: link.title });
                await expect(card).toContainText(link.description);
                await expect(card.locator('img')).toHaveAttribute('src', link.icon);
                await expect(card.locator('a')).toHaveAttribute('href', link.link);
                await expect(card.locator('button')).toBeVisible();
            }
            await page.unroute('**/api/lmn/links');
            await page.route('**/api/lmn/links', (route) => route.fulfill({ json: { status: 'success', data: { student: links.student } } }));
            await openLinks();
            await expect(cards).toHaveCount(0);
            await expect(empty).toBeVisible();
        } finally {
            configure(null);
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

    test(`${role.name}: real backend returns HTTP 500 for existing configuration`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        configure(links);
        try {
            await page.goto('/');
            await page.locator('input[ng\\:model="username"]').fill(role.login);
            await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
            await page.locator('a[ng\\:click^="login"]').click();
            await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
            const response = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/lmn/links');
            await page.goto('/view/lmn/links');
            expect((await response).status()).toBe(500);
            await expect(page.locator('messagebox-container .modal')).toBeVisible();
            await expect(page.locator('.info-cards')).toHaveCount(0);
            expect(errors).toEqual([]);
        } finally {
            configure(null);
        }
    });
}
