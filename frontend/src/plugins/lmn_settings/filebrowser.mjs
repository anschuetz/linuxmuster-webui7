import { computed, reactive } from 'vue';

// One browser per path-selector, including the original eager root load and
// directory position retained while its dialog is hidden.
export function createFileBrowser(aj) {
    const root = aj.identity.profile.fs_root || '/';
    const state = reactive({ path: '/', parent: undefined, items: undefined, loading: false });
    state.sorted = computed(() => state.items && [...state.items].sort((a, b) => {
        const first = a.name.toLowerCase(), second = b.name.toLowerCase();
        return Number(b.isDir) - Number(a.isDir) || (first < second ? -1 : first > second ? 1 : 0);
    }));
    state.navigate = async (next, explicit = false) => {
        state.loading = true;
        try {
            const { data } = await aj.http.get(`/api/filesystem/list/${next}`);
            state.path = next; state.items = data.items; state.parent = next === root ? null : data.parent;
            if (!next.startsWith(root)) await state.navigate(root);
        } catch (error) {
            if (explicit) aj.notify.error(aj.gettext('Could not load directory'), error.message);
        } finally { state.loading = false; }
    };
    state.ready = state.navigate(root);
    return state;
}
