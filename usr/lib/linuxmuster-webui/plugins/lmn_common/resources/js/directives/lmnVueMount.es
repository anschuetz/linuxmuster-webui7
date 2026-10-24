// Example: <lmn-vue-mount entry="LmnVue_lmn_common"></lmn-vue-mount>
angular.module('lmn.common').directive('lmnVueMount', function($rootScope, $http, notify, gettextCatalog, identity, $location, $route, pageTitle, messagebox, toaster, core, locale) {
    return {
        restrict: 'E',
        link($scope, element, attrs) {
            window.LmnVueBridge.mountBridge($scope, element[0], window[attrs.entry], {
                $rootScope, $http, notify, toaster, gettextCatalog, identity, $location, $route, pageTitle, messagebox, core, locale
            });
        }
    };
});
