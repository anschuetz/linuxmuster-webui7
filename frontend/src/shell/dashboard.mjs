import { reactive } from 'vue';

export const dashboardDefaults = {
    allowMove: true, allowRemove: true, allowConfigure: true, allowAdd: true,
    defaultConfig: {
        widgetsLeft: [{ id: 'w1', typeId: 'hostname' }, { id: 'w2', typeId: 'cpu' }, { id: 'w3', typeId: 'loadavg' }],
        widgetsRight: [{ id: 'w4', typeId: 'uptime' }, { id: 'w5', typeId: 'memory' }],
    },
};
const copy = value => JSON.parse(JSON.stringify(value));

/** Explicit route owner; all backend traffic goes through aj's HTTP/error policy. */
export function createDashboard(aj, { customization = dashboardDefaults } = {}) {
    const state = reactive({ userConfig: undefined, availableWidgets: [], ready: false, values: {}, sessions: {}, activeTabIndex: 0, configuredWidget: null, mountpoints: undefined });
    let alive = true, timer;
    const tabs = () => state.userConfig.dashboard.tabs;
    const widgets = () => tabs().flatMap(tab => tab.widgetsLeft.concat(tab.widgetsRight));
    function replaceTabs(next) { state.userConfig = { ...state.userConfig, dashboard: { ...state.userConfig.dashboard, tabs: next } }; }
    function updateWidget(id, fn) {
        replaceTabs(tabs().map(tab => ({ ...tab,
            widgetsLeft: tab.widgetsLeft.map(w => w.id === id ? fn(w) : w),
            widgetsRight: tab.widgetsRight.map(w => w.id === id ? fn(w) : w),
        })));
    }
    async function save() { return (await aj.http.post('/api/core/user-config', copy(state.userConfig))).data; }
    async function sessionUpdate(id) {
        try {
            const { data } = await aj.http.get('/api/session_list/sessions');
            if (alive) state.sessions = { ...state.sessions, [id]: data };
        } catch { /* aj owns HTTP errors; preserve the original last successful list. */ }
    }
    async function refresh() {
        try {
            const request = widgets().map(w => ({ id: w.id, typeId: w.typeId, config: copy(w.config || {}) }));
            const { data } = await aj.http.post('/api/dashboard/widgets-values', request, { ignoreLoadingBar: true });
            if (!alive) return;
            state.ready = true;
            const current = widgets();
            await Promise.all(data.map(async result => {
                const widget = current.find(w => w.id === result.id);
                if (!widget) return;
                state.values = { ...state.values, [result.id]: result.data };
                if (widget.typeId === 'sessions' && result.data) await sessionUpdate(widget.id);
            }));
        } catch { /* Loading and last values remain as in the original; aj reports failures. */ }
    }
    async function start() {
        aj.pageTitle.set(aj.gettext('Dashboard'));
        await Promise.all([
            aj.http.get('/api/dashboard/widgets').then(({ data }) => { if (alive) state.availableWidgets = data; }).catch(() => {}),
            aj.http.get('/api/core/user-config').then(({ data }) => {
                if (!alive) return;
                const dashboard = copy(data.dashboard || customization.defaultConfig);
                if (!dashboard.tabs) {
                    dashboard.tabs = [{ name: 'Home', width: 2, widgetsLeft: dashboard.widgetsLeft, widgetsRight: dashboard.widgetsRight }];
                    delete dashboard.widgetsLeft; delete dashboard.widgetsRight;
                }
                state.userConfig = { ...data, dashboard };
                timer = setInterval(() => { void refresh(); }, 1000);
            }).catch(() => {}),
        ]);
    }
    async function editTab(action, index) {
        try {
            if (action === 'remove') {
                await aj.messagebox.show({ text: aj.gettext(`Remove the '${tabs()[index].name}' tab?`), positive: aj.gettext('Remove'), negative: aj.gettext('Cancel') });
                if (!alive) return;
                replaceTabs(tabs().filter((_, i) => i !== index));
                state.activeTabIndex = Math.min(state.activeTabIndex, tabs().length - 1);
            } else {
                const { value } = await aj.messagebox.prompt(aj.gettext('New name'), action === 'rename' ? tabs()[index].name : undefined);
                if (!value || !alive) return;
                replaceTabs(action === 'add' ? [...tabs(), { widgetsLeft: [], widgetsRight: [], name: value }] : tabs().map((tab, i) => i === index ? { ...tab, name: value } : tab));
            }
            await save();
        } catch { /* Dialog rejection and HTTP errors have no additional notification. */ }
    }
    async function addWidget(index, type) {
        const widget = { id: Math.floor(Math.random() * 0x10000000).toString(16), typeId: type.id };
        replaceTabs(tabs().map((tab, i) => i === index ? { ...tab, widgetsLeft: [...tab.widgetsLeft, widget] } : tab));
        // The original checks config_template on the new instance (which has none).
        try { await save(); if (alive) await refresh(); } catch { /* aj reports save failures. */ }
    }
    async function removeWidget(index, id) {
        replaceTabs(tabs().map((tab, i) => i === index ? { ...tab, widgetsLeft: tab.widgetsLeft.filter(w => w.id !== id), widgetsRight: tab.widgetsRight.filter(w => w.id !== id) } : tab));
        try { await save(); } catch { /* aj reports save failures. */ }
    }
    async function configureWidget(id) {
        const widget = widgets().find(w => w.id === id);
        let config = { ...widget.config };
        if (widget.typeId === 'datetime' && config.format == null) config = { ...config, format: '%d.%m.%Y %H:%M' };
        updateWidget(id, w => ({ ...w, config }));
        state.configuredWidget = { ...widget, config };
        if (widget.typeId === 'disk') {
            state.mountpoints = undefined;
            try { const { data } = await aj.http.get('/api/filesystem/mountpoints'); if (alive && state.configuredWidget?.id === id) state.mountpoints = data; }
            catch { /* aj owns the failure; leave options unloaded. */ }
        }
    }
    function updateWidgetConfig(key, value) {
        const selected = state.configuredWidget;
        state.configuredWidget = { ...selected, config: { ...selected.config, [key]: value } };
        updateWidget(selected.id, w => ({ ...w, config: state.configuredWidget.config }));
    }
    async function saveWidgetConfig() {
        const pending = save(); state.configuredWidget = null;
        try { await pending; if (alive) await refresh(); } catch { /* aj reports failures. */ }
    }
    async function moveWidget(tabIndex, id, column, position) {
        const tab = tabs()[tabIndex], widget = tab.widgetsLeft.concat(tab.widgetsRight).find(w => w.id === id);
        if (!widget) return;
        const left = tab.widgetsLeft.filter(w => w.id !== id), right = tab.widgetsRight.filter(w => w.id !== id);
        const target = column === 'widgetsLeft' ? left : right;
        const previousIndex = tab[column].findIndex(w => w.id === id);
        const at = position === undefined ? target.length : position - (previousIndex >= 0 && previousIndex < position ? 1 : 0);
        const next = [...target.slice(0, at), widget, ...target.slice(at)];
        replaceTabs(tabs().map((t, i) => i === tabIndex ? { ...t, widgetsLeft: column === 'widgetsLeft' ? next : left, widgetsRight: column === 'widgetsRight' ? next : right } : t));
        try { await save(); } catch { /* aj reports failures. */ }
    }
    function setWidth(index, width) { replaceTabs(tabs().map((tab, i) => i === index ? { ...tab, width } : tab)); }
    return { state, customization, start, refresh, save, addWidget, removeWidget, configureWidget, updateWidgetConfig, saveWidgetConfig, moveWidget, setWidth,
        addTab: () => editTab('add'), renameTab: i => editTab('rename', i), removeTab: i => editTab('remove', i),
        dispose() { alive = false; clearInterval(timer); },
    };
}
