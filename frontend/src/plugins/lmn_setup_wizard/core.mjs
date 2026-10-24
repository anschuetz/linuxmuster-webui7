/** Plugin-local compatibility for Core config/locale, deliberately outside shared aj.
 * Core config.service.es owns initialConfigContent and /api/core/config persistence;
 * gettext.service.es owns /resources/all.locale.js and the shell's gettext catalog.
 * Keeping these existing services also preserves the selected language across reloads.
 */
export function connectCore(aj, { config, locale, $rootScope }) {
    const inDigest = callback => new Promise((resolve, reject) => {
        $rootScope.$evalAsync(() => {
            try { resolve(callback()); } catch (error) { reject(error); }
        });
    });
    return {
        ...aj,
        wizard: {
            readConfig: () => ({ ...config.data }),
            saveConfig: data => inDigest(() => {
                config.data = { ...data };
                return config.save();
            }),
            setLanguage: language => inDigest(() => {
                config.data = { ...config.data, language };
                return locale.setLanguage(language);
            }),
        },
    };
}
