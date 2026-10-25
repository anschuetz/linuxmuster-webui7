// @vitest-environment node
import { expect, it } from 'vitest';
import postcss from 'postcss';
import { buildStyles } from './static-assets.mjs';
it('C4 built CSS resets nav focus, preserves neutral focus and confines mobile fixes below 768px', async () => {
    const css = postcss.parse(await buildStyles(process.cwd()));
    const rules = [];
    css.walkRules(rule => rules.push(rule));
    const last = selector => rules.findLast(rule => rule.selector === selector);
    expect(last('.c4-tabs > .nav-item > .nav-link:focus-visible')?.nodes.some(n => n.prop === 'box-shadow' && n.value === 'none')).toBe(true);
    expect(last('.c4-menu .dropdown-item:not([href]):hover, .c4-menu .dropdown-item:not([href]):focus')?.nodes.some(n => n.prop === 'color' && n.value === '#333')).toBe(true);
    expect(last('.c4-button[disabled]:hover, .c4-button[disabled]:focus')?.nodes.some(n => n.prop === 'background-color' && n.value === '#fff')).toBe(true);
    expect(rules.find(rule => rule.selector === '.c4-permissions' && rule.parent.type === 'root')?.nodes.some(n => n.prop === 'margin-bottom' && n.value === '30px')).toBe(true);
    expect(last('.btn.c4-button')?.nodes.some(n => n.prop === '--bs-btn-focus-box-shadow' && n.value === 'none')).toBe(true);
    for (const [selector, prop, value] of [
        ['.c4-membership-list', 'max-height', 'none !important'],
        ['.c4-membership-list > .membership-item', 'min-width', '0'],
        ['.c4-table-scroll', 'overflow-x', 'auto'],
        ['.c4-toolbar .bar', 'flex-wrap', 'wrap'],
    ]) {
        const rule = last(selector);
        expect(rule?.parent.params, selector).toBe('(max-width: 767px)');
        expect(rule?.nodes.some(n => n.prop === prop && (n.value + (n.important ? ' !important' : '')) === value), selector).toBe(true);
    }
});
