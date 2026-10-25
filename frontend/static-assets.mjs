import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compile } from 'sass';

/** Keep the pinned Bootstrap/Ajenti CSS and standalone editor/upload assets. */
export async function buildStaticAssets(frontend, output) {
    const vendor = join(frontend, 'vendor'), assets = join(output, 'assets');
    await mkdir(assets, { recursive: true });
    // Remove the retired font directory also on incremental builds.
    await rm(join(assets, 'fonts'), { recursive: true, force: true });
    for (const name of ['ace', 'flow.min.js', 'FLOW-LICENSE', 'BOOTSTRAP-LICENSE', 'BOOTSTRAP5-LICENSE', 'AJENTI-LICENSE', 'TOASTER-LICENSE', 'LOADINGBAR-LICENSE']) {
        await cp(join(vendor, name), join(assets, name), { recursive: true });
    }
    await writeFile(join(output, 'styles.css'), await buildStyles(frontend));
}

/** One Reboot, then temporary structure compatibility and the Ajenti theme. */
export async function buildStyles(frontend) {
    const css = [];
    for (const name of ['vendor/bootstrap5.css', 'vendor/core-vendor.css', 'theme/compat-bs3.css', 'theme/compat-bs5.css',
        'theme/ajenti-bs5.css', 'vendor/ace.css', 'vendor/dashboard.css']) {
        css.push((await readFile(join(frontend, name), 'utf8')).replaceAll('../fonts/', 'assets/fonts/'));
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
