import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Unmodified core 0.116 controllers AND identity.auth in an isolated Angular injector. */
export function authOracle({ mode = 'normal', pwReset = 'False', serial = 'serial', nextPage } = {}) {
    const dom = new JSDOM('', { url: 'https://example.test/', runScripts: 'outside-only' });
    const w = dom.window, requests = [], notices = [], redirects = [];
    const source = file => readFileSync(`test-fixtures/shell/${file}`, 'utf8');
    w.eval(source('angular.min.js'));
    w.Date.now = Date.now;
    let responder = () => ({});
    const http = Object.fromEntries(['get', 'post', 'delete'].map(method => [method, (url, data) => {
        requests.push([method.toUpperCase(), url, data]);
        return Promise.resolve().then(() => responder(url, data)).then(data => ({ data }));
    }]));
    const q = { defer() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; },
        resolve: Promise.resolve.bind(Promise), reject: Promise.reject.bind(Promise) };
    w.angular.module('core', []).value('$http', http).value('$q', q).value('$location', { path: () => '/' })
        .value('urlPrefix', '').value('ajentiBootstrapColor', null)
        .filter('translate', () => text => text);
    w.eval(source('auth/identity.service.es'));
    for (const name of ['login', 'totp', 'pwreset']) {
        // Only the lexical browser location is doubled; fixture bytes are unchanged.
        w.Function('location', source(`auth/${name}.controller.es`))({ set href(url) { redirects.push(url); } });
    }
    const injector = w.angular.injector(['ng', 'core']), identity = injector.get('identity');
    identity.user = null;
    const scopes = [], root = { pwReset };
    return { requests, notices, redirects, identity, http, root,
        respond: fn => { responder = fn; },
        controller(name) {
            const scope = injector.get('$rootScope').$new(); scopes.push(scope);
            injector.get('$controller')(`Core${name}Controller`, { $scope: scope, $rootScope: root,
                $routeParams: { mode, serial, nextPage }, identity, $window: { location: { assign: url => redirects.push(url) } },
                notify: { error: text => notices.push(['error', text]), success: text => notices.push(['success', text]) },
                gettext: text => text, customization: { plugins: { core: { loginredir: '/' } } },
                messagebox: { show: () => Promise.resolve() } });
            return scope;
        },
        mount(template, scope) {
            const element = injector.get('$compile')(source(`auth/${template}.html`))(scope);
            w.document.body.append(...Array.from(element)); scope.$digest(); return w.document.body;
        },
        close: () => { scopes.forEach(scope => scope.$destroy()); w.close(); },
    };
}
