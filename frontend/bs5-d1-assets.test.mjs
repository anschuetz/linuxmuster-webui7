// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildStaticAssets, buildStyles } from './static-assets.mjs';
it('ships no Glyphicons CSS or fonts and keeps Font Awesome and PT Sans as stock resources', async () => {
    expect(await buildStyles(process.cwd())).not.toMatch(/glyphicons|Glyphicons/);
    const directory = await mkdtemp(join(tmpdir(), 'bs5-assets-'));
    try {
        await mkdir(join(directory, 'assets/fonts'), { recursive: true });
        await writeFile(join(directory, 'assets/fonts/glyphicons-stale.woff'), 'old output');
        await buildStaticAssets(process.cwd(), directory);
        expect(await readdir(join(directory, 'assets'))).not.toContain('fonts');
        const page = await readFile('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/content/main_view.html', 'utf8');
        expect(page).toContain('vendor/fontawesome/css/all.min.css');
        expect(page).toContain('vendor/fontawesome/css/v4-shims.css');
        expect(page).toContain('vendor/pt-sans/styles/pt_sans.css');
    } finally { await rm(directory, { recursive: true, force: true }); }
});
