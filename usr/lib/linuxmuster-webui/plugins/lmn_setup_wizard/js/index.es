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

// Plugin-local Core config cache/persistence; language catalogs use aj.locale.
angular.module('lmn.setup_wizard').run((config, $rootScope) => {
    window.LmnVue_lmn_setup_wizard.configure({ config, $rootScope });
});
