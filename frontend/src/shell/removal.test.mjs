import { expect, it } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve('..');
function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(item => item.isDirectory() ? files(`${dir}/${item.name}`) : [`${dir}/${item.name}`]);
}
it('ships Vue and static plugin resources, retaining the public conference page and locale catalogs', () => {
    const plugins = files(`${root}/usr/lib/linuxmuster-webui/plugins`);
    expect(plugins.filter(p => /\/(?:js|build)\/|bower\.json$|main_view\.angular|bridge\.js$/.test(p))).toEqual([]);
    expect(plugins.some(p => p.endsWith('/lmn_websession/resources/partial/public.html'))).toBe(true);
    expect(plugins.some(p => p.endsWith('.po'))).toBe(true);
    for (const p of plugins.filter(p => p.endsWith('/plugin.yml'))) {
        const metadata = readFileSync(p, 'utf8');
        expect(metadata).not.toMatch(/ng:|(?:resources\/)?(?:js|partial|build)\//);
        for (const [, resource] of metadata.matchAll(/^\s+- '([^']+)'/gm)) {
            expect(existsSync(resolve(p, '..', resource)), `${p}: ${resource}`).toBe(true);
        }
    }
    const entry = readFileSync(`${root}/usr/lib/linuxmuster-webui/plugins/lmn_common/resources/content/main_view.html`, 'utf8');
    expect(entry).not.toMatch(/resources\/all\./);
    expect(entry).toContain('/resources/lmn_common/resources/vue/styles.css');
});
