angular.module('lmn.setup_wizard').config(function($routeProvider) {
    $routeProvider.when('/view/lmn/init/welcome', {
        templateUrl: '/lmn_setup_wizard:partial/init-welcome.html',
    })

    $routeProvider.when('/view/lmn/init/school', {
        templateUrl: '/lmn_setup_wizard:partial/init-school.html',
    })

    $routeProvider.when('/view/lmn/init/account', {
        templateUrl: '/lmn_setup_wizard:partial/init-account.html',
    })

    $routeProvider.when('/view/lmn/init/externalservices', {
        templateUrl: '/lmn_setup_wizard:partial/init-externalServices.html',
    })

    $routeProvider.when('/view/lmn/init/summary', {
        templateUrl: '/lmn_setup_wizard:partial/init-summary.html',
    })

    $routeProvider.when('/view/lmn/init/done', {
        templateUrl: '/lmn_setup_wizard:partial/init-done.html',
    })

    $routeProvider.when('/view/lmn/init/setup', {
        templateUrl: '/lmn_setup_wizard:partial/init-setup.html',
    })
})
