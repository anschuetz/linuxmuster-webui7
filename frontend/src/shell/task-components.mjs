import { createApp, defineComponent, h, onBeforeUnmount, onMounted, ref } from 'vue';
import { createPlugins } from './plugins.mjs';

export const TaskSidebar = defineComponent({
    props: { aj: { type: Object, required: true } },
    setup(props) {
        return () => h('div', { class: 'shell-tasks' }, props.aj.tasks.state.tasks.map(task => {
            const progress = task.progress ?? {}, t = props.aj.gettext ?? (text => text);
            const percent = progress.total ? Number((100 * progress.done / progress.total).toFixed(2)) : 100;
            return h('div', { key: task.id, class: 'task-status animate-list' }, [
                h('div', { class: 'float-start' }, [h('i', { class: 'fa fa-spinner fa-spin', 'aria-hidden': true })]),
                h('h5', t(task.name)), h('div', { class: 'progress' }, [h('div', { class: ['progress-bar bg-warning shell-task-progress', !progress.total && 'indeterminate'],
                    role: 'progressbar', 'aria-valuenow': progress.done, 'aria-valuemax': progress.total,
                    style: { width: `${percent}%` } })]), h('div', { class: 'values' }, [h('span', { class: 'float-start no-wrap' }, t(progress.message) || '...')]),
            ]);
        }));
    },
});
const safeLink = value => /^(https?:\/\/|mailto:)/i.test(value ?? '') ? value : undefined;
// Angular filter's primitive substring/negation rules for repository metadata.
function matches(value, query) {
    if (query.startsWith('!')) return !matches(value, query.slice(1));
    if (value == null) return false;
    if (typeof value === 'object') return Object.entries(value).some(([key, item]) => !key.startsWith('$') && matches(item, query));
    return String(value).toLowerCase().includes(query);
}
export const PluginsPage = defineComponent({
    props: { owner: { type: Object, required: true }, gettext: { type: Function, default: text => text } },
    setup(props) {
        const tab = ref('official'), filter = ref('');
        const button = (text, action, attrs = {}) => h('button', { type: 'button', class: 'btn btn-light shell-rest-button btn-flat', onClick: action, ...attrs }, props.gettext(text));
        const sort = list => [...(list ?? [])].sort((a, b) => {
            const x = a.title.toLowerCase(), y = b.title.toLowerCase(); return x < y ? -1 : x > y ? 1 : 0;
        });
        const interpolate = (text, values) => props.gettext(text).replace(/{{([^}]+)}}/g, (_, key) => values[key]);
        function details(plugin, installed, owner) {
            if (!plugin) return null;
            const close = () => { owner.state[installed ? 'selectedInstalledPlugin' : 'selectedRepoPlugin'] = null; };
            const fields = installed ? ['name', 'version', 'path', 'author', 'author_email'] : ['name', 'version', 'pypi_name', 'last_month_downloads', 'author', 'author_email'];
            return h('section', { role: 'dialog', 'aria-modal': true, class: 'modal show', style: { display: 'block' } }, [h('div', { class: 'modal-dialog' }, [
                h('div', { class: 'modal-content' }, [h('div', { class: 'modal-header' }, [h('h4', [installed && h('i', { class: `fa fa-${plugin.icon}` }), plugin.title])]),
                    h('div', { class: 'modal-body scrollable' }, [
                        ...fields.map(field => h('div', { class: 'shell-rest-field' }, [h('label', props.gettext(({ name: 'Name', version: 'Version', path: 'Location', author: 'Author', pypi_name: 'PyPI ID', last_month_downloads: 'Downloads in the last month' })[field] ?? '' )), h('div', String(plugin[field] ?? ''))])),
                        plugin.crash && h('div', { class: 'alert alert-danger' }, [h('b', props.gettext('This plugin crashed with the following error:')),
                            plugin.crash.type === 'PluginDependency.Unsatisfied' && h('div', interpolate('This plugin requires plugin {{pluginName}}, which was unavailable during startup.', plugin.crash)),
                            plugin.crash.type === 'BinaryDependency.Unsatisfied' && h('div', interpolate('This plugin requires application binary {{binaryName}}, which was unavailable during startup.', plugin.crash)),
                            h('div', `Exception: ${plugin.crash.cls}`), h('div', `Message: ${plugin.crash.message}`)]),
                        ...['url', 'documentation'].filter(field => plugin[field]).map(field => h('div', [h('a', { href: safeLink(plugin[field]), target: '_blank', rel: 'noopener noreferrer' }, props.gettext(field === 'url' ? 'Homepage' : 'Documentation'))])),
                    ]), h('div', { class: 'modal-footer' }, [
                        (!installed || owner.getUpgrade(plugin)) && button(installed ? 'Update' : 'Install', () => owner.installPlugin(plugin)),
                        installed && owner.isUninstallable(plugin) && button('Uninstall', () => owner.uninstallPlugin(plugin)),
                        button('Close', close, { 'data-action': 'close' }),
                    ])]),
            ])]);
        }
        return () => {
            const owner = props.owner, s = owner.state, t = props.gettext;
            if (!s.allowed) return h('div', { class: 'text-center root-access-blocker' }, [h('i', { class: 'fa fa-lock' }), h('h3', t('Superuser access required'))]);
            const repository = sort(s.repoList).filter(plugin => (plugin.type === 'official') === (tab.value === 'official'))
                .filter(plugin => tab.value !== 'community' || matches(plugin, filter.value.trim().toLowerCase()));
            return h('div', { class: 'shell-plugins' }, [
                h('div', { class: 'alert alert-warning' }, t('AngularJS plugins are not supported. Install only plugins implementing the Vue mount contract.')),
                owner.isAnythingUpgradeable() && h('div', [h('h3', t('Updates')), button('Update everything', owner.upgradeEverything)]),
                h('h3', t('Core')), h('div', { class: `alert alert-${s.coreUpgradeAvailable ? 'warning' : 'info'}` },
                    interpolate(s.coreUpgradeAvailable ? 'Ajenti core {{ajentiVersion}}. An upgrade to {{coreUpgradeAvailable}} is available.' : 'Ajenti Core version {{ajentiVersion}}, no upgrades available.', { ajentiVersion: s.version, coreUpgradeAvailable: s.coreUpgradeAvailable })),
                h('h3', t('Installed plugins')), s.installedPlugins == null && h('i', { class: 'fa fa-spinner fa-spin', role: 'status' }),
                h('div', { class: 'list-group' }, sort(s.installedPlugins).map(plugin => h('div', { class: 'list-group-item' }, [
                    owner.isUninstallable(plugin) && button('Uninstall', () => owner.uninstallPlugin(plugin)),
                    button(`${plugin.title} ${plugin.name} ${plugin.version}`, () => { s.selectedInstalledPlugin = plugin; }, { 'data-plugin': plugin.name }),
                    owner.getUpgrade(plugin) && h('span', { class: 'badge bg-info shell-stock-label' }, interpolate('Upgradeable to {{getUpgrade(plugin).version}}', { 'getUpgrade(plugin).version': owner.getUpgrade(plugin).version })),
                    plugin.crash && h('span', { class: 'badge bg-danger shell-stock-label' }, t('Loading error')),
                ]))),
                h('h3', t('Available plugins')), s.repoList == null ? h('i', { class: 'fa fa-spinner fa-spin', role: 'status' }) : h('div', [
                    button('Official', () => { tab.value = 'official'; }, { 'data-tab': 'official' }),
                    s.repoList.some(plugin => plugin.type !== 'official') && button('Community', () => { tab.value = 'community'; }, { 'data-tab': 'community' }),
                    tab.value === 'community' && h('input', { type: 'search', class: 'form-control', placeholder: t('Filter'), value: filter.value, onInput: e => { filter.value = e.target.value; } }),
                    h('div', { class: 'list-group' }, repository.map(plugin => h('div', { class: 'list-group-item' }, [
                        !owner.isInstalled(plugin) && button('Install', () => owner.installPlugin(plugin)),
                        button(`${plugin.title} ${plugin.name} ${plugin.version}`, () => { s.selectedRepoPlugin = plugin; }, { 'data-repo': plugin.name }),
                        owner.isInstalled(plugin) && h('span', { class: 'badge bg-info shell-stock-label' }, t('Installed')),
                    ]))),
                ]),
                details(s.selectedInstalledPlugin, true, owner), details(s.selectedRepoPlugin, false, owner),
                h('div', { class: 'floating-toolbar' }, [button('Restart panel', owner.restart)]),
            ]);
        };
    },
});

/** Explicit route mount for the future RouteHost; no current route is registered. */
export function mountPlugins(element, aj, options) {
    const owner = createPlugins(aj, options);
    const app = createApp(defineComponent({ setup() {
        onMounted(() => { void owner.start(); }); onBeforeUnmount(owner.dispose);
        return () => h(PluginsPage, { owner, gettext: aj.gettext });
    } }));
    app.mount(element); return () => app.unmount();
}
