// @vitest-environment node
import { expect, it } from 'vitest';
import postcss from 'postcss';
import { buildStyles } from './static-assets.mjs';
it('C6 built CSS preserves neutral focus/active, badge emptiness, dropdown positioning and native select geometry', async () => {
    const css = postcss.parse(await buildStyles(process.cwd())), rules = [];
    css.walkRules(rule => rules.push(rule));
    for (const [selector, prop, value] of [
        ['.btn.c6-button', '--bs-btn-focus-box-shadow', 'none'],
        ['.c6-button.active', 'background-color', '#e6e6e6'],
        ['.badge.c6-badge:empty', 'display', 'none'],
        ['.c6-menu.show', 'display', 'block'],
        ['.c6-menu.dropdown-menu-end', 'right', '0'],
        ['.c6-sort', 'appearance', 'auto'],
        ['.c6-menu button.dropdown-item', 'width', 'auto'],
        ['.c6-menu button.dropdown-item', 'text-decoration', 'underline'],
        ['.c6-menu button.dropdown-item:hover, .c6-menu button.dropdown-item:focus', 'color', '#0a6ebd'],
        ['.c6-menu button.dropdown-item:active', 'color', 'var(--bs-btn-active-color)'],
        ['.c6-menu button.dropdown-item', 'background-color', 'transparent'],
        ['.btn.c6-button:where(:not(.btn-flat):not(.btn-lmn):not(.btn-lmn-danger-inv):not(.btn-lmn-success-inv))', 'color', '#333'],
        ['.c6-progress.bg-warning', '--bs-warning-rgb', '255, 193, 7'],
    ]) expect(rules.findLast(r => r.selector === selector)?.nodes.some(n => n.prop === prop && n.value === value), selector).toBe(true);
});
