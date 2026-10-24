import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

const admin = settings.roles.find(r => r.name === 'global-admin');
const roles = [admin, { name: 'school-admin', login: 'pgmadmin', pw: admin.pw }, settings.roles.find(r => r.name === 'teacher'), { name: 'student', login: 'serdarje', pw: admin.pw }];
const ssh = command => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
const row = (page, name) => page.locator(`[test-bind-item=${JSON.stringify(name)}]`).first();
const button = (page, text) => page.locator('.btn').filter({ hasText: text }).filter({ visible: true }).first();
const navigate = page => page.evaluate(() => {
    const i = angular.element(document).injector();
    i.get('$rootScope').$evalAsync(() => i.get('$location').path('/view/lmn/home'));
});
async function login(page, role, errors, expectedConsole = () => false) {
    let authenticated = false;
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
        if (m.type() === 'error' && !expectedConsole(m) && !(!authenticated && /401 \((Unauthorized|Unauthenticated)\)/.test(m.text()))) errors.push(m.text());
    });
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(role.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(role.pw);
    const auth = page.waitForResponse(response => response.url().endsWith('/api/core/auth') && response.request().method() === 'POST');
    await page.locator('a[ng\\:click^="login"]').click();
    expect((await auth).status()).toBe(200);
    await page.waitForURL(url => url.pathname.startsWith('/view/') && !url.pathname.startsWith('/view/login'));
    await page.evaluate(() => angular.element(document).injector().get('identity').promise.then(() => undefined));
    authenticated = true;
    // Test the German catalog shared by both implementations.
    await page.evaluate(() => angular.element(document).injector().get('locale').setLanguage('de'));
}
async function create(page, directory, name) {
    await button(page, directory ? /^(New directory|Neues Verzeichnis)$/ : /^(New file|Neue Datei)$/).click();
    const dialog = page.locator('dialog:visible').last();
    await dialog.locator('input').fill(` ${name} `);
    await dialog.locator('.btn').filter({ hasText: /^(Create|Erstellen)$/ }).click();
    await expect(row(page, name)).toBeVisible();
}
async function confirm(page, positive = true) {
    const dialog = page.locator('dialog.messagebox:visible').last();
    await expect(dialog).toBeVisible();
    await dialog.locator('.btn').filter({ hasText: positive ? /^(Delete|Löschen)$/ : /^(Cancel|Abbrechen)$/ }).click();
}
async function prompt(page, value) {
    const dialog = page.locator('dialog.messagebox:visible').last();
    await dialog.locator('input').fill(value);
    await dialog.locator('.btn').filter({ hasText: /^(OK|Ok)$/ }).click();
}

