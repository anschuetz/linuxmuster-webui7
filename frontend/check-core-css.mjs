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
const before = await buildStyles(frontend, original);
const actual = await readFile(new URL('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', import.meta.url), 'utf8');
assert.equal(actual, before, 'Full styles.css differs from original pipeline');
assert.deepEqual(normalizedRules(actual), normalizedRules(before), 'Full stylesheet rule sequence changed');
console.log(`Core CSS byte/rule equality and full styles.css equality verified (${normalizedRules(original).length}/${normalizedRules(actual).length} leaf rules).`);
