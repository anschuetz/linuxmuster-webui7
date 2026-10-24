import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createIsolatedMultitool } from './isolated-multitool.mjs';

it('gives concurrent multitools separate caches inside their temporary directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'multitool-test-'));
    try {
        const source = join(root, 'ajenti-dev-multitool');
        await writeFile(source, `#!/usr/bin/env python3
import os
cache_path = '/tmp/.ajenti-resource-cache'
os.makedirs(cache_path)
print(cache_path)
`, { mode: 0o700 });
        const runs = await Promise.all([0, 1].map(async () => {
            const staging = await mkdtemp(join(root, 'run-'));
            const tool = await createIsolatedMultitool(staging, source);
            return { staging, cache: execFileSync(tool, { encoding: 'utf8' }).trim() };
        }));
        expect(runs[0].cache).not.toBe(runs[1].cache);
        for (const run of runs) expect(run.cache).toBe(join(run.staging, '.ajenti-resource-cache'));
    } finally {
        await rm(root, { recursive: true, force: true });
    }
});
