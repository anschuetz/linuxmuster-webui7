import { createAjentiAdapter } from '../adapter/ajenti.mjs';

/** Bind a Vue entry to one Angular scope; Angular retains routing ownership. */
export function mountBridge($scope, element, entry, services) {
    const aj = createAjentiAdapter({
        ...services,
        $location: { path: (path) => $scope.$evalAsync(() => services.$location.path(path)) },
        notify: Object.fromEntries(['success', 'info', 'warning', 'error'].map((level) => [
            level, (title, text) => $scope.$evalAsync(() => services.notify[level](title, text)),
        ])),
    });
    const unmount = entry.mount(element, aj);
    const offDestroy = $scope.$on('$destroy', () => {
        offDestroy();
        unmount();
    });
}
