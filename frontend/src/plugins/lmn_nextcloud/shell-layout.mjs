/**
 * Local Angular-shell transition until migration stage 8; no adapter extension.
 * Original: lmn_nextcloud/resources/js/controllers/index.controller.es:15–16.
 * Ajenti plugins/core/resources/js/core/controllers/root.controller.es:29–73
 * exposes toggleNavigation on $rootScope and toggleWidescreen on CoreRootController
 * (the <html> scope; lmn_common/resources/content/main_view.html:3).
 * Keep the original toggles, including their persistence and lack of restoration.
 */
export function toggleFullscreen() {
    const scope = window.angular.element(document.documentElement).scope();
    scope.$evalAsync(() => {
        scope.toggleNavigation();
        scope.toggleWidescreen();
    });
}
