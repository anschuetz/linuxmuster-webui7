import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { splitCoreCss, assembleCoreCss, normalizedRules, loadCoreCss } from './core-css.mjs';
import { buildStyles } from './static-assets.mjs';

const frontend = process.cwd();
const reference = 'body { margin: 0; }\n@media print { .a, .b { color: black; } .c { display: none; } }\n';
const original = '/* MIT */\nbody { margin: 0; }\nbody { color: blue; }\n@media print {\n .a, .b { color: blue; }\n /* keep */ .c { display: none; }\n}\n.end { color: red; }\n';

it('separates exact upstream rules, changed rules and mixed media without changing a byte', () => {
    const { manifest, files, inventory } = splitCoreCss(original, reference);
    expect(assembleCoreCss(manifest, files)).toBe(original);
    expect(inventory.map(rule => rule.part)).toEqual(['bootstrap', 'theme', 'theme', 'bootstrap', 'theme']);
    expect(files['vendor/bootstrap3.css']).toContain('@media print');
    expect(files['vendor/bootstrap3.css']).not.toContain('color: blue');
    expect(files['theme/ajenti.css']).not.toContain('display: none');
    expect(inventory[2].selector).toBe('.a, .b');
});

it('retains nested at-rules, keyframes, font URLs and important declaration order', () => {
    const css = '@font-face { font-family: icons; src: url(../fonts/icons.woff); }\n@media screen { @supports (display: grid) { .a { color:red; color:blue!important; } } }\n@keyframes spin { from { opacity: 0; } to { opacity: 1; } }';
    const split = splitCoreCss(css, css);
    expect(assembleCoreCss(split.manifest, split.files)).toBe(css);
    expect(split.inventory.every(rule => rule.part === 'bootstrap')).toBe(true);
    expect(normalizedRules(css)).not.toEqual(normalizedRules(css.replace('color:red; color:blue!important;', 'color:blue!important; color:red;')));
    const compact = css.replace(/\s*([{}])\s*/g, '$1');
    const compactSplit = splitCoreCss(compact, compact);
    expect(assembleCoreCss(compactSplit.manifest, compactSplit.files)).toBe(compact);
    expect(normalizedRules(compactSplit.files['vendor/bootstrap3.css'])).toEqual(normalizedRules(compact));
});

it('rejects changed, missing, reordered or duplicated segments', () => {
    const { manifest, files } = splitCoreCss(original, reference);
    expect(() => assembleCoreCss(manifest, { ...files, 'theme/ajenti.css': files['theme/ajenti.css'].replace('blue', 'pink') })).toThrow(/segment/i);
    expect(() => assembleCoreCss(manifest, { ...files, 'theme/ajenti.css': '' })).toThrow(/segment/i);
    const reversed = { ...manifest, segments: [...manifest.segments].reverse() };
    expect(() => assembleCoreCss(reversed, files)).toThrow(/original/i);
    const duplicated = { ...manifest, segments: [...manifest.segments, manifest.segments[0]] };
    expect(() => assembleCoreCss(duplicated, files)).toThrow(/original/i);
});

it('keeps normalized rule context, selector and declaration order while ignoring comments/indentation', () => {
    expect(normalizedRules('.a,\n.b { color: red; /* x */ }')).toEqual(normalizedRules('.a,.b{color:red}'));
    expect(normalizedRules('@media print { .a { color:red } }')).not.toEqual(normalizedRules('.a { color:red }'));
    expect(normalizedRules('.a,.b {color:red}')).not.toEqual(normalizedRules('.b,.a {color:red}'));
});

it('reconstructs the pinned core and keeps the complete built stylesheet equivalent to the old pipeline', async () => {
    const core = await readFile(join(frontend, 'vendor/core.css'), 'utf8');
    expect(await loadCoreCss(frontend)).toBe(core);
    const before = await buildStyles(frontend, core);
    const after = await buildStyles(frontend);
    expect(after).toBe(before);
    expect(normalizedRules(after)).toEqual(normalizedRules(before));
});

it('classifies every rule in the real extraction into a pure Bootstrap or pure theme stylesheet', async () => {
    const bootstrap = await readFile(join(frontend, 'vendor/bootstrap3.css'), 'utf8');
    const theme = await readFile(join(frontend, 'theme/ajenti.css'), 'utf8');
    // A synthetic regeneration exercises the same complete real stylesheet and
    // its nested/mixed rules, without keeping the upstream npm package here.
    const core = await readFile(join(frontend, 'vendor/core.css'), 'utf8');
    const result = splitCoreCss(core, bootstrap);
    const expected = normalizedRules(bootstrap).map(rule => JSON.stringify(rule));
    const actual = normalizedRules(result.files['vendor/bootstrap3.css']).map(rule => JSON.stringify(rule));
    expect(actual).toEqual(expected);
    expect(normalizedRules(result.files['theme/ajenti.css'])).toEqual(normalizedRules(theme));
});
