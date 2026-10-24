angular.module('lmn.wireguard').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/wireguard', {
        templateUrl: '/lmn_wireguard:resources/partial/index.html',
    });
});

// Forward only shell layout state; backend access remains in the adapter.
angular.module('lmn.wireguard').directive('lmnWireguardLayout', () => ({
    restrict: 'A',
    link: ($scope) => {
        const off = $scope.$watch('showSidebar', (shown) => {
            window.dispatchEvent(new CustomEvent('lmn-wireguard-sidebar', { detail: shown }));
        });
        $scope.$on('$destroy', off);
    },
}));
