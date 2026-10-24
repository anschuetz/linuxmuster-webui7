/** Plugin-local compatibility for Core config, deliberately outside shared aj.
 * Core config.service.es owns initialConfigContent and /api/core/config persistence;
 * The cache retains the selected language across route reloads; aj.locale loads the catalog.
 */
export function connectCore(aj, { config, $rootScope }) {
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
            setConfigLanguage: language => inDigest(() => {
                config.data = { ...config.data, language };
            }),
        },
    };
}
