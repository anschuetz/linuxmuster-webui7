// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { expect, it } from 'vitest';
import { build } from 'vite';

it('discovers two plugin entries and builds their own paths and globals', async () => {
    const root = await mkdtemp(join(tmpdir(), 'lmn-vue-build-'));
    try {
        const frontend = join(root, 'frontend');
        for (const plugin of ['lmn_common', 'lmn_links']) {
            const directory = join(frontend, 'src/plugins', plugin);
            await mkdir(directory, { recursive: true });
            await writeFile(join(directory, 'entry.mjs'), 'export function mount() { return "mounted"; }');
        }
        const { discoverPluginBuilds } = await import('./build.mjs');
        const bundles = await discoverPluginBuilds(frontend);
        expect(bundles).toHaveLength(2);
        for (const [index, plugin] of ['lmn_common', 'lmn_links'].entries()) {
            const output = join(root, 'usr/lib/linuxmuster-webui/plugins', plugin, 'resources/vue');
            expect(bundles[index].outDir).toBe(output);
            await build({ configFile: false, logLevel: 'silent', build: bundles[index] });
            const context = {};
            runInNewContext(await readFile(join(output, `${plugin}.js`), 'utf8'), context);
            expect(context[`LmnVue_${plugin}`].mount()).toBe('mounted');
        }
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
