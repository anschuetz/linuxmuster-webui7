import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';
import { shellBuildConfig } from './build.mjs';

/** Reuse the production settings; compile in memory without changing tracked artifacts. */
export async function verifyShellBundle(path) {
    const config = shellBuildConfig();
    const result = await build({ ...config, logLevel: 'silent', build: { ...config.build, write: false } });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap(result => result.output);
    const shell = outputs.find(output => output.type === 'chunk' && output.fileName === 'shell.js');
    assert.ok(shell, 'Production build did not produce shell.js');
    assert.ok((await readFile(path ?? join(config.build.outDir, 'shell.js'))).equals(Buffer.from(shell.code)),
        'Stale shell.js: rebuild from current sources and stage the generated resources.');
}
