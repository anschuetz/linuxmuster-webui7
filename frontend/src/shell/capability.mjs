import { onScopeDispose, reactive, readonly } from 'vue';

// Only the transition facade knows Angular; existing adapter/bootstrap stay unchanged.
const connections = new WeakMap();
export function useShell(aj) {
    if (aj.shell) return aj.shell;
    const element = window.angular.element(document.documentElement), scope = element.scope();
    let connection = connections.get(scope);
    if (!connection) {
        const layout = reactive({ sidebar: Boolean(scope.showSidebar), widescreen: Boolean(scope.isWidescreen), overlay: Boolean(scope.showOverlaySidebar) });
        const stops = [['showSidebar', 'sidebar'], ['isWidescreen', 'widescreen'], ['showOverlaySidebar', 'overlay']]
            .map(([name, field]) => scope.$watch(name, value => { layout[field] = Boolean(value); }));
        connection = { count: 0, stops, capability: {
            layout: readonly(layout), customization: readonly(element.injector().get('customization')),
            ...Object.fromEntries(['toggleNavigation', 'toggleWidescreen', 'toggleOverlayNavigation'].map(name =>
                [name, value => scope.$evalAsync(() => scope[name](value))])),
        } };
        connections.set(scope, connection);
    }
    connection.count += 1;
    onScopeDispose(() => {
        connection.count -= 1;
        if (connection.count === 0) { connection.stops.forEach(stop => stop()); connections.delete(scope); }
    });
    return connection.capability;
}