for (const role of roles) test(`${role.name}: real shares and home navigation`, async ({ page }) => {
    const errors = []; let missingExpected = false;
    await login(page, role, errors, message => missingExpected && message.location().url.includes('/api/lmn/smbclient/download?path='));
    const sharesResponse = page.waitForResponse(r => r.url().endsWith(`/api/lmn/smbclient/shares/${role.login}`));
    await navigate(page);
    const response = await sharesResponse;
    expect(response.status()).toBe(200);
    const shares = await response.json();
    console.log(`${role.name} shares: ${JSON.stringify(shares)}`);
    for (const share of shares.filter(s => s.name !== null)) await expect(page.locator('button.btn-lmn').filter({ hasText: share.name }).first()).toBeVisible();
    const home = shares.find(s => s.name === 'Home');
    expect(home).toBeTruthy();
    await expect(page).toHaveTitle(/Samba/);
    // Verify the actual list endpoint separately, retaining its E failure as evidence.
    const listing = await page.request.post('/api/lmn/smbclient/list', { data: { path: home.path } });
    console.log(`${role.name} list: ${listing.status()} ${(await listing.text()).slice(0, 400)}`);
    expect(listing.status()).toBe(200);
    const { items } = await listing.json();
    for (const item of items.slice(0, 4)) await expect(row(page, item.name)).toBeVisible();
    const directory = items.find(item => item.isDir && item.name !== '.upload');
    if (directory) {
        const loaded = page.waitForResponse(r => r.url().endsWith('/api/lmn/smbclient/list') && r.request().postDataJSON().path === directory.path);
        await row(page, directory.name).locator('a.list-group-main').click();
        expect((await loaded).status()).toBe(200);
        await expect(page.locator('.breadcrumb')).toContainText(directory.name);
        await page.locator('.breadcrumb a').first().click();
        await expect(row(page, directory.name)).toBeVisible();
    }
    // A synthetic list entry exercises the UI's real nonexistent-file request.
    const missingPath = `${home.path}/p88-does-not-exist.txt`;
    expect(items.some(item => item.name === 'p88-does-not-exist.txt')).toBe(false);
    await page.route('**/api/lmn/smbclient/list', route => route.fulfill({ json: { items: [{ name: 'p88-does-not-exist.txt', path: missingPath, download_url: Buffer.from(missingPath).toString('base64').replaceAll('+', '-').replaceAll('/', '_'), isFile: true, isDir: false, filetype: 'file', size: 0 }] } }));
    await page.evaluate(() => {
        const i = angular.element(document).injector();
        i.get('$rootScope').$evalAsync(() => i.get('$route').reload());
    });
    await expect(row(page, 'p88-does-not-exist.txt')).toBeVisible();
    const encoded = Buffer.from(missingPath).toString('base64').replaceAll('+', '-').replaceAll('/', '_');
    const realMissing = await page.request.get(`/api/lmn/smbclient/download?path=${encoded}`);
    const realHead = await page.request.head(`/api/lmn/smbclient/download?path=${encoded}`);
    expect(realHead.status()).toBe(200);
    expect(realMissing.status()).toBe(500);
    console.log(`${role.name} existing backend bug: nonexistent download HEAD=200, GET=500`);
    // E cannot produce the intended missing-file rejection: identical failure fixture for both UIs.
    await page.route('**/api/lmn/smbclient/download?**', route => route.fulfill({ status: 404, json: { message: 'P88 missing fixture' } }));
    missingExpected = true;
    const missingResponse = page.waitForResponse(r => r.url().includes('/api/lmn/smbclient/download?path='));
    await row(page, 'p88-does-not-exist.txt').locator('a:has(.fa-download)').click();
    const absent = await missingResponse;
    expect(absent.status()).toBeGreaterThanOrEqual(400);
    console.log(`${role.name} missing download: ${absent.request().method()} ${absent.status()}`);
    await expect(page.getByText('Datei nicht gefunden, möglicherweise aufgrund von Sonderzeichen im Dateinamen.', { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
});

test('teacher: real create, rename, clipboard, upload, base64 download and delete with SSH proof', async ({ page }) => {
    test.setTimeout(120000);
    const teacher = roles.find(r => r.name === 'teacher');
    expect(teacher.login).toBe('zem');
    const errors = [];
    await login(page, teacher, errors);
    const initial = page.waitForResponse(r => r.url().endsWith('/api/lmn/smbclient/list'));
    await navigate(page);
    expect((await initial).status()).toBe(200);
    await expect(button(page, /^(New file|Neue Datei)$/)).toBeVisible();
    await create(page, false, 'p88-original.txt');
    await create(page, true, 'p88-dir');
    await row(page, 'p88-original.txt').locator('a:has(.fa-pen)').click();
    await prompt(page, ' p88-renamed.txt ');
    await expect(row(page, 'p88-renamed.txt')).toBeVisible();
    expect(ssh("test -f /srv/samba/schools/default-school/teachers/zem/p88-renamed.txt && test ! -e /srv/samba/schools/default-school/teachers/zem/p88-original.txt && echo renamed").trim()).toBe('renamed');
    await row(page, 'p88-renamed.txt').locator('[checkbox], input[type=checkbox]').click();
    await button(page, /^(Copy|Kopieren)$/).click();
    await button(page, /^(Paste here|Hier einfügen)$/).click();
    await prompt(page, 'p88-copy.txt');
    await expect(row(page, 'p88-copy.txt')).toBeVisible();
    await row(page, 'p88-copy.txt').locator('[checkbox], input[type=checkbox]').click();
    await button(page, /^(Cut|Ausschneiden)$/).click();
    const folderLoaded = page.waitForResponse(r => r.url().endsWith('/api/lmn/smbclient/list') && r.request().postDataJSON().path.endsWith('/p88-dir'));
    await row(page, 'p88-dir').locator('a.list-group-main').click();
    expect((await folderLoaded).status()).toBe(200);
    await expect(row(page, 'p88-copy.txt')).toHaveCount(0);
    await button(page, /^(Paste here|Hier einfügen)$/).click();
    await expect(row(page, 'p88-copy.txt')).toBeVisible();
    expect(ssh("test -f /srv/samba/schools/default-school/teachers/zem/p88-dir/p88-copy.txt && test ! -e /srv/samba/schools/default-school/teachers/zem/p88-copy.txt && echo moved").trim()).toBe('moved');
    await row(page, 'p88-copy.txt').locator('a:has(.fa-trash)').click();
    await confirm(page, false);
    await expect(row(page, 'p88-copy.txt')).toBeVisible();
    await row(page, 'p88-copy.txt').locator('a:has(.fa-trash)').click();
    await confirm(page);
    await expect(row(page, 'p88-copy.txt')).toHaveCount(0);
    await page.locator('.breadcrumb a').first().click();
    await expect(row(page, 'p88-dir')).toBeVisible();
    // Existing backend races on parallel mkdir .upload; prepare staging sequentially.
    await page.evaluate(async () => {
        const i = angular.element(document).injector(), client = i.get('smbclient');
        const shares = await client.shares('zem'), home = shares.find(s => s.name === 'Home').path;
        const items = (await client.list(home)).items;
        if (!items.some(item => item.name === '.upload')) await client.createDirectory(`${home}/.upload`);
    });
    const content = 'P88 synthetischer Upload ä\n'.repeat(100000);
    const chunks = [];
    page.on('response', r => { if (r.url().includes('/smbclient/upload') && r.request().method() === 'POST') chunks.push(r.status()); });
    let releaseFirstChunk, held = false;
    // Hold one chunk's preflight so the other exposes a stable intermediate UI progress state.
    await page.route('**/api/lmn/smbclient/upload*', async route => {
        if (route.request().method() === 'GET' && !held) {
            held = true;
            await new Promise(resolve => { releaseFirstChunk = resolve; });
        }
        await route.continue();
    });
    await page.locator('input[type=file]').last().setInputFiles({ name: 'p88-upload.txt', mimeType: 'text/plain', buffer: Buffer.from(content) });
    try {
        await expect.poll(() => typeof releaseFirstChunk).toBe('function');
        const progress = page.locator('.uploads:visible');
        await expect(progress).toContainText('Wird hochgeladen');
        await expect(progress).toContainText(/\((?:[1-9]|[1-9][0-9]) %\)/);
        console.log(`Visible intermediate upload progress: ${await progress.innerText()}`);
    } finally { releaseFirstChunk?.(); }
    await expect(row(page, 'p88-upload.txt')).toBeVisible({ timeout: 60000 });
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256').update(content).digest('hex');
    expect(ssh('sha256sum /srv/samba/schools/default-school/teachers/zem/p88-upload.txt').split(' ')[0]).toBe(hash);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(code => code === 200)).toBe(true);
    const download = page.waitForEvent('download');
    await row(page, 'p88-upload.txt').locator('a:has(.fa-download)').click();
    const downloaded = await download;
    const stream = await downloaded.createReadStream();
    const data = []; for await (const chunk of stream) data.push(chunk);
    expect(createHash('sha256').update(Buffer.concat(data)).digest('hex')).toBe(hash);
    for (const name of ['p88-upload.txt', 'p88-renamed.txt', 'p88-dir']) {
        await row(page, name).locator('[checkbox], input[type=checkbox]').click();
    }
    await button(page, /^(Delete|Löschen)$/).click();
    await confirm(page);
    await expect.poll(() => ssh("if test ! -e /srv/samba/schools/default-school/teachers/zem/p88-upload.txt && test ! -e /srv/samba/schools/default-school/teachers/zem/p88-renamed.txt && test ! -e /srv/samba/schools/default-school/teachers/zem/p88-dir; then echo deleted; else echo waiting; fi").trim()).toBe('deleted');
    // Legacy bulk delete refreshes only after its last promise; refresh after SSH proves all completions.
    await page.locator('.breadcrumb a').first().click();
    for (const name of ['p88-upload.txt', 'p88-renamed.txt', 'p88-dir']) await expect(row(page, name)).toHaveCount(0);
    expect(ssh("test ! -e /srv/samba/schools/default-school/teachers/zem/p88-upload.txt && test ! -e /srv/samba/schools/default-school/teachers/zem/p88-renamed.txt && test ! -e /srv/samba/schools/default-school/teachers/zem/p88-dir && echo deleted").trim()).toBe('deleted');
    console.log(`SSH: renamed, copied/moved, uploaded SHA256=${hash}, ${chunks.length} chunks, deleted`);
    expect(errors).toEqual([]);
});

for (const role of roles) test(`${role.name}: identical synthetic sorting, protection and clipboard fixture`, async ({ page }) => {
    const errors = [], writes = [];
    const home = '//p88.invalid/home';
    const items = [
        { name: 'z.txt', path: `${home}/z.txt`, isFile: true, isDir: false, size: 2, filetype: 'text', download_url: btoa(`${home}/z.txt`) },
        ...['transfer', '.upload', 'Bdir'].map(name => ({ name, path: `${home}/${name}`, isDir: true, isFile: false })),
        { name: 'A.txt', path: `${home}/A.txt`, isFile: true, isDir: false, size: 1024, filetype: 'file', download_url: btoa(`${home}/A.txt`) },
    ];
    await page.route('**/api/lmn/smbclient/**', route => {
        const path = new URL(route.request().url()).pathname;
        if (path.includes('/shares/')) return route.fulfill({ json: [{ name: 'Home', path: home, icon: 'fa fa-home' }, { name: 'Other', path: '//p88.invalid/other', icon: 'fa fa-folder' }] });
        if (path.endsWith('/list')) return route.fulfill({ json: { items: route.request().postDataJSON().path.endsWith('/Bdir') ? [] : items } });
        writes.push({ path, data: route.request().postDataJSON() });
        return route.fulfill({ json: null }); // Never send fixture mutations to E.
    });
    await login(page, role, errors);
    // Model a browser that has already used the Angular clipboard before migration.
    await page.evaluate(() => {
        angular.element(document).injector().get('$localStorage').sambaSharesClipboard = [];
        localStorage.setItem('ngStorage-sambaSharesClipboard', '[]');
    });
    await navigate(page);
    await expect(row(page, 'A.txt')).toBeVisible();
    const names = await page.locator('.list-group-item .list-group-main').allTextContents();
    expect(names.map(name => name.trim().split(/\s+/)[0])).toEqual(['.upload', 'Bdir', 'transfer', 'A.txt', 'z.txt']);
    for (const name of ['transfer', '.upload']) {
        await expect(row(page, name).locator('a:has(.fa-trash), a:has(.fa-pen), [checkbox], input[type=checkbox]')).toHaveCount(0);
    }
    await row(page, 'Bdir').locator('a.list-group-main').click();
    await expect(row(page, 'A.txt')).toHaveCount(0);
    await expect(page.locator('.breadcrumb')).toContainText('Bdir');
    await page.locator('.breadcrumb a').first().click();
    await expect(row(page, 'A.txt')).toBeVisible();
    await row(page, 'A.txt').locator('[checkbox], input[type=checkbox]').click();
    await button(page, /^(Copy|Kopieren)$/).click();
    // A real shell preference update must not overwrite the clipboard from ngStorage's cache.
    const previousSidebar = await page.evaluate(() => localStorage.getItem('ngStorage-showSidebar'));
    await page.locator('a[ng\\:click="toggleNavigation()"]').click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('ngStorage-showSidebar'))).not.toBe(previousSidebar);
    // Persistent clipboard survives route destruction and recreation.
    await page.evaluate(() => {
        const i = angular.element(document).injector();
        i.get('$rootScope').$evalAsync(() => i.get('$route').reload());
    });
    await expect(row(page, 'A.txt')).toBeVisible();
    await expect(button(page, /^(Paste here|Hier einfügen)$/)).toBeVisible();
    await button(page, /^(Paste here|Hier einfügen)$/).click();
    await prompt(page, ' copied file.txt ');
    await expect(button(page, /^(Paste here|Hier einfügen)$/)).toBeHidden();
    expect(writes).toEqual([{ path: '/api/lmn/smbclient/copy', data: { src: `${home}/A.txt`, dst: `${home}/copied file.txt` } }]);
    expect(errors).toEqual([]);
});

