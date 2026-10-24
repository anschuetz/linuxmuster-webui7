import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const roots = [];
afterEach(() => roots.splice(0).forEach(root => rmSync(root, { recursive: true, force: true })));

function check(po, catalog, language = 'de') {
    const root = mkdtempSync(join(tmpdir(), 'translations-'));
    roots.push(root);
    const directory = join(root, 'sample', 'locale', language, 'LC_MESSAGES');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'app.po'), po);
    if (catalog !== undefined) writeFileSync(join(directory, 'app.js'), JSON.stringify(catalog));
    return spawnSync(process.execPath, ['check-translations.mjs', root], { encoding: 'utf8' });
}

it('accepts matching catalogs independent of JSON order and encoding', () => {
    expect(check('msgid "Hello"\nmsgstr "Grüße"\nmsgid "Bye"\nmsgstr "Tschüss"',
        { Bye: 'Tschüss', Hello: 'Grüße' }).status).toBe(0);
});

it.each([
    ['changed translation', 'msgid "Hello"\nmsgstr "Neu"', { Hello: 'Alt' }],
    ['new key', 'msgid "Hello"\nmsgstr "Hallo"\nmsgid "New"\nmsgstr "Neu"', { Hello: 'Hallo' }],
    ['removed key', 'msgid "Hello"\nmsgstr "Hallo"', { Hello: 'Hallo', Old: 'Alt' }],
    ['missing catalog', 'msgid "Hello"\nmsgstr "Hallo"', undefined],
])('rejects %s with actionable plugin/language/key diagnostics', (_, po, catalog) => {
    const result = check(po, catalog);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/sample\/de.*(Hello|New|Old)/);
    expect(result.stderr).toContain('run `make pull-crowdin` or `ajenti-dev-multitool --msgfmt`');
});

it('includes empty msgstr values, including the header', () => {
    expect(check('msgid ""\nmsgstr ""\n"Language: de\\n"\nmsgid "Empty"\nmsgstr ""',
        { '': '', Empty: '' }).status).toBe(0);
    expect(check('msgid "Empty"\nmsgstr ""', {}).status).toBe(1);
});

it('mirrors Multitool continuation, escaping, fuzzy, context and plural handling', () => {
    const po = String.raw`#, fuzzy
msgctxt "button"
msgid "Say \"hi\""
msgstr "Sag \"hallo\""
"ignored continuation"
msgid "item"
msgid_plural "items"
msgstr[0] "Ding"
msgstr[1] "Dinge"
msgid "copy"
msgid_plural "copies"
msgstr[0] "Kopie"
msgstr[1] "Kopien"
#~ msgid "obsolete"
#~ msgstr "alt"
msgctxt "other"
msgid "items"
msgstr "last wins"`;
    expect(check(po, { ['Say \\"hi\\']: 'Sag \\"hallo\\', items: 'last wins', copies: 'Kopien' }).status).toBe(0);
});

it('skips English sources just like Multitool (no app.js generated)', () => {
    expect(check('msgid "Hello"\nmsgstr ""', undefined, 'en').status).toBe(0);
});
