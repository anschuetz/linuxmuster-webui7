angular.module('lmn.common').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/change-school', {
        templateUrl: '/lmn_common:resources/partial/schoolswitcher.html',
    });
});
