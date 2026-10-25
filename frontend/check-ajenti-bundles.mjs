// Compatibility entry point for the package/deployment bundle check. No Multitool.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const plugins = resolve(root, '../usr/lib/linuxmuster-webui/plugins');
const output = join(plugins, 'lmn_common/resources/vue');
const hashes = JSON.parse(await readFile(join(root, 'vendor/SHA256.json'), 'utf8'));
for (const [name, expected] of Object.entries(hashes)) {
    const input = await readFile(join(root, 'vendor', name));
    assert.equal(createHash('sha256').update(input).digest('hex'), expected, `Changed pinned asset: ${name}`);
    if (name.startsWith('ace/') || ['flow.min.js', 'FLOW-LICENSE', 'BOOTSTRAP-LICENSE', 'BOOTSTRAP5-LICENSE', 'AJENTI-LICENSE', 'TOASTER-LICENSE', 'LOADINGBAR-LICENSE'].includes(name)) {
        assert.deepEqual(await readFile(join(output, 'assets', name)), input, `Stale static asset: ${name}`);
    }
}
for (const name of await readdir(plugins)) {
    const metadata = await readFile(join(plugins, name, 'plugin.yml'), 'utf8');
    assert.doesNotMatch(metadata, /ng:|resources\/(?:js|partial|build)\//, name);
}
assert.doesNotMatch(await readFile(join(output, 'styles.css'), 'utf8'), /glyphicons/i);
assert.ok(!(await readdir(join(output, 'assets'))).includes('fonts'), 'Retired Glyphicons directory still shipped');
await import('./check-core-css.mjs');
await import('./check-built-resources.mjs');
console.log('Vue bundles, pinned static assets and plugin metadata current; no Angular build.');
