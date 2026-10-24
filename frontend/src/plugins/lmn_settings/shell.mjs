/**
 * Temporary Angular-shell transition approved in CHAT #80 (F15).
 * Keep the complete existing Users Check → Results → Apply lifecycle; replace
 * this file with the shared Vue workflow when lmn_users is ported.
 * No backend request bypasses aj: this opens the still-Angular Users plugin.
 */
// CHAT #89 / F17: replace with the shell contract in migration stage 8.
export function readCustomization() {
    return window.angular.element(document.documentElement).injector().get('customization');
}

export function openUsersCheck() {
    const injector = window.angular.element(document.documentElement).injector();
    return new Promise((resolve, reject) => {
        injector.get('$rootScope').$evalAsync(() => {
            try {
                const modal = injector.get('$uibModal').open({
                    templateUrl: '/lmn_users:resources/partial/check.modal.html',
                    controller: 'LMUsersCheckModalController',
                    backdrop: 'static',
                });
                modal.result.then(resolve, reject);
            } catch (error) { reject(error); }
        });
    });
}
