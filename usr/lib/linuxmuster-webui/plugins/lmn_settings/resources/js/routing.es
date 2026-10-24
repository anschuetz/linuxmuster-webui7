angular.module('lmn.settings').config($routeProvider => {
    $routeProvider.when('/view/lmn/schoolsettings', {
        templateUrl: '/lmn_settings:resources/partial/index.html'
    }).when('/view/lmn/globalsettings', {
        templateUrl: '/lmn_settings:resources/partial/globalSettings.html'
    });
});

