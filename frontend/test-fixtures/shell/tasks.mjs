import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

export function tasksOracle({ http, notify, messagebox, identity = { isSuperuser: true }, core = {} }) {
    const dom = new JSDOM('', { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window, listeners = new Map(), sent = [];
    const socket = { on(name, fn) { listeners.set(name, fn); }, emit(...args) { sent.push(args); } };
    const source = name => readFileSync(`test-fixtures/shell/${name}`, 'utf8');
    w.eval(source('angular.min.js'));
    const q = { defer() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; } };
    w.io = { connect: () => socket };
    w.angular.module('core', []).value('$location', {}).value('$http', http).value('$q', q).value('urlPrefix', '')
        .factory('socketFactory', () => () => socket)
        .provider('$route', function() { this.when = () => this; this.$get = () => ({}); })
        .value('notify', notify).value('gettext', x => x);
    w.angular.module('ajenti.plugins', ['core']);
    for (const name of ['socket.service.es', 'push.service.es', 'tasks.service.es', 'plugins.controller.es']) w.eval(source(`tasks/${name}`));
    const injector = w.angular.injector(['ng', 'ajenti.plugins']), root = injector.get('$rootScope');
    const tasks = injector.get('tasks');
    return { tasks, sent, filter: (list, query) => injector.get('$filter')('filter')(list, query), event: (name, value) => listeners.get(name)?.(value),
        plugins() {
            const scope = root.$new();
            injector.get('$controller')('PluginsIndexController', { $scope: scope, $rootScope: { ajentiVersion: '2.2.17' },
                identity: { ...identity, init() {}, promise: Promise.resolve() }, pageTitle: { set() {} }, messagebox, core });
            return scope;
        }, close: () => { root.$destroy(); w.close(); } };
}
