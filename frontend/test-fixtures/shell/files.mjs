import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// Execute the pinned, unmodified directives in AngularJS, with fixture services.
export function filesOracle({ items = [], root = '/', editor = {} } = {}) {
    const dom = new JSDOM('', { url: 'https://example.test/', runScripts: 'outside-only' });
    const { window } = dom;
    const source = name => readFileSync(`test-fixtures/shell/${name}`, 'utf8');
    window.eval(source('angular.min.js'));
    const calls = [], notices = [];
    window.ace = { config: { set() {} }, require: () => ({ getModeForPath: () => ({ mode: 'ace/mode/sh' }) }) };
    window.angular.module('ajenti.ace', []);
    window.angular.module('ajenti.filesystem', [])
        .value('identity', { promise: { then: fn => fn() }, profile: { fs_root: root } })
        .value('notify', { error: (...args) => notices.push(args) })
        .factory('$templateRequest', ['$q', q => () => q.resolve('<div></div>')])
        .value('gettext', x => x).value('hotkeys', { ESC: 27, on(scope, fn) { scope.escape = fn; } })
        .value('$http', Object.fromEntries(['get', 'post'].map(method => [method, (url, data) => {
            calls.push({ method, url, data });
            return { then: fn => fn({ data: 'fixture' }) };
        }])));
    for (const name of ['ace.es', 'filesystem.service.es', 'fileDialog.es', 'pathSelector.es']) window.eval(source(`files/${name}`));
    const injector = window.angular.injector(['ng', 'ajenti.ace', 'ajenti.filesystem']);
    const filesystem = injector.get('filesystem');
    filesystem.list = path => { calls.push(path); return injector.get('$q').resolve({ items, parent: path === '/' ? null : '/' }); };
    // The dialog wrapper/layout is independent of the directive's selection contract.
    injector.get('$templateCache').put('/filesystem:resources/js/directives/fileDialog.html', '<div></div>');
    const scope = injector.get('$rootScope');
    return {
        filesystem, calls, notices,
        mount(template, values = {}) {
            const parent = scope.$new(); Object.assign(parent, values);
            const element = injector.get('$compile')(template)(parent);
            scope.$digest();
            return { element, scope: element.isolateScope(), parent };
        },
        ace(options, aceOptions) {
            const directive = injector.get('aceEditorDirective')[0];
            const child = scope.$new(); Object.assign(child, { options, aceOptions });
            injector.invoke(directive.controller, null, { $scope: child });
            child.options.onLoad(editor);
            return child;
        },
        flush: () => scope.$digest(), close: () => window.close(),
    };
}
