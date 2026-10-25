import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { buildStyles } from './static-assets.mjs';
const frontend = fileURLToPath(new URL('.', import.meta.url));
const digest = css => createHash('sha256').update(css).digest('hex');
/** Rebuild from every pinned CSS and plugin SCSS input; staging cannot hide stale output. */
export async function verifyStyles(path = new URL('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', import.meta.url)) {
    const css = await buildStyles(frontend), hash = digest(css);
    assert.equal(digest(await readFile(path)), hash,
        'Stale styles.css: rebuild from current sources and stage the generated resources.');
    return { css, hash };
}
