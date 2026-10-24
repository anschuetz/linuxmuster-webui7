import { reactive } from 'vue';
import { createValidation } from '../../common/validation.mjs';

const base = '/api/lmn/linbo4';
export const initialTab = hash => hash === '#images' ? 1 : 0;
export const sortedConfigs = configs => [...configs].sort((a, b) => {
    const left = a.file.toLowerCase(), right = b.file.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
});
const withGroup = (data, name, fields = {}) => ({
    ...data, config: { ...data.config, LINBO: { ...data.config.LINBO, Group: name, ...fields } },
});

/** Part 1 of the Angular LINBO controller. HTTP rejection UI remains with the shell. */
export function createGroups(aj) {
    const state = reactive({ configs: undefined, images: undefined, examples: undefined, changed: false });
    const validation = createValidation(aj);
    async function loadConfigs() {
        const { data } = await aj.http.get(`${base}/configs`);
        state.configs = data.filter(item => !('School' in item.settings)
            || [aj.identity.profile.activeSchool, 'default-school'].includes(item.settings.School));
        const response = await aj.http.get(`${base}/images`);
        state.images = response.data.map(image => ({
            ...image,
            backups_list: Object.entries(image.backups).map(([date, backup]) => ({ ...backup, date })),
            used_in: state.configs.filter(item => item.images.includes(image.name + '.qcow2'))
                .map(item => item.file.split('.').at(-1)),
        }));
    }
    async function load() {
        await Promise.all([
            loadConfigs().catch(() => { /* Keep unset/partially loaded data, as Angular does. */ }),
            aj.http.get(`${base}/examples/config`).then(({ data }) => { state.examples = data; })
                .catch(() => { /* The shell owns HTTP errors; no invented empty examples list. */ }),
        ]);
    }
    async function namePrompt(value) {
        let message;
        try { message = await aj.messagebox.prompt('New name', value); }
        catch { return; /* Prompt cancellation makes no requests. */ }
        const valid = validation.isValidLinboConf(message.value);
        if (valid !== true) { aj.notify.error(aj.gettext(valid)); return; }
        return message.value;
    }
    async function createConfig(example) {
        const name = await namePrompt('');
        if (!name) return;
        if (state.configs.some(item => item.file === 'start.conf.' + name)) {
            aj.notify.error(aj.gettext('A config file with this name already exists!'));
            return;
        }
        try {
            let data = { config: { LINBO: { Group: name } }, os: [], partitions: [] };
            if (example) {
                const response = await aj.http.get(`${base}/config/examples/${example}`);
                const setup = await aj.http.get('/api/lmn/read-config-setup');
                data = withGroup(response.data, name, { Server: setup.data.setup.serverip });
            }
            await aj.http.post(`${base}/config/start.conf.${name}`, data);
            state.changed = true;
            state.configs = [...state.configs, { file: 'start.conf.' + name, images: [] }];
        } catch { /* No local success state after failure; the shell handles rejection. */ }
    }
    async function deleteConfig(file) {
        try {
            await aj.messagebox.show({
                title: `Delete '${file}' ?`,
                text: `Delete the file '${file}'? This will also delete the associated grub config file located in /srv/linbo/boot/grub.`,
                positive: 'Delete', negative: 'Cancel',
            });
        } catch { return; /* Confirmation dismissed. */ }
        try {
            await aj.http.delete(`${base}/config/${file}`);
            state.changed = true;
            const index = state.configs.findIndex(item => item.file === file);
            // Angular removes only the first matching row, even after duplicate copies.
            if (index >= 0) state.configs = [...state.configs.slice(0, index), ...state.configs.slice(index + 1)];
        } catch { /* Retain rows and dirty state on HTTP failure. */ }
    }
    async function duplicateConfig(file, deleteOriginal = false) {
        const name = await namePrompt(file.substring('start.conf.'.length));
        if (!name) return;
        try {
            const { data } = await aj.http.get(`${base}/config/${file}`);
            await aj.http.post(`${base}/config/start.conf.${name}`, withGroup(data, name));
            const deletion = deleteOriginal ? aj.http.delete(`${base}/config/${file}`) : null;
            if (!deleteOriginal) state.changed = true;
            // Preserve the old list behavior: no duplicate-name check and no removal on rename.
            const copies = state.configs.filter(item => item.file === file)
                .map(item => ({ ...JSON.parse(JSON.stringify(item)), file: 'start.conf.' + name }));
            state.configs = [...state.configs, ...copies];
            if (deleteOriginal) { await deletion; state.changed = true; }
        } catch { /* A failed rename DELETE still leaves the appended rows, as in Angular. */ }
    }
    return { state, load, createConfig, deleteConfig, duplicateConfig };
}
