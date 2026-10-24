export function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script'); script.src = src;
        script.onload = resolve; script.onerror = () => reject(new Error(`Could not load ${src}`));
        document.head.append(script);
    });
}

export async function start(boot, { fetch = window.fetch.bind(window), load = loadScript,
    mount = () => window.LmnVueShell.mountShell(document.body, boot) } = {}) {
    const root = `${boot.prefix}/resources/lmn_common/resources`;
    const response = await fetch(`${root}/vue/manifest.json`);
    if (!response.ok) throw new Error('Could not load Vue manifest');
    const manifest = await response.json();
    if (manifest.version !== 1) throw new Error('Unsupported Vue resource manifest');
    await load(`${root}/vue/vendor.js`);
    // Pinned static assets copied by the npm build, without Angular wrappers.
    for (const file of ['ace/ace.js',
        'ace/ext-modelist.js',
        'ace/theme-solarized_dark.js',
        'flow.min.js']) await load(`${root}/vue/assets/${file}`);
    await Promise.all(manifest.plugins.map(async ({ id, resource }) => {
        if (!/^[a-zA-Z0-9_.-]+$/.test(id) || !/^[a-zA-Z0-9_]+\/resources\/vue\/[a-zA-Z0-9_-]+\.js$/.test(resource)) throw new Error('Invalid Vue plugin name');
        if (Object.hasOwn(boot.plugins, id)) await load(`${boot.prefix}/resources/${resource}`);
    }));
    await load(`${root}/vue/shell.js`);
    const owner = mount();
    try { await owner?.ready; return owner; } catch (error) { owner?.dispose(); throw error; }
}