test('root identity: denied Samba content and no shares request', async ({ page }) => {
    const errors = [], calls = [];
    await login(page, admin, errors);
    await page.route('**/api/lmn/smbclient/**', route => { calls.push(route.request().url()); return route.fulfill({ json: [] }); });
    await page.evaluate(() => {
        const i = angular.element(document).injector(), identity = i.get('identity');
        identity.user = 'root'; identity.profile = {};
        i.get('$rootScope').$digest();
    });
    await navigate(page);
    await expect(page.locator('.root-access-blocker')).toBeVisible();
    await expect(page.locator('.root-access-blocker')).toContainText('root');
    expect(calls).toEqual([]);
    expect(errors).toEqual([]);
});

test('teacher: delayed shares/list and failed navigation retain the legacy state', async ({ page }) => {
    const errors = []; let releaseShares, releaseList, failed = false;
    const home = '//p88.invalid/home';
    await page.route('**/api/lmn/smbclient/**', async route => {
        const path = new URL(route.request().url()).pathname;
        if (path.includes('/shares/')) {
            await new Promise(resolve => { releaseShares = resolve; });
            return route.fulfill({ json: [{ name: 'Home', path: home, icon: 'fa fa-home' }, { name: 'Other', path: '//p88.invalid/other', icon: 'fa fa-folder' }] });
        }
        if (path.endsWith('/list')) {
            if (failed) return route.fulfill({ status: 500, json: { message: 'P88 denied' } });
            await new Promise(resolve => { releaseList = resolve; });
            return route.fulfill({ json: { items: [{ name: 'p88-visible.txt', path: `${home}/p88-visible.txt`, isFile: true, isDir: false, filetype: 'file', size: 0 }] } });
        }
        throw new Error(`Unexpected fixture mutation: ${path}`);
    });
    await login(page, roles.find(r => r.name === 'teacher'), errors, message => failed && message.location().url.endsWith('/api/lmn/smbclient/list'));
    await navigate(page);
    const spinner = page.locator('progress-spinner:visible, .shares-spinner:visible');
    await expect(spinner).toHaveCount(1);
    await expect.poll(() => typeof releaseShares).toBe('function'); releaseShares();
    await expect.poll(() => typeof releaseList).toBe('function');
    await expect(spinner).toHaveCount(1);
    await expect(page.locator('[test-bind-item]')).toHaveCount(0);
    releaseList();
    await expect(row(page, 'p88-visible.txt')).toBeVisible(); await expect(spinner).toHaveCount(0);
    failed = true;
    await page.locator('button.btn-lmn').filter({ hasText: 'Other' }).click();
    await expect(page.getByText('P88 denied', { exact: true }).first()).toBeVisible();
    await expect(row(page, 'p88-visible.txt')).toBeVisible(); await expect(spinner).toHaveCount(0);
    expect(errors).toEqual([]);
});
