import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Real settings controller, config and passwd services; only IO/dialogs are doubled. */
export function settingsOracle() {
    const dom = new JSDOM('', { runScripts: 'outside-only' }), w = dom.window;
    const source = file => readFileSync(`test-fixtures/shell/${file}`, 'utf8');
    w.eval(source('angular.min.js'));
    const requests = [], notices = [], languages = [], identity = { user: 'root', isSuperuser: true,
        machine: { name: 'Fixture', hostname: 'fixture.test' }, promise: Promise.resolve() };
    let responder = () => ({}), confirm = true;
    const http = Object.fromEntries(['get', 'post'].map(method => [method, (url, data) => {
        requests.push([method.toUpperCase(), url, data === undefined ? undefined : JSON.parse(JSON.stringify(data))]);
        return Promise.resolve().then(() => responder(url, data)).then(data => ({ data }));
    }]));
    w.angular.module('core', []).value('$http', http).value('$q', { resolve: Promise.resolve.bind(Promise) })
        .value('initialConfigContent', null).filter('translate', () => text => text);
    w.angular.module('ajenti.passwd', []);
    const module = w.angular.module('ajenti.settings', ['core', 'ajenti.passwd']);
    let controller;
    module.controller = (_name, implementation) => { controller = implementation; return module; };
    for (const file of ['config.service.es', 'passwd.service.es', 'index.controller.es']) w.eval(source(`settings/${file}`));
    const injector = w.angular.injector(['ng', 'ajenti.settings']);
    const config = injector.get('config'), passwd = injector.get('passwd');
    return { requests, notices, identity, config, passwd, languages,
        respond: fn => { responder = fn; }, confirm: value => { confirm = value; },
        controller() {
            const scope = injector.get('$rootScope').$new();
            injector.invoke(controller, null, { $scope: scope, identity, config, passwd,
                notify: Object.fromEntries(['error', 'success', 'info'].map(kind => [kind, (...args) => notices.push([kind, ...args])])),
                gettext: text => text, pageTitle: { set() {} }, core: { restart() {} },
                locale: { setLanguage: lang => languages.push(lang) },
                messagebox: { show: () => confirm ? Promise.resolve() : Promise.reject(new Error('cancel')) } });
            return scope;
        },
        mount(scope) {
            // Native inputs use the original template and Angular ngModel; other directives remain inert.
            const element = injector.get('$compile')(source('settings/index.html'))(scope);
            w.document.body.append(...Array.from(element)); scope.$digest(); return w.document.body;
        },
        digest: scope => scope.$digest(), close: () => w.close(),
    };
}
