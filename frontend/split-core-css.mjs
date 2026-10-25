/** Bootstrap is a scratch reference only; never copy its package into the repo. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, splitCoreCss } from './core-css.mjs';

const frontend = fileURLToPath(new URL('.', import.meta.url));
const reference = process.argv[2];
assert.ok(reference, 'Usage: node split-core-css.mjs /SCRATCH/package/dist/css/bootstrap.css [--check]');
const upstream = await readFile(reference, 'utf8');
assert.equal(sha256(upstream), '7e630d90c7234b0df1729f62b8f9e4bbfaf293d91a5a0ac46df25f2a6759e39a', 'Expected pristine npm bootstrap@3.3.7 dist/css/bootstrap.css');
const result = splitCoreCss(await readFile(join(frontend, 'vendor/core.css'), 'utf8'), upstream);
const json = data => JSON.stringify(data, null, 2) + '\n';
const rows = result.inventory.map(rule => [rule.line, rule.endLine, rule.part,
    rule.context.map(c => `@${c.name} ${c.params}`).join(' / '), rule.selector.replaceAll('\n', ' '),
    rule.part === 'bootstrap' ? 'identical' : rule.counterparts.length ? 'modified' : 'own selector/list'].join('\t'));
const theme = result.inventory.filter(rule => rule.part === 'theme');
const modified = theme.filter(rule => rule.counterparts.length);
const boundaries = result.inventory.filter((rule, i, list) => i > 0 && rule.part !== list[i - 1].part)
    .map(rule => `| ${rule.line} | ${rule.part} | \`${rule.selector.replaceAll('\n', ' ')}\` |`);
const audit = [
    '# P149 · Generated extraction audit', '',
    'Regenerate with `node split-core-css.mjs /SCRATCH/package/dist/css/bootstrap.css`; use `--check` to verify reproducibility.',
    'Source: ajenti.plugin.core 0.116 (`vendor/core.css`, unchanged); reference: npm bootstrap@3.3.7, dist/css/bootstrap.css. MIT licenses in vendor/.',
    'Exact rule identity includes grouping context, the complete ordered selector list and ordered declarations (property/value/important). Only comments, indentation and selector comma spacing are ignored.',
    'No individual selector is detached from a mixed selector list. Modified lists remain wholly theme. Mixed @media blocks split at leaf-rule boundaries; original wrappers and whitespace remain in the manifest.',
    `Leaf rules: ${result.inventory.length}; identical BS3: ${result.inventory.length - theme.length}; theme: ${theme.length} (${modified.length} with an exact upstream selector/context counterpart).`,
    'All rule classifications, contexts and original line ranges: `core-selectors.tsv`. All segment ranges and SHA-256 hashes: `core-order.json` (offsets are UTF-16 code units, end exclusive).',
    'The original Glyphicons @font-face matches upstream including ../fonts/ URLs and remains BS3; the existing build relocation to assets/fonts/ is unchanged. Ajenti-specific font/layout rules remain theme.',
    '', '## Complete interleaving boundaries', '', '| Original core.css line | Next part | Selector / at-rule |', '| --- | --- | --- |', ...boundaries,
    '', '## Every modified upstream rule (A2 override inventory)', '',
    'Each entry gives the full selector/context, original lines, Ajenti declarations and the upstream declarations. Theme-only selector lists are in core-selectors.tsv.', '',
    '| core.css lines | Context | Selector / at-rule | Ordered declarations: Ajenti / Bootstrap |',
    '| --- | --- | --- | --- |',
    ...modified.map(rule => `| ${rule.line}–${rule.endLine} | ${rule.context.map(c => `@${c.name} ${c.params}`).join(' / ') || 'root'} | \`${rule.selector.replaceAll('\n', ' ')}\` | \`${JSON.stringify({ ajenti: rule.declarations, bootstrap: rule.counterparts }).replaceAll('|', '\\u007c')}\` |`),
];
const outputs = { ...result.files, 'theme/core-order.json': json(result.manifest),
    'theme/core-selectors.tsv': ['core_start\tcore_end\tpart\tcontext\tselector\tmatch', ...rows].join('\n') + '\n',
    'theme/core-audit.md': audit.join('\n') + '\n' };
for (const [source, text] of Object.entries(outputs)) {
    const path = join(frontend, source);
    if (process.argv.includes('--check')) assert.equal(await readFile(path, 'utf8'), text, `Stale extraction: ${source}`);
    else { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); }
}
console.log(`Core extraction ${process.argv.includes('--check') ? 'reproducible' : 'generated'}: ${result.inventory.length} rules, ${theme.length} theme.`);
