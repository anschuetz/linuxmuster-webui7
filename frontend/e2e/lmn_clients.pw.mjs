import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

// The same oracle runs against Angular and Vue, on reserved set E only.
const ssh = (command, input) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { input, encoding: 'utf8', timeout: 30_000 });
const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
const scriptsUrl = '/api/lmn/clients/scripts';
const drivesUrl = '/api/lmn/samba/drives';
const admin = settings.roles.find((role) => role.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }];
const tab = (page, name) => page.locator('.nav-tabs').getByText(name, { exact: true });
const button = (page, name) => page.locator('.modal:visible').getByText(name, { exact: true });
const response = (page, url, method = 'GET') => page.waitForResponse((r) => new URL(r.url()).pathname === url && r.request().method() === method);
function listen(page, denied = false) {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() !== 'error') return;
        const { url } = message.location();
        // Login probes are rejected before authentication; role denial is deliberate.
        if (message.text().includes('401') && /\/api\/core\//.test(url)) return;
        if (denied && message.text().includes('403') && [scriptsUrl, drivesUrl].some((path) => url.endsWith(path))) return;
        errors.push(message.text());
    });
    return errors;
}
async function login(page, role) {
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type="password"][ng\\:model="password"]').fill(role.pw);
    await page.locator('a[ng\\:click^="login"]').click();
    await expect(page.locator('h2').filter({ hasText: /Linuxmuster\.net/i }).first()).toBeVisible();
}
async function open(page) {
    const loaded = response(page, scriptsUrl);
    await page.goto('/view/lmn_clients');
    const result = await loaded;
    expect(result.status()).toBe(200);
    await expect(page.locator('.nav-tabs > li > a')).toHaveText(['Benutzerdefinierte Skripte', 'Laufwerke']);
    await expect(page.locator('.list-group-item')).toHaveCount(8);
    // Original app.js truncates this multiline gettext key; preserve its English fallback.
    await expect(page.locator('.alert-info')).toContainText('The following scripts are executed by Samba');
    return result.json();
}
async function edit(page, name) {
    await page.locator('.list-group-item').filter({ hasText: name }).getByRole('button').click();
    await expect(page.locator('.modal:visible')).toContainText('Benutzerdefiniertes Skript bearbeiten');
    await expect(page.locator('.modal:visible .ace_editor')).toBeVisible();
}
const editorValue = (page) => page.locator('.modal:visible .ace_editor').evaluate((host) => window.ace.edit(host).getValue());
const setEditor = (page, value) => page.locator('.modal:visible .ace_editor').evaluate((host, content) => window.ace.edit(host).setValue(content, -1), value);

