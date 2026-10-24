import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compile } from 'sass';

/** Keep the pinned Bootstrap/Ajenti CSS and standalone editor/upload assets. */
export async function buildStaticAssets(frontend, output) {
    const vendor = join(frontend, 'vendor'), assets = join(output, 'assets');
    await mkdir(assets, { recursive: true });
    for (const name of ['ace', 'fonts', 'flow.min.js', 'FLOW-LICENSE', 'BOOTSTRAP-LICENSE', 'AJENTI-LICENSE', 'TOASTER-LICENSE', 'LOADINGBAR-LICENSE']) {
        await cp(join(vendor, name), join(assets, name), { recursive: true });
    }
    const css = [];
    for (const name of ['core-vendor.css', 'core.css', 'ace.css', 'dashboard.css']) {
        css.push((await readFile(join(vendor, name), 'utf8')).replaceAll('../fonts/', 'assets/fonts/'));
    }
    const plugins = resolve(frontend, '../usr/lib/linuxmuster-webui/plugins');
    for (const name of (await readdir(plugins)).sort()) {
        const resources = join(plugins, name, 'resources');
        for (const file of (await readdir(resources).catch(error => {
            if (error.code === 'ENOENT') return [];
            throw error;
        })).filter(file => file.endsWith('.scss')).sort()) {
            css.push(compile(join(resources, file), { style: 'expanded', silenceDeprecations: ['color-functions', 'global-builtin'] }).css);
        }
    }
    await writeFile(join(output, 'styles.css'), css.join('\n') + '\n');
}
