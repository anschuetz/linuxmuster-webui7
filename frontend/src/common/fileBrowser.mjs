import { computed, reactive } from 'vue';
import { createFilesystem, withinRoot } from './filesystem.mjs';

// One browser per selector: eager root load and position retained on dialog close.
export function createFileBrowser(aj, getRoot = () => aj.identity.profile.fs_root || '/', initialPath) {
    const fs = createFilesystem(aj);
    const state = reactive({ path: '/', parent: null, items: [], loading: false, error: '' });
    let generation = 0;
    state.sorted = computed(() => [...state.items].sort((a, b) => {
        const first = a.name.toLowerCase(), second = b.name.toLowerCase();
        return Number(Boolean(b.isDir)) - Number(Boolean(a.isDir)) || (first < second ? -1 : first > second ? 1 : 0);
    }));
    state.navigate = async (target, explicit = false) => {
        const request = ++generation, root = getRoot();
        if (!withinRoot(target, root)) target = root;
        state.loading = true; state.error = '';
        try {
            const data = await fs.list(target);
            if (request !== generation) return;
            state.path = target; state.items = data.items;
            state.parent = target === root || !data.parent || !withinRoot(data.parent, root) ? null : data.parent;
        } catch (error) {
            if (request !== generation) return;
            state.error = aj.gettext('Could not load directory');
            if (explicit) aj.notify.error(state.error, error.message ?? error.data?.message);
        } finally { if (request === generation) state.loading = false; }
    };
    state.dispose = () => { generation++; };
    state.ready = state.navigate(initialPath ?? getRoot());
    return state;
}
