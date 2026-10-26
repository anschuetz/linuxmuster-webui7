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

it('keeps navigation open state while modal compatibility has moved to its theme contract', async () => {
    const compat = postcss.parse(await read('theme/compat-bs3.css') + await read('theme/compat-bs5.css'));
    const rules = [];
    compat.walkRules(rule => rules.push(rule));
    expect(rules.find(rule => rule.selector === '.open > .dropdown-menu').nodes.some(n => n.prop === 'display' && n.value === 'block')).toBe(true);
    expect(rules.filter(rule => /\.modal|\.fade\.in|dialog\.messagebox/.test(rule.selector))).toEqual([]);
});

it('retains the Ajenti theme except measured dead F46 tab colors and unused Glyphicons and accounts for A1 counterparts', async () => {
    const original = normalizedRules(await read('theme/ajenti.css'));
    const start = original.findIndex(rule => rule[1] === 'body');
    const active = normalizedRules(await read('theme/ajenti-bs5.css'));
    const theme = active.slice(active.findIndex(rule => rule[1] === 'body'));
    const restSelectors = new Set([
        '.aj-dropdown-marker', '.dropdown-toggle.aj-dropdown-marker::after',
        '.dropup .dropdown-toggle.aj-dropdown-marker::after', 'label.form-check.aj-native-check',
        'label.form-check.aj-native-check + label.form-check.aj-native-check',
        'label.form-check.aj-native-check-inline', '.aj-native-check-inline + .aj-native-check-inline',
        '.aj-native-check > input[type="checkbox"],.aj-native-check-inline > input[type="checkbox"]',
        '.btn.btn-sm.aj-image-action-compact', '.table.table-sm.aj-table-compact > :not(caption) > * > *',
    ]);
    const rest = theme.filter(rule => restSelectors.has(rule[1]));
    expect(rest.map(rule=>rule[1])).toEqual([...restSelectors]);
    expect(rest.every(rule=>rule[0].length===0)).toBe(true);
    // B3 adds only the neutral auth variant before the original btn-flat cascade.
    const authSelectors = new Set(['.auth-secondary', '.auth-secondary:focus',
        '.auth-secondary:hover,.auth-secondary:active',
        '.auth-secondary:active:hover,.auth-secondary:active:focus', '.auth-secondary:disabled']);
    const auth = theme.filter(rule => authSelectors.has(rule[1]));
    expect(auth.map(rule => rule[1])).toEqual([...authSelectors]);
    expect(auth.every(rule => rule[0].length === 0)).toBe(true);
    const deadTabColors = rule => /body\.global-color-[\w-]+.*\.nav-tabs\s*>\s*li\.active\s*>\s*a/.test(rule[1]);
    expect(original.slice(start).filter(deadTabColors)).toHaveLength(8);
    const modalSelectors = new Set([
        '.modal', '.modal.fade .modal-dialog', '.modal-content',
        '.modal-backdrop.fade', '.modal-backdrop.in', '.modal-header', '.modal-footer',
        '.modal-footer .btn + .btn', '.modal .modal-content .modal-header',
        '.modal .modal-content .modal-body', '.modal .modal-content .modal-footer',
    ]);
    const migratedModal = rule => modalSelectors.has(rule[1]) ||
        (rule[1] === ':root' && rule[2].some(([prop]) => prop === '--aj-modal-width')) || [
            '.modal-open', '.modal-open .modal', '.modal-dialog', '.modal.fade.show .modal-dialog',
            '.modal.fade.show', '.modal-backdrop', '.modal-backdrop.fade.show', 'dialog.messagebox',
            '.modal-title', '.modal-body', '.modal-header,.modal-footer', '.modal-header .close', '.modal-footer > *',
            '.modal-footer .btn-group .btn + .btn', '.modal-footer .btn-block + .btn-block',
            '.modal-header:after,.modal-footer:after', '.modal-sm', '.modal-lg',
        ].includes(rule[1]);
    const expected = original.slice(start).filter(rule => !deadTabColors(rule) && !migratedModal(rule)).flatMap(([context, selector, body]) => {
        if (/^\.col-(xs|sm|md|lg)-/.test(selector)) return [];
        const retained = postcss.list.comma(selector).filter(value =>
            !/\.glyphicon(?:\b|-)/.test(value) &&
            !/^\.(row|container|container-fluid):(?:before|after)$/.test(value));
        return retained.length ? [[context, retained.join(','), body]] : [];
    });
    expect(theme.filter(rule => !authSelectors.has(rule[1]) && !restSelectors.has(rule[1]) && !migratedModal(rule))).toEqual(expected);
    const modified = (await read('theme/core-selectors.tsv')).trim().split('\n').slice(1)
        .map(row => row.split('\t')).filter(row => row[5] === 'modified');
    const audit = (await read('theme/bs5-counterparts.tsv')).trim().split('\n').slice(1).map(row => row.split('\t'));
    expect(audit.map(row => row.slice(0, 4))).toEqual(modified.map(row => [row[0], row[1], row[3], row[4]]));
    expect(audit).toHaveLength(368);
});

it('builds C2 neutral focus tokens, nav focus reset, spacing and DHCP invalid colors', async () => {
    const css = postcss.parse(await buildStyles(frontend));
    const declaration = (selector, prop) => {
        let value;
        css.walkRules(rule => { if (rule.selectors.includes(selector)) rule.walkDecls(prop, d => { value = d.value; }); });
        return value;
    };
    expect(declaration('.btn.dhcp-button', '--bs-btn-focus-box-shadow')).toBe('none');
    expect(declaration('.btn.dns-button', '--bs-btn-focus-box-shadow')).toBe('none');
    expect(declaration('.btn.cron-button', '--bs-btn-focus-box-shadow')).toBe('none');
    expect(declaration('.cron-tabs > .nav-item > .nav-link:focus-visible', 'box-shadow')).toBe('none');
    expect(declaration('.dhcp-field', 'margin-bottom')).toBe('30px');
    expect(declaration('.cron-field', 'margin-bottom')).toBe('30px');
    expect(declaration('.dhcp-field .is-invalid', 'border-color')).toBe('red');
    expect(declaration('.dhcp-field .is-invalid:focus', 'border-color')).toBe('#843534');
    expect(declaration('.dhcp-field .is-invalid:focus', 'background-color')).toBe('rgba(255, 178, 178, 0.29)');
});
