// @vitest-environment node
import { expect, it } from 'vitest';
import postcss from 'postcss';
import { buildStyles } from './static-assets.mjs';
it('builds C3 focus, validation and mobile repairs without moving the 768px boundary', async () => {
    const root = postcss.parse(await buildStyles(process.cwd()));
    const rules = selector => { const result = []; root.walkRules(rule => { if (rule.selectors.includes(selector)) result.push(rule); }); return result; };
    const value = (selector, property) => rules(selector).flatMap(rule => rule.nodes.filter(node => node.prop === property)).at(-1)?.value;
    expect(value('.c3-pagination', '--bs-pagination-font-size')).toBe('14px');
    expect(value('.c3-pagination', '--bs-pagination-border-radius')).toBe('3px');
    expect(value('.btn.c3-button', '--bs-btn-focus-box-shadow')).toBe('none');
    expect(value('.c3-client-tabs > .nav-item > .nav-link', 'isolation')).toBe('auto');
    expect(value('.c3-client-tabs > .nav-item > .nav-link:focus-visible', 'box-shadow')).toBe('none');
    expect(value('.c3-device-field .form-control.is-invalid', 'padding-right')).toBe('12px');
    expect(value('.c3-device-field .form-control.is-invalid', 'background-image')).toBe('none');
    expect(value('.c3-device-field .form-control.is-invalid', 'border-color')).toBe('red');
    const scroll = rules('.c3-devices-scroll').find(rule => rule.nodes.some(node => node.prop === 'overflow-x'));
    expect(value('.c3-devices-scroll > .lm-table', 'min-width')).toBe('900px');
    expect(value('.c3-devices-scroll .group-options', 'position')).toBe('static');
    expect(scroll?.parent.params).toBe('(max-width: 767px)');
    expect(rules('.c3-manager-content #sideBar').find(rule => rule.parent.type === 'atrule')?.parent.params).toBe('(max-width: 767px)');
});
