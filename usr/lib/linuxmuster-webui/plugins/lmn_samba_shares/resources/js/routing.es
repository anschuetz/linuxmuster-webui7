angular.module('lmn.samba_shares').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/home', {
        templateUrl: '/lmn_samba_shares:resources/partial/index.html',
    });
});

// Shell layout only; Vue keeps the file operations and backend access.
angular.module('lmn.samba_shares').directive('lmnSambaSharesShell', () => ({
    restrict: 'A',
    link: ($scope) => {
        const off = $scope.$watch('showSidebar', (shown) => {
            window.dispatchEvent(new CustomEvent('lmn-samba-shares-sidebar', { detail: shown }));
        });
        $scope.$on('$destroy', off);
    },
}));
