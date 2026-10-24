import { computed, reactive } from 'vue';

/** /view/plugins model; all I/O goes through the supplied Angular-free aj. */
export function createPlugins(aj, { version = '' } = {}) {
    const { http, tasks, identity, notify, messagebox } = aj;
    const gettext = aj.gettext ?? (text => text);
    const state = reactive({ installedPlugins: undefined, repoList: undefined, pypiList: undefined,
        coreUpgradeAvailable: null, selectedInstalledPlugin: null, selectedRepoPlugin: null,
        version, allowed: computed(() => identity.isSuperuser), error: null });
    let disposed = false;
    const report = (title, error) => { if (!disposed) notify.error(gettext(title), error?.message); };
    function needUpgrade(local, remote) {
        if (remote === null) { notify.error(gettext('Could not load repository version for ajenti-panel.')); return false; }
        if (local === remote) return false;
        const a = local.split('.'), b = remote.split('.');
        for (let i = 0; i <= Math.min(a.length, b.length); i++) {
            if (parseInt(a[i]) < parseInt(b[i])) return true;
            if (parseInt(a[i]) > parseInt(b[i])) return false;
        }
        return a.length < b.length;
    }
    async function refresh() {
        if (disposed || !state.allowed) return;
        const installed = http.get('/api/plugins/installed').then(async ({ data }) => {
            if (disposed) return;
            state.installedPlugins = data; state.repoList = null;
            try {
                const response = await http.get('/api/plugins/pypi/ajenti-plugins');
                if (!disposed) state.repoList = response.data;
            } catch (error) { report('Could not load plugin repository', error); }
        }, error => report('Could not load the installed plugin list', error));
        const core = http.post('/api/plugins/core/check-upgrade').then(({ data }) => {
            if (!disposed) state.coreUpgradeAvailable = needUpgrade(version, data);
        }, error => { if (!disposed) state.error = error; });
        state.pypiList = null;
        const packages = http.get('/api/plugins/pypi/installed').then(({ data }) => {
            if (!disposed) state.pypiList = data;
        }, error => { if (!disposed) state.error = error; });
        await Promise.all([installed, core, packages]);
    }
    const getUpgrade = plugin => state.repoList?.find(item => item.name === plugin?.name && needUpgrade(plugin.version, item.version)) ?? null;
    const isInstalled = plugin => state.installedPlugins?.some(item => item.name === plugin.name) ?? false;
    const isUninstallable = plugin => state.pypiList && state.pypiList[plugin.name] && plugin.name !== 'core';
    function restartNotice(uninstalled = false) {
        if (disposed) return;
        void messagebox.show({ title: gettext('Done'),
            text: gettext(uninstalled ? 'Uninstalled. A panel restart is required.' : 'Installed. A panel restart is required.'),
            positive: gettext('Restart now'), negative: gettext('Later') }).then(() => {
            if (!disposed) return aj.forceRestart();
        }).catch(() => {}); // Later is a normal dismissal.
    }
    function clearSelection() { state.selectedRepoPlugin = null; state.selectedInstalledPlugin = null; }
    async function runPluginTask(cls, kwargs, title, progress) {
        try {
            const task = await tasks.start(`aj.plugins.plugins.tasks.${cls}`, [], kwargs);
            void task.promise.then(() => {
                if (!disposed) { void refresh(); restartNotice(cls === 'UnInstallPlugin'); }
            }, error => { if (!disposed) notify.error(gettext(title), error.error); }).finally(() => progress?.close());
        } catch (error) { progress?.close(); report(title, error); }
    }
    return {
        state, needUpgrade, refresh, getUpgrade, isInstalled, isUninstallable,
        isAnythingUpgradeable: () => !!state.installedPlugins && (state.coreUpgradeAvailable || state.installedPlugins.some(getUpgrade)),
        async start() { aj.pageTitle.set('Plugins'); await identity.refresh(); if (!disposed && state.allowed) await refresh(); },
        installPlugin(plugin) {
            if (disposed || !state.allowed) return Promise.resolve();
            clearSelection();
            const progress = messagebox.show({ progress: true, title: 'Installing' }); progress.catch(() => {});
            return runPluginTask('InstallPlugin', { name: plugin.name, version: (getUpgrade(plugin) ?? plugin).version }, 'Install failed', progress);
        },
        async uninstallPlugin(plugin) {
            if (disposed || !state.allowed) return;
            try {
                if (plugin.name === 'plugins') await messagebox.show({ title: gettext('Warning'),
                    text: gettext('This will remove the Plugins plugin. You can reinstall it later using PIP.'),
                    positive: gettext('Continue'), negative: gettext('Cancel') });
                if (disposed) return;
                clearSelection();
                await messagebox.show({ title: gettext('Uninstall'), text: gettext(`Uninstall ${plugin.name}?`),
                    positive: gettext('Uninstall'), negative: gettext('Cancel') });
                if (!disposed) await runPluginTask('UnInstallPlugin', { name: plugin.name }, 'Uninstall failed');
            } catch { /* Confirmation cancelled. */ }
        },
        async upgradeEverything() {
            if (disposed || !state.allowed) return;
            try {
                const task = await tasks.start('aj.plugins.plugins.tasks.UpgradeAll', [], {}); await task.promise;
                if (!disposed) { notify.success(gettext('All plugins updated')); restartNotice(); }
            } catch { if (!disposed) notify.error(gettext('Some plugins failed to update')); }
        },
        restart: () => { if (!disposed && state.allowed) return aj.restart(); },
        dispose() { disposed = true; clearSelection(); },
    };
}
