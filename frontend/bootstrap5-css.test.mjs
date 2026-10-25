// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { expect, it } from 'vitest';
import { normalizedRules } from './core-css.mjs';
import { buildStyles } from './static-assets.mjs';
const frontend = process.cwd();
const read = name => readFile(join(frontend, name), 'utf8');

it('builds one pinned Bootstrap 5 before documented compatibility, Ajenti and plugins, without BS3 or Normalize', async () => {
    const css = await buildStyles(frontend);
    const bootstrap = await read('vendor/bootstrap5.css');
    const compat = await read('theme/compat-bs3.css');
    const theme = await read('theme/ajenti-bs5.css');
    expect(css.split('Bootstrap  v5.3.8')).toHaveLength(2);
    expect(css).not.toMatch(/normalize\.css|Bootstrap v3|Bootstrap 3\.3\.7 subset/);
    expect(css.indexOf(bootstrap)).toBeGreaterThanOrEqual(0);
    expect(css.indexOf(compat.replaceAll('../fonts/', 'assets/fonts/'))).toBeGreaterThan(css.indexOf(bootstrap));
    expect(css.indexOf(theme)).toBeGreaterThan(css.indexOf(compat));
    const toaster = await read('vendor/core-vendor.css');
    expect(css.indexOf(toaster)).toBeGreaterThan(css.indexOf(bootstrap));
    expect(css.indexOf(toaster)).toBeLessThan(css.indexOf(compat));
    expect(compat).not.toContain('.carousel-inner');
    const hashes = JSON.parse(await read('vendor/SHA256.json'));
    expect(hashes['bootstrap5.css']).toBe(createHash('sha256').update(bootstrap).digest('hex'));
    expect(await read('vendor/BOOTSTRAP5-LICENSE')).toContain('MIT License');
    expect(await read('vendor/README.md')).toMatch(/bootstrap@5\.3\.8/);
});

it('documents every compatibility rule with evidence and removal owner, without adding a second reset', async () => {
    const compat = postcss.parse(await read('theme/compat-bs3.css') + await read('theme/compat-bs5.css') + await read('theme/compat-glyphicons.css'));
    compat.walkRules(rule => {
        if (rule.parent.type === 'atrule' && /keyframes/.test(rule.parent.name)) return;
        const section = compat.nodes.find(node => node.type === 'comment' && node.text.startsWith('P137 common/users; P155 B5 section:'));
        const grouped = section && rule.parent === compat && compat.nodes.indexOf(rule) > compat.nodes.indexOf(section)
            && rule.selectors.every(selector => selector.includes('common-user-'));
        const evidence = grouped ? section : rule.prev();
        expect(evidence?.type, rule.selector).toBe('comment');
        expect(evidence.text, rule.selector).toMatch(/P137.*(?:B[1-6]|C\d+|D1)/);
    });
    expect(compat.toString()).not.toMatch(/normalize\.css|\[hidden\],\s*template/);
});

it('keeps the old grid breakpoint, open/fade states and native messagebox stacking contract', async () => {
    const compat = postcss.parse(await read('theme/compat-bs3.css') + await read('theme/compat-bs5.css'));
    const rules = [];
    compat.walkRules(rule => rules.push(rule));
    const find = selector => rules.find(rule => rule.selector === selector);
    expect(find('.col-sm-6').parent.params).toBe('(min-width: 768px)');
    expect(find('.col-sm-6').nodes.some(n => n.prop === 'width' && n.value === '50%')).toBe(true);
    expect(find('.modal-scrollbar-measure')).toBeUndefined();
    expect(find('.fade.in').nodes.some(n => n.prop === 'opacity' && n.value === '1')).toBe(true);
    expect(find('.modal.in .modal-dialog').nodes.some(n => n.prop === 'transform' && n.value === 'translate(0, 0)')).toBe(true);
    expect(find('.open > .dropdown-menu').nodes.some(n => n.prop === 'display' && n.value === 'block')).toBe(true);
    expect(find('dialog.messagebox').nodes.some(n => n.prop === 'z-index' && n.value === 'auto')).toBe(true);
});

it('retains every post-Reboot Ajenti rule unchanged and accounts for all 368 A1 counterparts', async () => {
    const original = normalizedRules(await read('theme/ajenti.css'));
    const start = original.findIndex(rule => rule[1] === 'body');
    const theme = normalizedRules(await read('theme/ajenti-bs5.css'));
    // B3 adds only the neutral auth variant before the original btn-flat cascade.
    const authSelectors = new Set(['.auth-secondary', '.auth-secondary:focus',
        '.auth-secondary:hover,.auth-secondary:active',
        '.auth-secondary:active:hover,.auth-secondary:active:focus', '.auth-secondary:disabled']);
    const auth = theme.filter(rule => authSelectors.has(rule[1]));
    expect(auth.map(rule => rule[1])).toEqual([...authSelectors]);
    expect(auth.every(rule => rule[0].length === 0)).toBe(true);
    expect(theme.filter(rule => !authSelectors.has(rule[1]))).toEqual(original.slice(start));
    const modified = (await read('theme/core-selectors.tsv')).trim().split('\n').slice(1)
        .map(row => row.split('\t')).filter(row => row[5] === 'modified');
    const audit = (await read('theme/bs5-counterparts.tsv')).trim().split('\n').slice(1).map(row => row.split('\t'));
    expect(audit.map(row => row.slice(0, 4))).toEqual(modified.map(row => [row[0], row[1], row[3], row[4]]));
    expect(audit).toHaveLength(368);
});
