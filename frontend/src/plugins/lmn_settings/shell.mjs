// CHAT #89 / F17: replace with the shell contract in migration stage 8.
export function readCustomization() {
    return window.angular.element(document.documentElement).injector().get('customization');
}

// The same temporary shell seam supplies floatingToolbar's inherited
// showSidebar binding (Core floatingToolbar.es; local pattern as in P53).
export function watchSidebar(changed) {
    const scope = window.angular.element(document.documentElement).scope();
    changed(Boolean(scope.showSidebar));
    return scope.$watch('showSidebar', value => changed(Boolean(value)));
}
