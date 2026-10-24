import { reactive, readonly } from 'vue';

/** Shell capability: a single state owner; storage is ngStorage's persisted object shape. */
export function createNavigation({ aj, storage = createLayoutStorage(), prefix = '', navigate, logout, customization = { plugins: { core: { extraProfileMenuItems: [] } } } }) {
    const layout = reactive({ sidebar: storage.showSidebar === undefined ? true : storage.showSidebar,
        widescreen: storage.isWidescreen === undefined ? false : storage.isWidescreen, overlay: false, navigationPresent: true, path: '' });
    const sidebar = reactive({ item: undefined });
    const search = reactive({ visible: false, query: null, results: null });
    let timer, disposed = false;
    function toggle(field, value, persisted) {
        layout[field] = value === undefined ? !layout[field] : value;
        if (persisted) storage[persisted] = layout[field];
    }
    const cancelSearch = () => { clearTimeout(timer); search.visible = false; search.query = null; };
    function openResult(result) {
        if (!result) return;
        navigate(result.url); cancelSearch();
    }
    async function loadSidebar() {
        try {
            const { data } = await aj.http.get('/api/core/sidebar');
            if (!disposed) sidebar.item = { ...data.sidebar, expanded: true, isRoot: true,
                children: data.sidebar.children.map(item => ({ ...item, expanded: true, isTopLevel: true })) };
        } catch { /* Shared HTTP policy owns errors; original retains its current tree. */ }
    }
    function setQuery(value) {
        const query = value.trim();
        clearTimeout(timer);
        if (query === search.query) return;
        timer = setTimeout(async () => {
            search.query = query || null;
            if (!query) return; // Original keeps the previous results when clearing/cancelling.
            try {
                const { data } = await aj.http.get(`/api/core/navbox/${query}`);
                if (!disposed) search.results = data;
            } catch { /* Preserve results; errors are handled by aj.http. */ }
        }, 500);
    }
    function keydown(event) {
        if (event.ctrlKey && event.key.toUpperCase() === 'P') {
            search.visible = true; event.preventDefault(); event.stopPropagation();
        }
    }
    document.addEventListener('keydown', keydown);
    return {
        layout: readonly(layout), sidebar: readonly(sidebar), search: readonly(search), customization: readonly(customization), prefix,
        toggleNavigation: value => toggle('sidebar', value, 'showSidebar'),
        toggleWidescreen: value => toggle('widescreen', value, 'isWidescreen'),
        toggleOverlayNavigation: value => toggle('overlay', value),
        // Browser location.pathname, including urlPrefix (unlike Angular $location.path()).
        routeChanged(path) {
            layout.path = path; layout.overlay = false;
            layout.navigationPresent = !path.includes('/view/login') && !path.includes('/view/reset_password');
        },
        loadSidebar, setQuery, cancelSearch, openResult,
        manageTotp: () => navigate(`${prefix}/view/totp`), logout,
        dispose() { disposed = true; clearTimeout(timer); document.removeEventListener('keydown', keydown); },
    };
}

/** Reuse ngStorage's on-disk names so the eventual shell switch keeps preferences. */
export function createLayoutStorage(storage = window.localStorage) {
    return Object.defineProperties({}, Object.fromEntries(['showSidebar', 'isWidescreen'].map(key => [key, {
        get: () => { const value = storage.getItem(`ngStorage-${key}`); return value === null ? undefined : JSON.parse(value); },
        set: value => storage.setItem(`ngStorage-${key}`, JSON.stringify(value)),
    }])));
}
