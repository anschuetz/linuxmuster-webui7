import { constants } from 'node:fs';
import { access, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';

export async function createIsolatedMultitool(staging, source) {
    if (!source) {
        for (const directory of (process.env.PATH || '').split(delimiter)) {
            const candidate = join(directory, 'ajenti-dev-multitool');
            try {
                await access(candidate, constants.X_OK);
                source = candidate;
                break;
            } catch (error) {
                if (!['ENOENT', 'EACCES', 'ENOTDIR'].includes(error.code)) throw error;
            }
        }
        if (!source) throw new Error('ajenti-dev-multitool not found in PATH');
    }
    const original = await readFile(source, 'utf8');
    // Upstream hardcodes this path: TMPDIR alone cannot isolate its cache.
    const assignment = /^(\s*)cache_path = '\/tmp\/\.ajenti-resource-cache'$/m;
    if (!assignment.test(original)) throw new Error('Unsupported Multitool cache assignment');
    const isolated = original.replace(assignment,
        (_, indent) => `${indent}cache_path = ${JSON.stringify(join(staging, '.ajenti-resource-cache'))}`);
    const executable = join(staging, 'ajenti-dev-multitool');
    await writeFile(executable, isolated, { mode: 0o700 });
    return executable;
}
