angular.module('lmn.auth').config ($routeProvider) ->
    $routeProvider.when '/view/lmn/change-password',
        templateUrl: '/lmn_auth:resources/partial/index.html'
