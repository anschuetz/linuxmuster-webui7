import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Runs the unmodified Core controllers/directives with boundary services only. */
export function navigationOracle({ storage = {}, path = '/view/lmn/landingpage', sidebar = { children: [] }, results = [] } = {}) {
    const dom = new JSDOM('', { url: 'https://example.test/panel/view/test', runScripts: 'outside-only' });
    const { window } = dom;
    const source = name => readFileSync(`test-fixtures/shell/${name}`, 'utf8');
    window.eval(source('angular.min.js'));
    window.console = { group() {}, info() {}, log() {}, groupEnd() {} };
    window.$ = () => ({ resize() {} });
    const calls = [], routes = [];
    const identity = { init() {}, promise: { then() {} }, user: 'fixture' };
    const hotkeys = { ENTER: 13, ESC: 27, on(scope, handler) { this.handler = handler; } };
    window.angular.module('core', []).filter('translate', () => text => text)
        .value('$localStorage', storage).value('identity', identity).value('hotkeys', hotkeys)
        .value('$location', { path: value => value === undefined ? path : routes.push(value) })
        .factory('$http', ($q) => ({ get: url => { calls.push(url); return $q.resolve({ data: url === '/core:resources/partial/sidebarItem.html' ? source('navigation/sidebarItem.html') : url === '/api/core/sidebar' ? { sidebar: structuredClone(sidebar) } : url === '/api/core/session-time' ? 0 : results }); } }))
        .value('favicon', { init() {} }).value('locale', {}).value('core', {}).value('config', {})
        .value('$interval', () => {}).value('urlPrefix', '/panel').value('ajentiPlugins', [])
        .value('ajentiVersion', '').value('ajentiPlatform', '').value('ajentiPlatformUnmapped', '')
        .value('devMode', '').value('pwReset', '');
    for (const file of ['root.controller.es', 'navbox.controller.es', 'sidebar.es', 'floatingToolbar.es', 'customization.service.es', 'filters.es']) {
        window.eval(source(`navigation/${file}`));
    }
    const injector = window.angular.injector(['ng', 'core']);
    injector.get('$templateCache').put('/core:resources/partial/sidebarItem.html', source('navigation/sidebarItem.html'));
    const root = injector.get('$rootScope'), scope = root.$new(), navbox = root.$new();
    injector.get('$controller')('CoreRootController', { $scope: scope });
    injector.get('$controller')('CoreNavboxController', { $scope: navbox });
    root.$digest();
    return {
        scope, root, navbox, hotkeys, calls, routes, storage,
        customization: injector.get('customization'),
        flush: () => root.$digest(),
        settingsVisibility(flags, config) {
            scope.customization = { plugins: { settings: flags } }; scope.config = { data: config };
            const template = source('navigation/globalSettings.html');
            return Object.fromEntries(['Language', 'SSL', 'Proxies'].map(name => {
                const expression = [...template.matchAll(/ng:show="([^"]+)"/g)].find(match => match[1].includes(`hide${name}Settings`))[1];
                return [name, Boolean(scope.$eval(expression))];
            }));
        },
        mount(template) {
            const element = injector.get('$compile')(template)(scope);
            window.document.body.append(element[0]); root.$digest(); return element[0];
        },
        close: () => window.close(),
    };
}
