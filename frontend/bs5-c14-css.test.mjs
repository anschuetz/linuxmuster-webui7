// @vitest-environment node
import { expect, it } from 'vitest';
import postcss from 'postcss';
import { buildStyles } from './static-assets.mjs';
it('C14 built CSS keeps 30px form spacing, the B3/B4 focus token and responsive logo', async () => {
 const rules = []; postcss.parse(await buildStyles(process.cwd())).walkRules(r => rules.push(r));
 for (const [selector, prop, value] of [
  ['.c14-field', 'margin-bottom', '30px'],
  ['.btn.c14-button', '--bs-btn-focus-box-shadow', 'none'],
  ['.c14-button:focus, .c14-button:focus-visible', 'border-color', '#aeaeae'],
  ['.c14-button:hover, .c14-button:active', 'border-color', '#cfcfcf'],
  ['.c14-button:active:hover, .c14-button:active:focus', 'background-color', '#d4d4d4'],
  ['.c14-button[disabled]:hover, .c14-button[disabled]:focus', 'background-color', '#fff'],
  ['.c14-select', 'appearance', 'auto'], ['.c14-select', 'padding', '6px 12px'],
  ['.c14-logo', 'max-width', '100%'], ['.c14-logo', 'height', 'auto'],
 ]) expect(rules.findLast(r => r.selector === selector)?.nodes.some(n => n.prop === prop && n.value === value), selector).toBe(true);
});
