import { afterEach, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { dashboardOracle } from '../../test-fixtures/shell/dashboard.mjs';
import { createDashboard } from './dashboard.mjs';
import Dashboard from './Dashboard.vue';
import Widget from './Widget.vue';
import { formatUptime, formatBytes, sessionDate } from './widget-format.mjs';
import { createSessionList } from './session-list.mjs';
import SessionList from './SessionList.vue';
import { mountDashboardRoute } from './dashboard-routes.mjs';
const cleanups = [];
afterEach(() => { cleanups.splice(0).reverse().forEach(fn => fn()); vi.useRealTimers(); });
const clone = x => JSON.parse(JSON.stringify(x));
const widgetTypes = ['hostname','uptime','loadavg','cpu','memory','disk','sessions','datetime'].map(id => ({ id, name: id, config_template: ['disk','datetime'].includes(id) ? '/config' : null }));
function setup(config = {}) {
    const old = dashboardOracle(); cleanups.push(old.close);
    let fixture = config;
    old.respond((url, data) => url === '/api/core/user-config' ? clone(data ?? fixture) : url === '/api/dashboard/widgets' ? widgetTypes : url === '/api/dashboard/widgets-values' ? data.map(w => ({ id: w.id, data: ({sessions:true,cpu:[0,0.5],memory:{used:5,total:10},disk:{used:5,total:10},uptime:90061,loadavg:[0.1,0.2,0.3]})[w.typeId] ?? 'fixture' })) : url === '/api/filesystem/mountpoints' ? ['/', '/home'] : { z: { identity: 'synthetic', timestamp: 1700000000, client_info: { address: '192.0.2.1' } } });
    const aj = { http: old.http, gettext: x => x, identity: { isSuperuser: true }, pageTitle: { set: vi.fn() }, messagebox: { prompt: vi.fn(async () => ({ value: 'Other' })), show: vi.fn(async () => {}) } };
    const oldModel = old.controller('DashboardIndexController');
    const model = createDashboard(aj); cleanups.push(model.dispose);
    return { old, aj, oldModel, model, respond: fn => old.respond(fn) };
}
function render(Component, props, aj) { const ui = mount(Component, { props, global: { provide: { aj } } }); cleanups.push(() => ui.unmount()); return ui; }

it('migrates old configuration and defaults identically without saving or polling before 1s', async () => {
    vi.useFakeTimers(); const s = setup({ other: 'retained', dashboard: { widgetsLeft: [{ id: 'old', typeId: 'hostname' }], widgetsRight: [] } });
    await s.model.start(); await flushPromises();
    expect(s.model.state.userConfig).toEqual(s.oldModel.userConfig); expect(s.model.state.ready).toBe(false);
    expect(s.old.requests.filter(x => x[0] === 'post')).toEqual([]);
    await vi.advanceTimersByTimeAsync(1000); expect(s.model.state.ready).toBe(true);
    expect(s.old.requests.find(x => x[1].endsWith('widgets-values'))[2]).toEqual([{ id: 'old', typeId: 'hostname', config: {} }]);
    s.old.intervals[0].fn(); await flushPromises(); expect(s.oldModel.ready).toBe(true);
    s.model.dispose(); s.oldModel.$destroy(); const n = s.old.requests.length; await vi.advanceTimersByTimeAsync(2000); expect(s.old.requests).toHaveLength(n); expect(s.old.intervals[0].cancelled).toBe(true);
    const defaults = setup(); await defaults.model.start(); await flushPromises(); expect(defaults.model.state.userConfig).toEqual(defaults.oldModel.userConfig);
});
it('retains IDs, custom fields, all tabs and config in value requests and whole-config saves', async () => {
    const config = { other: { keep: true }, dashboard: { tabs: [{ name: 'A', width: 1, widgetsLeft: [{ id: 'd', typeId: 'disk', config: { mountpoint: '/' } }], widgetsRight: [{ id: 'dt', typeId: 'datetime', config: { format: '%H:%M' } }] }, { name: 'B', widgetsLeft: [{ id: 'h', typeId: 'hostname' }], widgetsRight: [] }] } };
    const s = setup(config); await s.model.start(); await flushPromises(); await s.model.refresh(); s.oldModel.refresh(); await flushPromises();
    const posts = s.old.requests.filter(x => x[1].endsWith('widgets-values')); expect(posts[0][2]).toEqual(posts[1][2]); expect(posts[0][2].map(x => x.id)).toEqual(['d','dt','h']);
    await s.model.save(); await s.oldModel.save(); expect(s.old.requests.filter(x => x[1].endsWith('user-config') && x[0] === 'post').map(x => x[2])).toEqual([config,config]);
});
it('adds, renames and removes tabs like the original, ignoring empty and cancelled prompts', async () => {
    const s = setup(); await s.model.start(); await flushPromises();
    await s.model.addTab(); await s.oldModel.addTab(); await flushPromises();
    await s.model.renameTab(0); s.oldModel.renameTab(0); await flushPromises();
    await s.model.removeTab(1); s.oldModel.removeTab(1); await flushPromises();
    expect(s.model.state.userConfig).toEqual(s.oldModel.userConfig);
    s.aj.messagebox.prompt.mockResolvedValue({ value: '' }); await s.model.addTab(); await s.model.renameTab(0); expect(s.model.state.userConfig.dashboard.tabs).toHaveLength(1);
    s.aj.messagebox.prompt.mockRejectedValue('cancel'); await s.model.addTab(); await s.model.renameTab(0);
    s.aj.messagebox.show.mockRejectedValue('cancel'); await s.model.removeTab(0); expect(s.model.state.userConfig.dashboard.tabs).toHaveLength(1);
});
it('adds original hexadecimal IDs without auto configuration; edits/saves config and removes either column', async () => {
    const s = setup(); await s.model.start(); await flushPromises(); vi.spyOn(Math, 'random').mockReturnValue(0.5);
    await s.model.addWidget(0, widgetTypes[7]); await s.oldModel.addWidget(0, widgetTypes[7]); await flushPromises();
    const widget = s.model.state.userConfig.dashboard.tabs[0].widgetsLeft.at(-1);
    expect(widget).toEqual(s.oldModel.userConfig.dashboard.tabs[0].widgetsLeft.at(-1)); expect(widget.id).toBe('8000000'); expect(s.model.state.configuredWidget).toBeNull();
    s.model.configureWidget(widget.id);
    const originalConfig = { configuredWidget: { config: {} } }; s.old.controller('lm.wdatetimeconfig', { $scope: originalConfig });
    expect(s.model.state.configuredWidget.config).toEqual(originalConfig.configuredWidget.config);
    s.model.updateWidgetConfig('format', '%H:%M'); await s.model.saveWidgetConfig(); expect(s.model.state.configuredWidget).toBeNull();
    await s.model.removeWidget(0,widget.id); await s.model.removeWidget(0,'w4'); expect(s.model.state.userConfig.dashboard.tabs[0].widgetsRight.map(w => w.id)).toEqual(['w5']);
    vi.restoreAllMocks();
});
it('persists drag order across columns, width and tab edits through actual controls', async () => {
    const s = setup(); await s.model.start(); await s.model.refresh(); const ui = render(Dashboard, { model: s.model }, s.aj);
    await ui.get('[data-action=width-1]').trigger('click'); expect(s.model.state.userConfig.dashboard.tabs[0].width).toBe(1);
    await ui.get('[data-action=width-2]').trigger('click');
    await ui.get('[data-widget=w1] [data-action=move]').trigger('dragstart', { dataTransfer: { setData() {} } });
    await ui.get('[data-column=widgetsRight]').trigger('drop'); await flushPromises();
    expect(s.model.state.userConfig.dashboard.tabs[0].widgetsRight.map(w => w.id)).toEqual(['w4','w5','w1']);
    await ui.get('[data-action=add-tab]').trigger('click'); await flushPromises(); await ui.get('[data-tab="1"]').trigger('click'); expect(s.model.state.activeTabIndex).toBe(1);
    await ui.get('[data-action=rename-tab]').trigger('click'); await ui.get('[data-action=remove-tab]').trigger('click'); await flushPromises();
    await ui.get('[data-add-widget=disk]').trigger('click'); await flushPromises(); const id=s.model.state.userConfig.dashboard.tabs[0].widgetsLeft.at(-1).id;
    await ui.get(`[data-widget="${id}"] [data-action=configure]`).trigger('click'); await flushPromises();
    expect(ui.get('[name=mountpoint]').findAll('option')).toHaveLength(3); await ui.get('[name=mountpoint]').setValue('/home'); await ui.get('[data-action=save-config]').trigger('click'); await flushPromises();
    expect(s.model.state.userConfig.dashboard.tabs[0].widgetsLeft.at(-1).config.mountpoint).toBe('/home');
    await ui.get(`[data-widget="${id}"] [data-action=remove]`).trigger('click');
});
it('honors customization controls and uses supplied default config', async () => {
    const s=setup(); const customization={ allowAdd:false,allowMove:false,allowRemove:false,allowConfigure:false,defaultConfig:{widgetsLeft:[],widgetsRight:[]} };
    const model=createDashboard(s.aj,{customization}); cleanups.push(model.dispose); await model.start(); await model.refresh(); const ui=render(Dashboard,{model},s.aj);
    expect(model.state.userConfig.dashboard.tabs[0].widgetsLeft).toEqual([]); expect(ui.find('[data-action=add-tab]').exists()).toBe(false);
});
it('retains loading/last data on failures and ignores late results after dispose', async () => {
    const s=setup(); await s.model.start(); s.respond(() => { throw {status:500}; }); await s.model.refresh(); expect(s.model.state.ready).toBe(false);
    s.respond((url,data) => data?.map(w=>({id:w.id,data:'old'}))); await s.model.refresh(); expect(s.model.state.values.w1).toBe('old');
    s.respond(() => { throw {status:403}; }); await s.model.refresh(); expect(s.model.state.values.w1).toBe('old'); expect(s.model.state.ready).toBe(true);
    let resolve; s.respond(() => new Promise(yes => {resolve=yes;})); const p=s.model.refresh(); await flushPromises(); s.model.dispose(); resolve([{id:'w1',data:'late'}]); await p; expect(s.model.state.values.w1).toBe('old');
    const failed=setup(); failed.respond(()=>{throw {status:500};}); await failed.model.start(); expect(failed.model.state.userConfig).toBeUndefined();
});
it('matches the five widget controllers and core time/bytes filters, preserving instance IDs', async () => {
    const s=setup();
    for (const [type,controller,data] of [['hostname','Hostname','<host>'],['uptime','Uptime',90061],['loadavg','LoadAverage',[0.25,0.5,1]],['cpu','CPU',[0,0.5,1]],['memory','Memory',{used:950,total:1000}]]) {
        const old=s.old.controller(`${controller}WidgetController`,{}); old.widget={id:'test'}; old.$broadcast('widget-update','wrong',data); old.$broadcast('widget-update','test',data);
        const ui=render(Widget,{widget:{id:'test',typeId:type},value:data},s.aj);
        if(type==='hostname') expect(ui.text()).toContain(old.hostname);
        if(type==='uptime') expect(ui.text()).toContain(s.old.filter('time',old.uptime));
        if(type==='cpu') {expect(ui.text()).toContain(`${old.cores}/${old.values.length}`);expect(ui.text()).toContain(`${old.avgPercent}%`);}
        if(type==='memory') {expect(ui.text()).toContain(`${old.usage}%`);expect(ui.text()).toContain(s.old.filter('bytes',old.total));}
        if(type==='loadavg') data.forEach(x=>expect(ui.text()).toContain(String(x)));
    }
    for(const x of [undefined,null,0,59,3600,86461]) expect(formatUptime(x)).toBe(s.old.filter('time',x));
    for(const x of [undefined,null,0,100,1024,1024**3]) expect(formatBytes(x,s.aj.gettext)).toBe(s.old.filter('bytes',x));
    expect(sessionDate(1700000000)).toBe(s.old.filter('date',1700000000*1000,'dd MMMM yyyy HH:mm:ss'));
});
it('renders disk, datetime, unknown values, hideTotal and warning thresholds without fetching templates', async () => {
    const s=setup(); const disk=render(Widget,{widget:{id:'d',typeId:'disk',config:{mountpoint:'/home',hideTotal:true}},value:{used:99,total:100}},s.aj);
    expect(disk.text()).toContain('Filesystem: /home'); expect(disk.text()).toContain('99%'); expect(disk.text()).not.toContain('Total'); expect(disk.find('.badge.bg-danger').exists()).toBe(true);
    const date=render(Widget,{widget:{id:'dt',typeId:'datetime'},value:'24.10.2026 17:00'},s.aj); expect(date.text()).toContain('24.10.2026 17:00'); await date.setProps({value:''}); expect(date.text()).toContain('Unknown');
    const empty=render(Widget,{widget:{id:'x',typeId:'unknown'}},s.aj); expect(empty.text()).toBe('');
});
it('refreshes session widgets only on their truthy update and retains results when false/forbidden',async()=>{
    const s=setup({dashboard:{tabs:[{name:'S',widgetsLeft:[{id:'s',typeId:'sessions'}],widgetsRight:[]}]}}); await s.model.start(); await s.model.refresh();
    expect(s.model.state.sessions.s.z.identity).toBe('synthetic');
    const old=s.old.controller('SessionWidgetController');old.widget={id:'s'};old.$broadcast('widget-update','other',true);old.$broadcast('widget-update','s',false); expect(old.sessions).toBeUndefined();old.$broadcast('widget-update','s',true);await flushPromises();expect(old.sessions).toEqual(s.model.state.sessions.s); expect(s.old.errors.at(-1).message).toContain("Cannot create property 'date'");
    s.respond(()=>[{id:'s',data:false}]);const n=s.old.requests.filter(x=>x[1].endsWith('/sessions')).length;await s.model.refresh();expect(s.old.requests.filter(x=>x[1].endsWith('/sessions'))).toHaveLength(n);
    const ui=render(Widget,{widget:{id:'s',typeId:'sessions'},sessions:s.model.state.sessions.s},s.aj);expect(ui.text()).toContain('synthetic');expect(ui.text()).toContain('192.0.2.1');
});
it('ports session_list independently: immediate GET, 15s polling, root guard, dates/count and cleanup',async()=>{
    vi.useFakeTimers();const s=setup(); const old=s.old.controller('SessionListIndexController'); const model=createSessionList(s.aj,{session_max_time:3600});cleanups.push(model.dispose);await model.start();await flushPromises();
    expect(model.state.sessions).toEqual(old.sessions);expect(model.state.number).toBe(old.number);
    const ui=render(SessionList,{model},s.aj);expect(ui.text()).toContain('User');expect(ui.text()).toContain(sessionDate(1700003600));
    const n=s.old.requests.length;await vi.advanceTimersByTimeAsync(15000);expect(s.old.requests.length).toBe(n+1);model.dispose();await vi.advanceTimersByTimeAsync(15000);expect(s.old.requests.length).toBe(n+1);
    const denied={...s.aj,identity:{isSuperuser:false}};const deniedModel=createSessionList(denied);cleanups.push(deniedModel.dispose);const deniedUi=render(SessionList,{model:deniedModel},denied);expect(deniedUi.text()).toContain('Superuser access required');expect(deniedUi.find('table').exists()).toBe(false);
});
it('mounts only the two isolated routes and stops their timers at unmount',async()=>{
    vi.useFakeTimers();const s=setup();const el=document.createElement('div'); const stop=mountDashboardRoute(el,{aj:s.aj,path:'/view/dashboard'});await flushPromises();await vi.advanceTimersByTimeAsync(1000);await flushPromises();expect(el.textContent).toContain('Hostname');stop();const n=s.old.requests.length;await vi.advanceTimersByTimeAsync(2000);expect(s.old.requests.length).toBe(n);
    const stopList=mountDashboardRoute(el,{aj:s.aj,path:'/view/session_list',initialConfig:{session_max_time:3600}});await flushPromises();expect(el.textContent).toContain('synthetic');stopList();expect(()=>mountDashboardRoute(el,{aj:s.aj,path:'/view/lmn/landingpage'})).toThrow('Unknown dashboard route');
});

it('keeps list data/loading on 403/500, discards late list and initialization replies', async () => {
    const s = setup(); await s.model.start(); await flushPromises();
    const list = createSessionList(s.aj, { session_max_time: 3600 }); cleanups.push(list.dispose);
    s.respond(() => { throw { status: 403 }; }); await list.start(); expect(list.state.sessions).toBeUndefined();
    const row = { one: { identity: 'test', timestamp: 1700000000, client_info: { address: '192.0.2.2' } } };
    s.respond(() => row); await list.refresh(); s.respond(() => { throw { status: 500 }; }); await list.refresh(); expect(list.state.sessions).toEqual(row);
    let answer; s.respond(() => new Promise(resolve => { answer = resolve; })); const pending = list.refresh(); await flushPromises(); list.dispose(); answer({}); await pending; expect(list.state.sessions).toEqual(row);
    const pendingModel = createDashboard(s.aj); cleanups.push(pendingModel.dispose);
    s.respond(() => row); const starting = pendingModel.start(); pendingModel.dispose(); await starting; expect(pendingModel.state.userConfig).toBeUndefined();
});
it('moves within a column before the drop target and retains other configuration fields', async () => {
    const s = setup(); await s.model.start(); await s.model.refresh(); const ui = render(Dashboard, { model: s.model }, s.aj);
    await ui.get('[data-widget=w1] [data-action=move]').trigger('dragstart', { dataTransfer: { setData() {} } });
    await ui.get('[data-widget=w3]').trigger('drop'); await flushPromises();
    expect(s.model.state.userConfig.dashboard.tabs[0].widgetsLeft.map(w => w.id)).toEqual(['w2','w1','w3']);
});
it('keeps session date coercion consistent with Angular for absent timeout and numeric strings', () => {
    const s = setup();
    for (const value of [0, '1700000000', NaN]) expect(sessionDate(value)).toBe(String(s.old.filter('date',value*1000,'dd MMMM yyyy HH:mm:ss')));
});

it('matches original templates for session timestamps, uptime and visible warning content', async () => {
    const s = setup(); await s.model.start(); await flushPromises();
    const old = s.old.controller('SessionListIndexController'); await flushPromises();
    const original = s.old.mount(s.old.template('sessions/index.html'), old);
    const model = createSessionList(s.aj, { session_max_time: '3600' }); cleanups.push(model.dispose); await model.start();
    const ui = render(SessionList, { model }, s.aj);
    expect(ui.get('tbody').text().replace(/\s+/g,'')).toBe(original[2].querySelectorAll('tr')[1].textContent.replace(/\s+/g,''));
    const scope = s.old.controller('UptimeWidgetController'); scope.widget = { id: 'u' };
    const template = s.old.mount(s.old.template('dashboard/widgets/uptime.html').replace('ng:controller="UptimeWidgetController"',''), scope);
    scope.$broadcast('widget-update','u',86461); s.old.flush();
    expect(render(Widget, { widget: { id:'u',typeId:'uptime' }, value:86461 }, s.aj).text().replace(/\s+/g,'')).toBe(template[0].textContent.replace(/\s+/g,''));
});

it.each(['global-admin','school-admin','teacher'])('matches original root-access blocker for %s without suppressing the protected GET', async () => {
    const s = setup(); await s.model.start(); await flushPromises(); s.old.identity.isSuperuser = false;
    const old = s.old.controller('SessionListIndexController'); const template = s.old.mount(s.old.template('sessions/index.html'),old);
    await flushPromises(); const original = template[2];
    const aj = { ...s.aj, identity: { isSuperuser: false } }; const model = createSessionList(aj); cleanups.push(model.dispose); await model.start();
    const ui = render(SessionList, { model }, aj);
    expect(ui.text()).toBe(original.textContent.trim()); expect(ui.find('table').exists()).toBe(false);
});


it('matches original widget templates for populated and empty display values', () => {
    const s = setup();
    const compact = text => text.replace(/\s+/g, '');
    const parts = (root, selector) => [...(root.matches(selector) ? [root] : []), ...root.querySelectorAll(selector)]
        .filter(node => !node.closest('.ng-hide')).map(node => compact(node.textContent));
    const sessions = { one: { identity: 'synthetic', client_info: { address: '192.0.2.1' } } };
    for (const [type, controller, path, values] of [
        ['cpu', 'CPUWidgetController', 'dashboard/widgets/cpu.html', [undefined, [], [0, 0.5, 1], [1]]],
        ['memory', 'MemoryWidgetController', 'dashboard/widgets/memory.html', [undefined, {used: 95, total: 100}]],
        ['disk', 'MemoryWidgetController', 'disk/widget.html', [undefined, {used: 95, total: 100}]],
        ['loadavg', 'LoadAverageWidgetController', 'dashboard/widgets/loadavg.html', [undefined, [], [0.1, 0.2, 0.3]]],
        ['sessions', 'SessionWidgetController', 'sessions/widget.html', [undefined, {}, sessions]],
        ['datetime', 'lm.wdatetime', 'datetime/partial/widget.html', [undefined, '', '24.10.2026 17:00']],
    ]) {
        for (const value of values) {
            for (const hideTotal of type === 'disk' || type === 'memory' ? [false, true] : [false]) {
                const widget = {id: 'oracle', typeId: type, config: {mountpoint: '/home', hideTotal}};
                const scope = s.old.controller(controller); scope.widget = widget;
                const original = s.old.mount(s.old.template(path).replace(/ng:controller="[^"]+"/, ''), scope)[0];
                // The shipped sessions update throws before assigning dates; its template only uses these fields.
                if (type === 'sessions') scope.sessions = value;
                else if (value !== undefined) scope.$broadcast('widget-update', widget.id, value);
                s.old.flush();
                const ui = render(Widget, {widget, value, sessions: type === 'sessions' ? value : undefined}, s.aj);
                for (const selector of ['.widget-header', '.widget-value', '.text-primary'])
                    expect(parts(ui.element, selector), `${type}: ${selector}`).toEqual(parts(original, selector));
                expect(ui.findAll('.badge.bg-danger').length).toBe(original.querySelectorAll('sup:not(.ng-hide) .label-danger').length);
            }
        }
    }
});

it('uses a draggable anchor handle and transfers its widget ID before dropping', async () => {
    const s = setup(); await s.model.start(); await s.model.refresh();
    const ui = render(Dashboard, {model: s.model}, s.aj);
    const handle = ui.get('[data-widget=w1] [data-action=move]');
    expect(handle.element.tagName).toBe('A');
    expect(handle.attributes('draggable')).toBe('true');
    const setData = vi.fn(); await handle.trigger('dragstart', {dataTransfer: {setData}});
    expect(setData).toHaveBeenCalledWith('text/plain', 'w1');
    await ui.get('[data-column=widgetsRight]').trigger('drop'); await flushPromises();
    expect(s.model.state.userConfig.dashboard.tabs[0].widgetsRight.at(-1).id).toBe('w1');
});
