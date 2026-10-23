// Requires the environment printed by tools/setup-ajenti-build.sh in the coordination repo.
// Deliberately separate from npm test: this check needs Python, Babel, CoffeeScript and Sass.
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPluginBuilds } from './build.mjs';

const frontend = dirname(fileURLToPath(import.meta.url));
const plugins = resolve(frontend, '../usr/lib/linuxmuster-webui/plugins');
const builds = await discoverPluginBuilds(frontend);
const names = [...new Set(['lmn_common', ...builds.map(({ lib }) => basename(dirname(lib.entry)))])];
const staging = await mkdtemp(join(tmpdir(), 'ajenti-bundle-check-'));
try {
    for (const name of names) {
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error(`Invalid plugin name: ${name}`);
        const source = join(plugins, name);
        const target = join(staging, name);
        await cp(source, target, { recursive: true });
        // Never let a failed compilation pass by comparing an old copied bundle.
        await rm(join(target, 'resources/build/all.js'), { force: true });
        const result = spawnSync('ajenti-dev-multitool', ['--rebuild'], { cwd: target, stdio: 'inherit' });
        if (result.error) throw result.error;
        if (result.status !== 0) throw new Error(`Multitool failed for ${name} (${result.status})`);
        const built = await readFile(join(target, 'resources/build/all.js'));
        const checkedIn = await readFile(join(source, 'resources/build/all.js'));
        if (!built.equals(checkedIn)) {
            throw new Error(`${name}/resources/build/all.js is stale; rebuild and commit the Ajenti bundle.`);
        }
        console.log(`Ajenti bundle current: ${name}`);
    }
} finally {
    await rm(staging, { recursive: true, force: true });
}
