import { cp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compile } from 'sass';
import { loadCoreCss } from './core-css.mjs';

/** Keep the pinned Bootstrap/Ajenti CSS and standalone editor/upload assets. */
export async function buildStaticAssets(frontend, output) {
    const vendor = join(frontend, 'vendor'), assets = join(output, 'assets');
    await mkdir(assets, { recursive: true });
    for (const name of ['ace', 'fonts', 'flow.min.js', 'FLOW-LICENSE', 'BOOTSTRAP-LICENSE', 'AJENTI-LICENSE', 'TOASTER-LICENSE', 'LOADINGBAR-LICENSE']) {
        await cp(join(vendor, name), join(assets, name), { recursive: true });
    }
    await writeFile(join(output, 'styles.css'), await buildStyles(frontend));
}

/** An explicit core input allows comparison against the original A1 pipeline. */
export async function buildStyles(frontend, coreCss) {
    const vendor = join(frontend, 'vendor'), css = [];
    for (const name of ['core-vendor.css', 'core.css', 'ace.css', 'dashboard.css']) {
        const text = name === 'core.css' ? coreCss ?? await loadCoreCss(frontend) : await readFile(join(vendor, name), 'utf8');
        css.push(text.replaceAll('../fonts/', 'assets/fonts/'));
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
    return css.join('\n') + '\n';
}
