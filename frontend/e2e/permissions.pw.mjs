import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

for (const role of settings.roles) {
    test(`${role.name}: permissions matrix and export contract`, async ({ page }) => {
        const errors = [];
        const consoleErrors = [];
        let loggedIn = false;
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', m => {
            if (m.type() !== 'error') return;
            const path = new URL(m.location().url || '/', settings.baseURL).pathname;
            // Core polls before login; the teacher's denied permissions GET is asserted below.
            if (!loggedIn && ['/api/core/sidebar', '/api/core/tasks/request-update'].includes(path)
                && m.text() === 'Failed to load resource: the server responded with a status of 401 (Unauthenticated)') return;
            if (role.name === 'teacher' && path === '/api/lmn/permissions'
                && m.text() === 'Failed to load resource: the server responded with a status of 403 (Forbidden)') return;
            consoleErrors.push(m.text());
        });
        await page.goto('/');
        await page.locator('input[ng\\:model="username"]').fill(role.login);
        await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
        await page.locator('a[ng\\:click^="login"]').click();
        await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
        loggedIn = true;
        const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/lmn/permissions');
        await page.goto('/view/permissions');
        const loaded = await response;
        if (role.name === 'teacher') {
            expect(loaded.status()).toBe(403);
            await expect(page.locator('table td .fa-check')).toHaveCount(0);
            expect(errors).toEqual([]);
            expect(consoleErrors).toEqual([]);
            return;
        }
        expect(loaded.status()).toBe(200);
        const [plugins, api, sidebar] = await loaded.json();
        await expect(page).toHaveTitle(/List all permissions|Liste aller Berechtigungen/);
        await expect(page.getByRole('link', { name: 'Plugins', exact: true })).toBeVisible();
        const filter = page.getByPlaceholder('Filter per plugin name or per role');
        await filter.fill('lmn_settings');
        const table = page.locator('#table_lmn_settings');
        await expect(table).toBeVisible();
        await expect(table.locator('th')).toHaveCount(6);
        await expect(table.locator('th').last()).toHaveText(/Def\.|Std\./);
        const row = table.locator('tr').filter({ has: page.locator('.label-default', { hasText: /^lm:schoolsettings$/ }) }).first();
        await expect(row).toBeVisible();
        const cell = row.locator('td').nth(4);
        const initial = api['lm:schoolsettings'].student;
        const states = [undefined, 'false', 'true'];
        const changed = states[(states.indexOf(initial) + 1) % 3];
        // Cycle through every editable state before the one-change export.
        const icon = value => value === undefined ? 'question' : value === 'true' || value === true ? 'check' : 'times';
        let state = initial;
        for (let i = 0; i < 3; i++) {
            state = states[(states.indexOf(state) + 1) % 3];
            await cell.click();
            await expect(cell.locator('i')).toHaveClass(new RegExp(`fa-${icon(state)}`));
        }
        await expect(row.locator('td').nth(5).locator('i')).toHaveClass(/fa-times/);
        await cell.click();
        const reloaded = page.waitForResponse(r => new URL(r.url()).pathname === '/api/lmn/permissions');
        await page.reload();
        expect((await reloaded).status()).toBe(200);
        await filter.fill('lmn_settings');
        await expect(cell.locator('i')).toHaveClass(new RegExp(`fa-${icon(initial)}`));
        await cell.click();
        const exportResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/lmn/permissions/export');
        await page.getByRole('button', { name: /Export permissions file|Berechtigungsdatei exportieren/ }).click();
        const exported = await exportResponse;
        expect(exported.status()).toBe(200);
        const payload = exported.request().postDataJSON();
        expect(payload.pluginDict).toEqual(plugins);
        expect(payload.sidebar).toEqual(sidebar);
        const expected = structuredClone(api);
        if (changed === undefined) delete expected['lm:schoolsettings'].student;
        else expected['lm:schoolsettings'].student = changed;
        expect(payload.api).toEqual(expected);
        const written = execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', "cat /usr/lib/linuxmuster-webui/plugins/lmn_settings/permissions.yml"], { encoding: 'utf8', timeout: 30_000 });
        if (changed === undefined) expect(written.match(/student:[\s\S]*?(?=^\w|$)/m)?.[0] ?? '').not.toContain('lm:schoolsettings:');
        else expect(written).toMatch(new RegExp(`student:[\\s\\S]*?lm:schoolsettings: ${changed}`));
        await page.getByRole('link', { name: 'Sidebar', exact: true }).click();
        await page.getByPlaceholder('Filter per URL or per role').fill('/view/');
        await expect(page.locator('table:visible tr')).not.toHaveCount(1);
        const sidebarTable = page.locator('table:visible');
        await sidebarTable.locator('th').nth(3).click();
        await expect(page.getByPlaceholder('Filter per URL or per role')).toHaveValue('teacher');
        for (const row of await sidebarTable.locator('tr').all()) {
            if (await row.locator('td').count()) await expect(row.locator('td').nth(3).locator('i')).toHaveClass(/fa-check/);
        }
        await page.getByRole('link', { name: 'Orphan', exact: true }).click();
        await expect(page.getByRole('heading', { name: /Sidebar|Seitenleiste/ })).toBeVisible();
        expect(errors).toEqual([]);
        expect(consoleErrors).toEqual([]);
    });
}
