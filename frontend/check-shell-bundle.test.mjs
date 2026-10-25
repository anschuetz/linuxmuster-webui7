// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyShellBundle } from './check-shell-bundle.mjs';

it('rejects a stale shell artifact by comparing it to a fresh production build', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'shell-freshness-'));
    try {
        const shell = await readFile(new URL('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/shell.js', import.meta.url));
        const stale = join(directory, 'shell.js');
        await writeFile(stale, Buffer.concat([shell, Buffer.from('\n// stale artifact\n')]));
        await expect(verifyShellBundle(stale)).rejects.toThrow('Stale shell.js');
    } finally { await rm(directory, { recursive: true, force: true }); }
});
