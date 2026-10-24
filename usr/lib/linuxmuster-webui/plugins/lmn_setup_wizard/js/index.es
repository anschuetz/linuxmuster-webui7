angular.module('lmn.setup_wizard', [
    'core',
])

angular.module('lmn.setup_wizard').run(($http, $location, identity) => {
    identity.promise.then(() => {
      if (identity.user) {
        $http.get('/api/lmn/setup-wizard/is-configured').then(response => {
          if (!response.data) {
            $location.path('/view/lmn/init/welcome')
          }
        })
      }
    })
})

// Plugin-local Core compatibility; no shared adapter service is introduced.
angular.module('lmn.setup_wizard').run((config, locale, $rootScope) => {
    window.LmnVue_lmn_setup_wizard.configure({ config, locale, $rootScope });
});
