// Example: <lmn-vue-mount entry="LmnVueDemo"></lmn-vue-mount>
angular.module('lmn.common').directive('lmnVueMount', function($rootScope, $http, notify, gettext, identity, $location) {
    return {
        restrict: 'E',
        link($scope, element, attrs) {
            window.LmnVueDemo.mountBridge($scope, element[0], window[attrs.entry], {
                $rootScope, $http, notify, gettext, identity, $location
            });
        }
    };
});
