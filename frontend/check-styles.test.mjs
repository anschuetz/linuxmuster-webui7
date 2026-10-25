// @vitest-environment node
import { expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import postcss from 'postcss';
import { buildStyles } from './static-assets.mjs';
import { verifyStyles } from './check-styles.mjs';
it('accepts rebuilt CSS and rejects the missing C11 rules seen at merge 370', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'styles-freshness-'));
    try {
        const fresh = await buildStyles(process.cwd()), path = join(directory, 'styles.css');
        await writeFile(path, fresh);
        await expect(verifyStyles(path)).resolves.toMatchObject({ css: fresh, hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
        const stale = postcss.parse(fresh); let removed = 0;
        stale.walkRules(rule => { if (rule.selector.includes('.c11-button')) { rule.remove(); removed++; } });
        expect(removed).toBeGreaterThan(0);
        await writeFile(path, stale.toString());
        await expect(verifyStyles(path)).rejects.toThrow('Stale styles.css');
    } finally { await rm(directory, { recursive: true, force: true }); }
});
