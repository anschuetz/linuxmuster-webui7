import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Unmodified core/gettext services in a real AngularJS injector; no product imports. */
export function presentationOracle() {
    const dom = new JSDOM('<link rel="shortcut icon">', { url: 'https://example.test/', runScripts: 'outside-only' });
    const { window } = dom;
    const source = name => readFileSync(`test-fixtures/shell/${name}`, 'utf8');
    window.eval(source('angular.min.js'));
    window.eval(source('presentation/angular-gettext.js'));
    window.eval('Array.prototype.remove = function (item) { this.splice(this.indexOf(item), 1); };');
    const requests = [], toasts = [], redirects = [], timers = [];
    let response = {};
    window.angular.module('core', ['gettext'])
        .value('config', { promise: { then() {} } })
        .value('$location', { path: url => redirects.push(url) })
        .value('toaster', { pop: (...args) => toasts.push(args) })
        .value('$window', { ...window, location: { ...window.location, reload() {} }, setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window) })
        .value('$timeout', Object.assign(fn => { timers.push(fn); }, { cancel: () => false }))
        .value('$http', {
            get: url => { requests.push(['GET', url]); return Promise.resolve({ data: response }); },
            post: url => { requests.push(['POST', url]); return Promise.resolve({}); },
        });
    for (const name of ['gettext', 'messagebox', 'notify', 'pageTitle', 'core']) {
        window.eval(source(`presentation/${name}.service.es`));
    }
    window.eval(source('presentation/messageboxContainer.es'));
    const injector = window.angular.injector(['ng', 'core']);
    return {
        locale: injector.get('locale'), catalog: injector.get('gettextCatalog'),
        messagebox: injector.get('messagebox'), notify: injector.get('notify'),
        pageTitle: injector.get('pageTitle'), root: injector.get('$rootScope'), core: injector.get('core'),
        requests, toasts, redirects, timers,
        mountMessageboxes() {
            const element = injector.get('$compile')('<messagebox-container></messagebox-container>')(injector.get('$rootScope'));
            window.document.body.append(element[0]);
            injector.get('$rootScope').$digest();
            return element[0];
        },
        respond: data => { response = data; }, flush: () => injector.get('$rootScope').$digest(),
        close: () => window.close(),
    };
}
