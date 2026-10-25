// Run existing offline package scenes against the immediately preceding D1 commit.
// Historical fixture source/CSS refs are rebased, assertions remain unchanged.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
const frontend = fileURLToPath(new URL('..', import.meta.url));
const [reference, directory, ...packages] = process.argv.slice(2);
assert.ok(reference && directory && packages.length, 'Usage: node e2e/bs5-d1.local.mjs REF LOG-DIR PACKAGE...');
const commit = execFileSync('git', ['rev-parse', '--verify', `${reference}^{commit}`], { cwd: frontend, encoding: 'utf8' }).trim();
const output = resolve(directory);
await mkdir(output, { recursive: true });
for (const name of packages) {
    assert.match(name, /^[a-z0-9-]+$/);
    const path = join(frontend, 'e2e', `.d1-${name}.local.mjs`);
    const source = await readFile(join(frontend, 'e2e', `bs5-${name}.local.mjs`), 'utf8');
    // D1 compares the same migrated state on both sides. The C4 migration fixture
    // scrolls only 'after' because its original 'before' had no scroll container.
    const rebased = source.replace(/(['"`])([0-9a-f]{9,40})(?=['"`:])/g, (_, quote) => quote + commit)
        .replace("scene==='permissions-scroll'&&name==='after'&&width===390", "scene==='permissions-scroll'&&width===390");
    try {
        await writeFile(path, rebased);
        const result = spawnSync(process.execPath, [path, join(output, name), '--normal'], { cwd: frontend, encoding: 'utf8' });
        await writeFile(join(output, `${name}.log`), (result.stdout ?? '') + (result.stderr ?? ''));
        assert.equal(result.status, 0, `${name}: inspect ${output}/${name}.log`);
        // Some historic migrations allow documented deltas; D1 permits none.
        const comparisons = JSON.parse(await readFile(join(output, name, 'comparison.json'), 'utf8'));
        assert.ok(comparisons.length > 0);
        assert.ok(comparisons.every(row => row.equal && row.geometryEqual), `${name}: D1 requires zero pixel/style differences`);
        console.log(`${name}: ${comparisons.length} pairs, zero pixel/style differences`);
    } finally { await unlink(path); }
}
