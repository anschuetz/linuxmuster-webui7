angular.module('lmn.linbo4').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/linbo4', {
        templateUrl: '/lmn_linbo4:resources/partial/index.html',
    });
});

// Only shell layout crosses this directive; all plugin data uses the adapter.
angular.module('lmn.linbo4').directive('lmnLinbo4Shell', () => ({
    restrict: 'A',
    link: ($scope) => {
        const off = $scope.$watch('showSidebar', (shown) => {
            window.dispatchEvent(new CustomEvent('lmn-linbo4-sidebar', { detail: shown }));
        });
        $scope.$on('$destroy', off);
    },
}));
