import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const options = { cwd: new URL('..', import.meta.url), encoding: 'utf8' };
const paths = ['usr/lib/linuxmuster-webui/plugins'];
const changed = execFileSync('git', ['diff', '--name-only', '--', ...paths], options);
const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '--', ...paths], options);
const generated = [...changed.split('\n'), ...added.split('\n')].filter(path => path.includes('/resources/vue/'));
assert.deepEqual(generated, [], 'Vue assets differ from the index; rebuild and stage the generated resources.');

// Also reject a staged stylesheet from the archived BS3 pipeline or stale CSS inputs.
await import('./check-core-css.mjs');
