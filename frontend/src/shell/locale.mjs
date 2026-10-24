import { computed, reactive, shallowRef } from 'vue';

// The aj contract only requests n=1, without interpolation or a gettext context.
const singularIndex = language => ['ar', 'sl', 'jv', 'mnk'].includes(language.split(/[-_]/)[0]) ? 1 : 0;
function translation(value, language) {
    const plain = typeof value === 'object' && !Array.isArray(value) ? value?.$$noContext : value;
    return Array.isArray(plain) ? plain[singularIndex(language)] : typeof plain === 'string' ? plain : undefined;
}

/** Runtime locale only. Settings owns explicit config saves and backend authorization. */
export function createLocale({ http, initialConfig = {} }) {
    const language = shallowRef('en'), catalogs = shallowRef({}), languages = shallowRef([]);
    let disposed = false;
    async function setLanguage(lang) {
        if (disposed) throw new Error('Locale disposed');
        // This endpoint returns JSON despite the historic .js extension; never evaluate it.
        const { data } = await http.get(`/resources/all.locale.js?lang=${encodeURIComponent(lang)}`);
        if (disposed) return;
        const previous = catalogs.value[lang] ?? {};
        const entries = Object.fromEntries(Object.entries(data).map(([key, value]) => {
            const context = typeof value === 'object' && !Array.isArray(value) ? value : { $$noContext: value };
            return [key, { ...previous[key], ...context }];
        }));
        catalogs.value = { ...catalogs.value, [lang]: { ...previous, ...entries } };
        language.value = lang;
    }
    function gettext(text) {
        const lang = language.value;
        const fallback = /([^_]+)_[^_]+$/.exec(lang)?.[1];
        return translation(catalogs.value[lang]?.[text], lang)
            || translation(catalogs.value[fallback]?.[text], fallback) || text;
    }
    async function start() {
        // The original shell catalog and settings language list load independently.
        await Promise.all([
            http.get('/api/core/languages').then(({ data }) => { if (!disposed) languages.value = data; }),
            setLanguage(initialConfig.language || 'en'),
        ]);
    }
    return { setLanguage, gettext, start, dispose: () => { disposed = true; },
        state: reactive({ language: computed(() => language.value), languages: computed(() => languages.value) }) };
}
