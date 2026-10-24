import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

/** Pinned original services/controllers, native Promise HTTP and manual interval boundaries. */
export function dashboardOracle() {
    const dom = new JSDOM('', { url: 'https://example.test/', runScripts: 'outside-only' });
    const w = dom.window, requests = [], intervals = [], scopes = [], errors = [];
    const source = file => readFileSync(`test-fixtures/shell/${file}`, 'utf8');
    w.eval(source('angular.min.js'));
    w.Math.random = () => Math.random();
    w.$ = w.angular.element;
    w.eval("String.prototype.lpad = function(c,n) { return this.padStart(n,c); }; Array.prototype.remove = function(x) { const i=this.indexOf(x); if(i>=0)this.splice(i,1); };");
    let responder = () => ({}), answer = { value: 'Other' };
    const tracked = promise => ({
        then(fn, fail) { const result = promise.then(fn, fail); result.catch(error => errors.push(error)); return tracked(result); },
        catch(fn) { return tracked(promise.catch(fn)); },
    });
    const http = Object.fromEntries(['get', 'post'].map(method => [method, (url, data) => {
        requests.push([method, url, data === undefined ? undefined : JSON.parse(JSON.stringify(data))]);
        const response = Promise.resolve().then(() => responder(url, data)).then(data => ({ data }));
        return tracked(response);
    }]));
    const interval = (fn, ms) => { const timer = { fn, ms }; intervals.push(timer); return timer; };
    interval.cancel = timer => { timer.cancelled = true; };
    const customization = { plugins: {} }, title = [], identity = { isSuperuser: true, promise: Promise.resolve() };
    w.angular.module('core', []).value('$http', http).value('$interval', interval).value('gettext', x => x)
        .value('initialConfigContent', { session_max_time: 3600 }).value('customization', customization)
        .value('identity', identity).value('notify', {}).value('pageTitle', { set: x => title.push(x) })
        .value('messagebox', { prompt: () => Promise.resolve(answer), show: () => Promise.resolve() })
        .provider('$route', function() { this.when = () => this; this.$get = () => ({}); });
    w.eval(source('dashboard/rootAccess.es'));
    w.eval(source('dashboard/config.service.es')); w.eval(source('dashboard/filters.es'));
    w.eval(source('dashboard/dashboard/all.js'));
    w.eval(source('dashboard/sessions/all.js'));
    w.eval(source('dashboard/datetime/all.js'));
    const injector = w.angular.injector(['ng', 'ajenti.dashboard', 'ajenti.session_list', 'lmn.wdatetime']);
    return { http, requests, intervals, customization, title, errors, identity,
        respond: fn => { responder = fn; }, answer: value => { answer = { value }; },
        controller(name, locals = {}) {
            const scope = injector.get('$rootScope').$new(); scopes.push(scope);
            injector.get('$controller')(name, { $scope: scope, ...locals }); return scope;
        },
        filter: (name, ...args) => injector.get('$filter')(name)(...args),
        template: name => source(`dashboard/${name}`),
        mount(template, scope) { const element = injector.get('$compile')(template)(scope); scope.$digest(); return element; },
        flush: () => injector.get('$rootScope').$digest(),
        close: () => { scopes.forEach(scope => scope.$destroy()); w.close(); },
    };
}
