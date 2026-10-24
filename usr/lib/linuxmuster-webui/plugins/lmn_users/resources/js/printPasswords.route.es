angular.module('lmn.users').config(($routeProvider) => {
    $routeProvider.when('/view/lmn/users/print-passwords', {
        templateUrl: '/lmn_users:resources/partial/print-passwords.html',
    });
});
