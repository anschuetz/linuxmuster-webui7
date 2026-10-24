/** Entry selector has no Vue/Angular imports: only the chosen runtime is loaded. */
export function selectShell(boot, url = new URL(window.location.href), storage = window.sessionStorage) {
    const choice = url.searchParams.get('shell');
    if (choice === 'angular' || choice === 'vue') storage.setItem('lmn-shell', choice);
    return ['angular', 'vue'].includes(choice) ? choice : storage.getItem('lmn-shell') || boot.defaultShell || 'angular';
}

export function renderLegacy(template, boot) {
    const values = { ...boot, plugins: JSON.stringify(boot.plugins), config: JSON.stringify(boot.config) };
    return template.replace(/%\((\w+)\)s/g, (_, name) => values[name]);
}

export function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = src;
        script.onload = resolve; script.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.append(script);
    });
}

export async function start(boot, { url, storage, fetch = window.fetch.bind(window), load = loadScript,
    mount = () => window.LmnVueShell.mountShell(document.body, boot),
    writeLegacy = html => { document.open(); document.write(html); document.close(); } } = {}) {
    const root = `${boot.prefix}/resources/lmn_common/resources`;
    if (selectShell(boot, url, storage) === 'angular') {
        const response = await fetch(`${root}/content/main_view.angular.html`);
        if (!response.ok) throw new Error('Could not load Angular fallback');
        writeLegacy(renderLegacy(await response.text(), boot)); return;
    }
    const response = await fetch(`${root}/vue/manifest.json`);
    if (!response.ok) throw new Error('Could not load Vue manifest');
    const manifest = await response.json();
    if (manifest.version !== 1) throw new Error('Unsupported Vue resource manifest');
    await load(`${root}/vue/vendor.js`);
    // Existing package assets, served individually; ng-flow's Angular wrapper is never loaded.
    for (const file of ['ace/resources/vendor/ace-builds/src-min-noconflict/ace.js',
        'ace/resources/vendor/ace-builds/src-min-noconflict/ext-modelist.js',
        'ace/resources/vendor/ace-builds/src-min-noconflict/theme-solarized_dark.js',
        'filesystem/resources/vendor/flow.js/dist/flow.min.js']) await load(`${boot.prefix}/resources/${file}`);
    await Promise.all(manifest.plugins.map(async ({ id, resource }) => {
        if (!/^[a-zA-Z0-9_.-]+$/.test(id) || !/^[a-zA-Z0-9_]+\/resources\/vue\/[a-zA-Z0-9_-]+\.js$/.test(resource)) throw new Error('Invalid Vue plugin name');
        if (Object.hasOwn(boot.plugins, id)) await load(`${boot.prefix}/resources/${resource}`);
    }));
    await load(`${root}/vue/shell.js`);
    const owner = mount();
    try { await owner?.ready; return owner; } catch (error) { owner?.dispose(); throw error; }
}
