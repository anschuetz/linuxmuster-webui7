import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// Unmodified core 0.116 sources, pinned by P106; AngularJS retains its MIT header.
export function legacyHarness({ status = 200, body = '{"ok":true}', headers = 'Content-Type: application/json', path = '/panel/view/test', backend } = {}) {
    const dom = new JSDOM('', { url: 'https://example.test/panel/view/test', runScripts: 'outside-only' });
    const { window } = dom;
    window.eval(readFileSync('test-fixtures/shell/angular.min.js', 'utf8'));
    const calls = [], notices = [], dialogs = [], redirects = [];
    window.angular.module('core', []).constant('urlPrefix', '/panel').constant('ajentiBootstrapColor', 'blue')
        .value('notify', { error: (...args) => notices.push(args) })
        .value('messagebox', { show: value => dialogs.push(value) }).value('gettext', x => x)
        .value('$location', { path: () => path })
        .value('$window', { ...window, location: { ...window.location, assign: url => redirects.push(url) }, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) })
        .config(($provide, $httpProvider) => {
            $provide.value('$httpBackend', (method, url, data, done, requestHeaders, timeout, credentials, responseType) => {
                calls.push({ method, url, data, headers: Object.fromEntries(Object.entries(requestHeaders).filter(([, value]) => value != null)), responseType });
                if (backend) backend({ method, url, done });
                else done(status, body, headers, 'test');
            });
            $httpProvider.interceptors.push('urlPrefixInterceptor', 'unauthenticatedInterceptor');
        });
    for (const file of ['interceptors.es', 'identity.service.es']) {
        window.eval(readFileSync(`test-fixtures/shell/${file}`, 'utf8'));
    }
    const injector = window.angular.injector(['ng', 'core']);
    return {
        calls, notices, dialogs, redirects,
        identity: injector.get('identity'),
        flush: () => injector.get('$rootScope').$digest(),
        async request(method, ...args) {
            let result, error;
            injector.get('$http')[method](...args).then(r => { result = r; }, e => { error = e; });
            injector.get('$rootScope').$digest();
            if (error) throw error;
            return result;
        },
        close: () => window.close(),
    };
}
