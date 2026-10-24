// Read-only check matching ajenti-dev-multitool 1.4.0 run_msgfmt, not gettext.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const plugins = process.argv[2] ?? fileURLToPath(new URL('../usr/lib/linuxmuster-webui/plugins', import.meta.url));

function expectedCatalog(po) {
    const entries = [];
    let msgid = null;
    for (const line of po.split(/\r?\n/)) {
        // Multitool ignores continuations, context, flags and obsolete comments;
        // msgid_plural replaces msgid, and the last msgstr[n] wins. Escapes stay raw.
        const field = line.match(/^(msgid\S*|msgstr\S*)\s+(.*)$/);
        if (!field) continue;
        const value = field[2].trim().replace(/^"+|"+$/g, '');
        if (field[1].startsWith('msgid')) msgid = value;
        else entries.push([msgid, value]);
    }
    return Object.fromEntries(entries);
}

async function compare(directory) {
    const expected = expectedCatalog(await readFile(join(directory, 'app.po'), 'utf8'));
    const keys = Object.keys(expected);
    let actual;
    try {
        actual = JSON.parse(await readFile(join(directory, 'app.js'), 'utf8'));
    } catch (error) {
        return `${JSON.stringify(keys.find(key => key) ?? '')}: ${error.code === 'ENOENT' ? 'missing app.js' : 'unreadable/invalid app.js'}`;
    }
    if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return 'invalid catalog object';
    const changed = [...new Set([...keys, ...Object.keys(actual)])].find(key =>
        !Object.hasOwn(expected, key) || !Object.hasOwn(actual, key) || expected[key] !== actual[key]);
    return changed === undefined ? null : `${JSON.stringify(changed)}: catalog differs`;
}

async function check() {
    let count = 0;
    const failures = [];
    for (const plugin of await readdir(plugins, { withFileTypes: true })) {
        if (!plugin.isDirectory()) continue;
        const locale = join(plugins, plugin.name, 'locale');
        let languages;
        try {
            languages = await readdir(locale, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') continue;
            throw error;
        }
        for (const language of languages) {
            // Multitool deliberately does not generate an English catalog.
            if (!language.isDirectory() || language.name === 'en') continue;
            const label = `${plugin.name}/${language.name}`;
            try {
                const difference = await compare(join(locale, language.name, 'LC_MESSAGES'));
                if (difference) failures.push(`${label}: ${difference}`);
            } catch (error) {
                failures.push(`${label}: cannot read app.po (${error.code ?? error.message})`);
            }
            count++;
        }
    }
    if (failures.length) {
        console.error(`Stale translation catalogs:\n${failures.join('\n')}\nrun \`make pull-crowdin\` or \`ajenti-dev-multitool --msgfmt\``);
        process.exitCode = 1;
    } else {
        console.log(`Translation catalogs current (${count} checked).`);
    }
}

await check().catch(error => {
    console.error(`Translation check failed: ${error.message}`);
    process.exitCode = 1;
});