for (const role of roles) {
    test(`${role.name}: eight scripts, close retains edits, exact save and drive persistence`, async ({ page }) => {
        test.setTimeout(120_000);
        const errors = listen(page);
        await login(page, role);
        await expect(page.locator('a[href^="/view/lmn_clients"]').first()).toBeVisible();
        const initial = await open(page);
        expect(initial.linux.map((s) => s.name)).toEqual(['sessionstart.sh', 'logon.sh', 'sysstart.sh', 'sysstop.sh']);
        expect(initial.windows.map((s) => s.name)).toEqual(['logoff.bat', 'logon.bat', 'sysstart.bat', 'sysstop.bat']);
        const script = initial.linux[1];
        const readScript = () => ssh(`cat -- ${quote(script.path)}`);
        const original = readScript();
        const posts = [];
        page.on('request', (r) => { if (r.method() === 'POST' && new URL(r.url()).pathname === scriptsUrl) posts.push(r.postDataJSON()); });
        const synthetic = '\n# P33 synthetic; preserve whitespace\n  # inert\n\n';
        let driveFile;
        let driveOriginal;
        try {
            await edit(page, script.name);
            expect(await editorValue(page)).toBe(script.content);
            await setEditor(page, synthetic);
            await button(page, /^(Close|Schließen)$/).click();
            expect(posts).toEqual([]);
            expect(readScript()).toBe(original);
            await edit(page, script.name);
            expect(await editorValue(page)).toBe(synthetic);
            const saved = response(page, scriptsUrl, 'POST');
            await button(page, /^(Save|Speichern)$/).click();
            expect((await saved).status()).toBe(200);
            await expect(page.locator('.modal:visible')).toHaveCount(0);
            expect(posts).toEqual([{ path: script.path, content: synthetic }]);
            expect(readScript()).toBe(synthetic);
            expect((await open(page)).linux[1].content).toBe(synthetic);
            const loaded = response(page, drivesUrl);
            await tab(page, /^(Drives|Laufwerke)$/).click();
            const driveResponse = await loaded;
            expect(driveResponse.status()).toBe(200);
            const [drives, letters] = await driveResponse.json();
            // A real GPO must be present on E; missing backend support is documented before using fixtures.
            expect(drives.length).toBeGreaterThan(0);
            const files = ssh("find /var/lib/samba/sysvol -name Drives.xml").trim().split('\n');
            expect(files).toHaveLength(1);
            driveFile = files[0];
            driveOriginal = ssh(`cat -- ${quote(driveFile)}`);
            const row = page.locator('table tr').nth(1);
            await expect(row).toContainText(drives[0].properties.label);
            const next = letters.find((l) => !l.active).letter;
            const expectedOptions = letters.filter((l) => !l.active || l.letter === drives[0].properties.letter).map((l) => l.letter);
            await expect(row.locator('select option')).toHaveText(expectedOptions);
            await row.locator('select').selectOption(next);
            await row.locator('[checkbox]').nth(0).click();
            await row.locator('[checkbox]').nth(1).click();
            const expected = drives.map((drive, index) => index ? drive : { ...drive, disabled: !drive.disabled, properties: { ...drive.properties, useLetter: !drive.properties.useLetter, letter: next } });
            const written = response(page, drivesUrl, 'POST');
            await page.locator('floating-toolbar').getByText(/^(Save|Speichern)$/, { exact: true }).click();
            const result = await written;
            expect(result.status()).toBe(200);
            expect(result.request().postDataJSON()).toEqual({ drives: expected });
            const xml = ssh(`cat -- ${quote(driveFile)}`);
            expect(xml).toContain(`letter="${next}"`);
            expect(xml).toContain(`useLetter="${expected[0].properties.useLetter ? '1' : '0'}"`);
            await open(page);
            const reloaded = response(page, drivesUrl);
            await tab(page, /^(Drives|Laufwerke)$/).click();
            expect((await reloaded).status()).toBe(200);
            expect((await (await page.request.get(drivesUrl)).json())[0]).toEqual(expected.map((d, i) => i ? d : { ...d, letter: next, userLetter: d.properties.useLetter }));
            await expect(page.locator('table tr').nth(1).locator('select')).toHaveValue(next);
            expect(errors).toEqual([]);
        } finally {
            ssh(`cat > ${quote(script.path)}`, original);
            expect(readScript()).toBe(original);
            if (driveFile) {
                ssh(`cat > ${quote(driveFile)}`, driveOriginal);
                expect(ssh(`cat -- ${quote(driveFile)}`)).toBe(driveOriginal);
            }
        }
    });
}

for (const role of [settings.roles.find((r) => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }]) {
    test(`${role.name}: sidebar absent and scripts/drives API denied`, async ({ page }) => {
        const errors = listen(page, true);
        await login(page, role);
        await expect(page.locator('a[href^="/view/lmn_clients"]')).toHaveCount(0);
        const loaded = response(page, scriptsUrl);
        await page.goto('/view/lmn_clients');
        expect((await loaded).status()).toBe(403);
        for (const path of [scriptsUrl, drivesUrl]) expect((await page.request.get(path)).status()).toBe(403);
        await expect(page.locator('.list-group-item')).toHaveCount(0);
        expect(errors).toEqual([]);
    });
}
