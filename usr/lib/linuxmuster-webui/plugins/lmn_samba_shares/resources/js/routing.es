angular.module('lmn.samba_shares').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/home', {
        templateUrl: '/lmn_samba_shares:resources/partial/index.html',
    });
});

// Shell layout only; Vue keeps the file operations and backend access.
angular.module('lmn.samba_shares').directive('lmnSambaSharesShell', ($localStorage) => ({
    restrict: 'A',
    link: ($scope) => {
        const off = $scope.$watch('showSidebar', (shown) => {
            window.dispatchEvent(new CustomEvent('lmn-samba-shares-sidebar', { detail: shown }));
        });
        // ngStorage writes every cached key on shell changes; keep its copy current.
        const clipboardChanged = (event) => { $localStorage.sambaSharesClipboard = event.detail; };
        window.addEventListener('lmn-samba-shares-clipboard', clipboardChanged);
        $scope.$on('$destroy', () => {
            off();
            window.removeEventListener('lmn-samba-shares-clipboard', clipboardChanged);
        });
    },
}));
