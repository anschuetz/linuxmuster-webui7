import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const status = execFileSync('git', [
    'status', '--porcelain', '--', ':(glob)usr/lib/linuxmuster-webui/plugins/*/resources/vue/**',
], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
assert.equal(status, '', 'Vue bundles differ from the committed build; rebuild and commit them.');
