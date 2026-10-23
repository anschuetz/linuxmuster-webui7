angular.module('lmn.devices').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/devices', {
        templateUrl: '/lmn_devices:resources/partial/index.html',
    });
});

// Keep the original Angular route cancellation local to this plugin.
angular.module('lmn.devices').directive('lmnDevicesLeaveGuard', () => ({
    restrict: 'A',
    link: ($scope) => {
        const off = $scope.$on('$locationChangeStart', (event) => {
            if (!window.dispatchEvent(new Event('lmn-devices-leave', { cancelable: true }))) {
                event.preventDefault();
            }
        });
        const offSidebar = $scope.$watch('showSidebar', (shown) => {
            window.dispatchEvent(new CustomEvent('lmn-devices-sidebar', { detail: shown }));
        });
        $scope.$on('$destroy', () => { off(); offSidebar(); });
    },
}));
