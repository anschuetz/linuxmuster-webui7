// Example: <lmn-vue-mount entry="LmnVue_lmn_common"></lmn-vue-mount>
angular.module('lmn.common').directive('lmnVueMount', function($rootScope, $http, notify, gettext, identity, $location, pageTitle, messagebox) {
    return {
        restrict: 'E',
        link($scope, element, attrs) {
            window.LmnVueBridge.mountBridge($scope, element[0], window[attrs.entry], {
                $rootScope, $http, notify, gettext, identity, $location, pageTitle, messagebox
            });
        }
    };
});
