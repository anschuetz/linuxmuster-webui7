import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { expect, test } from '@playwright/test';
import { settings } from './playwright.config.mjs';

const require = createRequire(import.meta.url);
const teacher = settings.roles.find((role) => role.name === 'teacher');
const ssh = (command) => execFileSync('ssh', ['-o', 'BatchMode=yes', 'lmn-server-e', command], { encoding: 'utf8', timeout: 30000 });
// Only synthetic account zem is allowed for the writable/SSH fixture.
const filename = 'p64-synthetic.txt';
const content = 'P64 synthetic upload/download ä\n'.repeat(50000); // crosses the 1 MiB chunk boundary
let bundle;
test.beforeAll(async () => {
    const output = await build({
        configFile: fileURLToPath(new URL('../vite.config.mjs', import.meta.url)),
        logLevel: 'error',
        build: {
            write: false,
            lib: { entry: fileURLToPath(new URL('./fixtures/smbclient.mjs', import.meta.url)), name: 'P64Fixture', formats: ['iife'] },
            rolldownOptions: { external: ['vue'], output: { globals: { vue: 'Vue' } } },
        },
    });
    bundle = output.output.find((asset) => asset.type === 'chunk').code;
});

test('teacher: mounted SMB upload, SSH proof, binary download and masked prompt', async ({ page }) => {
    test.setTimeout(120000);
    expect(teacher.login).toBe('zem');
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/');
    await page.locator('input[ng\\:model="username"]').fill(teacher.login);
    await page.locator('input[type=password][ng\\:model="password"]').fill(teacher.pw);
    const auth = page.waitForResponse((response) => response.url().endsWith('/api/core/auth') && response.request().method() === 'POST');
    await page.locator('a[ng\\:click^="login"]').click();
    expect((await auth).status()).toBe(200);
    await page.waitForURL('**/view/**');
    await page.waitForLoadState('networkidle');
    await page.addScriptTag({ path: require.resolve('vue/dist/vue.runtime.global.prod.js') });
    await page.addScriptTag({ content: bundle });
    await page.evaluate(async () => {
        const injector = angular.element(document.body).injector();
        const services = Object.fromEntries(['$http', 'notify', 'gettextCatalog', 'identity', '$location', 'messagebox', '$rootScope'].map((name) => [name, injector.get(name)]));
        await services.identity.promise;
        const host = document.createElement('div'); host.id = 'p64-fixture'; document.body.append(host);
        window.p64 = await window.P64.mount(host, services);
    });
    expect(await page.evaluate(() => typeof window.Flow)).toBe('function');
    const chunks = [];
    page.on('response', (response) => {
        if (new URL(response.url()).pathname === '/api/lmn/smbclient/upload' && response.request().method() === 'POST') chunks.push(response.status());
    });
    await page.locator('#p64-fixture input[type=file]').setInputFiles({ name: filename, mimeType: 'text/plain', buffer: Buffer.from(content) });
    await expect.poll(() => page.evaluate(() => window.p64.descriptors), { timeout: 60000 }).toBeTruthy();
    const descriptors = await page.evaluate(() => window.p64.descriptors);
    expect(descriptors).toHaveLength(1);
    expect(descriptors[0].name).toBe(filename);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((status) => status === 200)).toBe(true);
    const proof = ssh("python3 - <<'PY'\nfrom pathlib import Path\nimport hashlib\np = Path('/srv/samba/schools/default-school/teachers/zem/p64-synthetic.txt')\nprint(str(p))\nprint(p.stat().st_size)\nprint(hashlib.sha256(p.read_bytes()).hexdigest())\nPY").trim().split('\n');
    const { createHash } = await import('node:crypto');
    expect(Number(proof[1])).toBe(Buffer.byteLength(content));
    expect(proof[2]).toBe(createHash('sha256').update(content).digest('hex'));
    console.log(`SSH proof: ${proof.join(' | ')}, chunks=${chunks.length}`);
    expect(await page.evaluate(async () => {
        const blob = await window.p64.client.download(window.p64.descriptors[0].path);
        return { isBlob: blob instanceof Blob, size: blob.size, text: await blob.text() };
    })).toEqual({ isBlob: true, size: Buffer.byteLength(content), text: content });
    await page.evaluate(() => {
        window.p64.promptResult = 'pending';
        window.p64.client.refresh_krbcc().then(() => { window.p64.promptResult = 'ok'; }, () => { window.p64.promptResult = 'cancel'; });
    });
    const prompt = page.locator('dialog.messagebox:visible').last();
    await expect(prompt.locator('input')).toHaveAttribute('type', 'password');
    await prompt.getByText(/^(Cancel|Abbrechen)$/, { exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.p64.promptResult)).toBe('cancel');
    expect(errors).toEqual([]);
});
