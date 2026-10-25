import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { expect, it } from 'vitest';

it('ships independent auth eye/spacing and the D04 wrapping fix in built CSS', () => {
    const css = postcss.parse(readFileSync('../usr/lib/linuxmuster-webui/plugins/lmn_common/resources/vue/styles.css', 'utf8'));
    function declarations(selector) {
        const values = {};
        css.walkRules(rule => {
            if (rule.selectors.includes(selector)) rule.walkDecls(d => { values[d.prop] = d.value + (d.important ? ' !important' : ''); });
        });
        return values;
    }
    expect(declarations('.auth-reset-send')).toMatchObject({ 'white-space': 'normal' });
    expect(declarations('.auth-field.mb-3')).toMatchObject({ 'margin-bottom': '30px !important' });
    expect(declarations('.auth-password-feedback')).toMatchObject({ position: 'absolute', top: '0', right: '0', width: '34px', height: '34px' });
    expect(declarations('.auth-password-field > label ~ .auth-password-feedback')).toMatchObject({ top: '25px' });
    expect(declarations('.auth-password-field > .form-control')).toMatchObject({ 'padding-right': '42.5px' });
    expect(declarations('.btn.auth-secondary')).toMatchObject({ color: '#333', 'background-color': '#fff', 'border-color': '#eee' });
});
