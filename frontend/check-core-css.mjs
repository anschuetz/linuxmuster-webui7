import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadCoreCss, normalizedRules } from './core-css.mjs';
import { buildStyles } from './static-assets.mjs';

const frontend = fileURLToPath(new URL('.', import.meta.url));
const original = await readFile(new URL('./vendor/core.css', import.meta.url), 'utf8');
const reconstructed = await loadCoreCss(frontend);
assert.equal(reconstructed, original, 'Core extraction is not byte-identical');
assert.deepEqual(normalizedRules(reconstructed), normalizedRules(original), 'Core rule sequence changed');
const expected = await buildStyles(frontend);
const actual = await readFile(new URL('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', import.meta.url), 'utf8');
assert.equal(actual, expected, 'Full styles.css differs from Bootstrap 5 pipeline');
assert.equal(actual.split('Bootstrap  v5.3.8').length, 2, 'Exactly one pinned Bootstrap 5 required');
assert.doesNotMatch(actual, /normalize\.css|Bootstrap v3|Bootstrap 3\.3\.7 subset/, 'Legacy reset or unused BS3 component bundled');

console.log(`Archived A1 byte/rule equality and active Bootstrap 5 styles.css verified (${normalizedRules(original).length}/${normalizedRules(actual).length} leaf rules).`);
