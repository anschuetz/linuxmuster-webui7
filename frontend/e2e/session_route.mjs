// Observe the adapter/store passed by the real Angular mount directive. Never
// replace navigation, the route's DOM, or the production entry in this mode.
export async function observeRoute(page, prefix, data) {
    await page.evaluate(({ prefix, data }) => {
        const entry = window.LmnVue_lmn_session_new, original = entry.mount;
        Object.defineProperty(window, prefix + 'path', { configurable: true, get: () => location.pathname });
        entry.mount = (el, aj) => {
            window[prefix + 'aj'] = aj;
            const store = entry.getSessionStore(aj); window[prefix + 'store'] = store;
            if (data) { store.state.current = data; store.filterExamUsers(); data = null; }
            return original(el, aj);
        };
        window[prefix + 'unmount'] = () => {
            const i = angular.element(document).injector();
            i.get('$rootScope').$evalAsync(() => i.get('$location').path('/view/lmn/landingpage'));
        };
    }, { prefix, data });
}
