angular.module('lmn.users').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/users/listmanagement', {
        templateUrl: '/lmn_users:resources/partial/listmanagement.html',
    });
});
