angular.module('lmn.quotas').config ($routeProvider) ->
    $routeProvider.when '/view/lmn/quotas',
        templateUrl: '/lmn_quotas:resources/partial/index.html'
    $routeProvider.when '/view/lmn/quotas-disabled',
        templateUrl: '/lmn_quotas:resources/partial/disabled.html'
