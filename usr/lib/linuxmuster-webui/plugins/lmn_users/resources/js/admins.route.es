angular.module('lmn.users').config(($routeProvider) => {
    for (const view of ['globaladmins', 'schooladmins']) {
        $routeProvider.when('/view/lmn/users/' + view, {
            templateUrl: '/lmn_users:resources/partial/' + view + '.html',
        });
    }
});
