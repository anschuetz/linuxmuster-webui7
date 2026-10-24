import { copyFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

const frontendRoot = fileURLToPath(new URL('.', import.meta.url));

function bundle(entry, outDir, name, fileName) {
    return {
        outDir,
        // lmn_common contains the shared bundles and its own plugin bundle.
        emptyOutDir: false,
        lib: { entry, name, formats: ['iife'], fileName: () => fileName },
        rolldownOptions: {
            external: ['vue'],
            output: { globals: { vue: 'Vue' }, codeSplitting: false },
        },
    };
}

/** Each plugin owns one entry and one IIFE; all share this build convention. */
export async function discoverPluginBuilds(root = frontendRoot) {
    const plugins = join(root, 'src/plugins');
    const directories = await readdir(plugins, { withFileTypes: true });
    const builds = await Promise.all(directories.filter((item) => item.isDirectory()).map(async ({ name }) => {
        const files = await readdir(join(plugins, name));
        if (!files.includes('entry.mjs')) return [];
        return [bundle(
            join(plugins, name, 'entry.mjs'),
            resolve(root, '../usr/lib/linuxmuster-webui/plugins', name, 'resources/vue'),
            `LmnVue_${name.replace(/\W/g, '_')}`,
            `${name}.js`,
        )];
    }));
    return builds.flat();
}

async function buildAll() {
    const commonOutput = resolve(frontendRoot, '../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue');
    await build({ build: bundle(join(frontendRoot, 'src/bridge/entry.mjs'), commonOutput, 'LmnVueBridge', 'bridge.js') });
    for (const pluginBuild of await discoverPluginBuilds()) {
        await build({ build: pluginBuild });
    }
    await build({ build: bundle(join(frontendRoot, 'src/shell/startup-entry.mjs'), commonOutput, 'LmnShellStartup', 'startup.js') });
    await build({ define: { 'process.env.NODE_ENV': JSON.stringify('production') }, build: bundle(join(frontendRoot, 'src/shell/runtime.mjs'), commonOutput, 'LmnVueShell', 'shell.js') });
    const pluginBuilds = await discoverPluginBuilds();
    await writeFile(join(commonOutput, 'manifest.json'), JSON.stringify({ version: 1, plugins: pluginBuilds.map(b => b.lib.fileName().slice(0, -3)) }) + '\n');
    // Vue's official global runtime is an IIFE shared by all bundles.
    const require = createRequire(import.meta.url);
    await copyFile(require.resolve('vue/dist/vue.runtime.global.prod.js'), join(commonOutput, 'vendor.js'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    await buildAll();
}
