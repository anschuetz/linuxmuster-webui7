import { describe, it, expect, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPlugins } from './plugins.mjs';
import { PluginsPage, TaskSidebar } from './task-components.mjs';
import { tasksOracle } from '../../test-fixtures/shell/tasks.mjs';

const local = [{ name: 'core', title: 'Core', version: '0.116', icon: 'cog' }, { name: 'demo', title: 'Demo', version: '1.2', icon: 'cube' }];
const repo = [{ name: 'demo', title: 'Demo', version: '1.3', type: 'official' }, { name: 'extra', title: 'Extra', version: '2', type: 'community' }];
function setup(superuser = true) {
    const requests = [], notices = [], dialogs = [];
    const respond = url => url.endsWith('/installed') ? (url.includes('/pypi/') ? { demo: 'ajenti.plugin.demo' } : local) : url.endsWith('check-upgrade') ? '2.3.0' : repo;
    const http = Object.fromEntries(['get', 'post'].map(method => [method, vi.fn((url, data) => { requests.push([method, url, data]); return Promise.resolve({ data: respond(url) }); })]));
    const notify = { success: (...a) => notices.push(['success', ...a]), error: (...a) => notices.push(['error', ...a]) };
    const messagebox = { show: vi.fn(options => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        const close = vi.fn(); dialogs.push({ options, resolve, reject, close }); return Object.assign(promise, { close }); }) };
    let done, fail;
    const tasks = { start: vi.fn(async () => ({ id: 'fixture', promise: new Promise((yes, no) => { done = yes; fail = no; }) })) };
    const aj = { http, notify, messagebox, tasks, identity: { isSuperuser: superuser, refresh: vi.fn().mockResolvedValue() },
        pageTitle: { set: vi.fn() }, restart: vi.fn(), forceRestart: vi.fn(), gettext: x => x };
    const owner = createPlugins(aj, { version: '2.2.17' });
    return { aj, owner, requests, notices, dialogs, done: () => done(), fail: value => fail(value), http, notify, messagebox };
}
describe('plugins fixture workflow', () => {
    it('matches original load order, versions, uninstall availability and task class/payload', async () => {
        const s = setup(), old = tasksOracle({ http: s.http, notify: s.notify, messagebox: s.messagebox });
        const scope = old.plugins(); await flushPromises(); const expectedRequests = [...s.requests]; s.requests.length = 0;
        await s.owner.start(); await flushPromises(); expect(s.requests).toEqual(expectedRequests);
        expect(s.owner.state.installedPlugins).toEqual(scope.installedPlugins); expect(s.owner.state.repoList).toEqual(scope.repoList);
        for (const [a, b] of [['1.2', '1.3'], ['1.20', '1.3'], ['1.2', '1.2.1'], ['1.2.1', '1.2'], ['1', null], ['1', '1']]) expect(s.owner.needUpgrade(a, b)).toBe(scope.needUpgrade(a, b));
        expect(s.owner.isUninstallable(local[0])).toBe(scope.isUninstallable(local[0]));
        expect(s.owner.isUninstallable(local[1])).toBe(scope.isUninstallable(local[1]));
        expect(s.owner.getUpgrade(local[1])).toEqual(scope.getUpgrade(local[1]));
        await s.owner.installPlugin(local[1]);
        expect(s.aj.tasks.start).toHaveBeenCalledWith('aj.plugins.plugins.tasks.InstallPlugin', [], { name: 'demo', version: '1.3' });
        s.done(); await flushPromises(); expect(s.dialogs[0].close).toHaveBeenCalledOnce();
        expect(s.dialogs.at(-1).options.text).toBe('Installed. A panel restart is required.');
        s.dialogs.at(-1).resolve(); await flushPromises(); expect(s.aj.forceRestart).toHaveBeenCalledOnce();
        s.owner.dispose(); old.close();
    });
    it('keeps original loading/error states and only loads for superuser', async () => {
        const s = setup(false); await s.owner.start(); expect(s.requests).toEqual([]);
        const wrapper = mount(PluginsPage, { props: { owner: s.owner } }); expect(wrapper.text()).toContain('Superuser access required'); wrapper.unmount();
        const failed = setup(); failed.http.get.mockRejectedValue(new Error('fixture denied')); failed.http.post.mockRejectedValue(new Error('fixture denied'));
        await failed.owner.start(); expect(failed.owner.state.installedPlugins).toBeUndefined(); expect(failed.owner.state.repoList).toBeUndefined();
        expect(failed.notices).toContainEqual(['error', 'Could not load the installed plugin list', 'fixture denied']);
        failed.owner.dispose(); s.owner.dispose();
    });
    it('requires both uninstall confirmations for plugins, cancellation does not start a task', async () => {
        const s = setup(); await s.owner.start();
        const operation = s.owner.uninstallPlugin({ name: 'plugins' }); expect(s.dialogs[0].options.title).toBe('Warning');
        s.dialogs[0].resolve(); await flushPromises(); expect(s.dialogs[1].options.text).toBe('Uninstall plugins?');
        s.dialogs[1].resolve(); await operation;
        expect(s.aj.tasks.start).toHaveBeenCalledWith('aj.plugins.plugins.tasks.UnInstallPlugin', [], { name: 'plugins' });
        s.done(); await flushPromises(); expect(s.dialogs.at(-1).options.text).toBe('Uninstalled. A panel restart is required.');
        s.dialogs.at(-1).reject(); await flushPromises(); expect(s.aj.forceRestart).not.toHaveBeenCalled();
        const cancelled = s.owner.uninstallPlugin(local[1]); s.dialogs.at(-1).reject(); await cancelled;
        expect(s.aj.tasks.start).toHaveBeenCalledTimes(1); s.owner.dispose();
    });
    it('upgrades all, handles task and start failures, and restarts through existing service', async () => {
        const s = setup(); await s.owner.start(); const all = s.owner.upgradeEverything(); await flushPromises();
        expect(s.aj.tasks.start).toHaveBeenCalledWith('aj.plugins.plugins.tasks.UpgradeAll', [], {});
        s.done(); await all; expect(s.notices).toContainEqual(['success', 'All plugins updated']);
        s.dialogs.at(-1).reject(); await flushPromises();
        const failed = s.owner.upgradeEverything(); await flushPromises(); s.fail({ exception: 'denied' }); await failed;
        expect(s.notices).toContainEqual(['error', 'Some plugins failed to update']);
        await s.owner.installPlugin(local[1]); s.fail({ error: 'install denied' }); await flushPromises(); expect(s.notices).toContainEqual(['error', 'Install failed', 'install denied']);
        s.aj.tasks.start.mockRejectedValueOnce(new Error('class denied')); await s.owner.installPlugin(local[1]);
        expect(s.dialogs.at(-1).close).toHaveBeenCalledOnce();
        s.owner.restart(); expect(s.aj.restart).toHaveBeenCalledOnce(); s.owner.dispose();
    });
    it('renders installed/repository details, tabs/filter, upgrade/uninstall and live task progress', async () => {
        const s = setup(); await s.owner.start();
        const wrapper = mount(PluginsPage, { props: { owner: s.owner } });
        expect(wrapper.text()).toContain('Update everything');
        await wrapper.get('[data-plugin="demo"]').trigger('click'); expect(wrapper.get('[role="dialog"]').text()).toContain('Update');
        await wrapper.get('[data-action="close"]').trigger('click');
        await wrapper.get('[data-tab="community"]').trigger('click'); await wrapper.get('input').setValue('absent'); expect(wrapper.find('[data-repo="extra"]').exists()).toBe(false);
        await wrapper.get('input').setValue(' Extra '); expect(wrapper.find('[data-repo="extra"]').exists()).toBe(true);
        await wrapper.get('[data-repo="extra"]').trigger('click'); expect(wrapper.get('[role="dialog"]').text()).toContain('Install');
        wrapper.unmount(); s.owner.dispose();
        const sidebar = mount(TaskSidebar, { props: { aj: { tasks: { state: { tasks: [{ id: 'T', name: 'Install', progress: { done: 2, total: 4, message: 'Working' } }] } }, gettext: x => x } } });
        expect(sidebar.text()).toContain('Working'); expect(sidebar.get('[role="progressbar"]').attributes('aria-valuenow')).toBe('2'); sidebar.unmount();
    });
});

describe('plugins original action oracle and route lifetime', () => {
    it('sends the same three action classes and arguments as the original controller', async () => {
        const s = setup(); await s.owner.start();
        const old = tasksOracle({ http: s.http, notify: s.notify, messagebox: s.messagebox });
        const oldStart = vi.fn(async () => ({ id: 'old-fixture', promise: new Promise(() => {}) })); old.tasks.start = oldStart;
        const scope = old.plugins(); await flushPromises();
        await scope.installPlugin(local[1]); await s.owner.installPlugin(local[1]);
        expect(s.aj.tasks.start.mock.calls.at(-1)).toEqual(oldStart.mock.calls.at(-1));
        void scope.upgradeEverything(); void s.owner.upgradeEverything(); await flushPromises();
        expect(s.aj.tasks.start.mock.calls.at(-1)).toEqual(oldStart.mock.calls.at(-1));
        const before = s.dialogs.length; const original = scope.uninstallPlugin(local[1]); s.dialogs[before].resolve(); await original;
        const after = s.dialogs.length; const actual = s.owner.uninstallPlugin(local[1]); s.dialogs[after].resolve(); await actual;
        expect(s.aj.tasks.start.mock.calls.at(-1)).toEqual(oldStart.mock.calls.at(-1));
        old.close(); s.owner.dispose();
    });
    it('renders crash and metadata safely, invokes install/update/uninstall/restart, and mounts/unmounts an explicit route', async () => {
        const { mountPlugins } = await import('./task-components.mjs');
        const s = setup(); await s.owner.start();
        s.owner.state.installedPlugins = [...local, { name: 'broken', title: 'Broken', version: '1', path: '/fixture', author: 'Demo', author_email: 'demo@example.test',
            url: 'javascript:alert(1)', documentation: 'https://example.test/docs', crash: { type: 'PluginDependency.Unsatisfied', pluginName: 'missing', cls: 'Error', message: '<script>fixture</script>' } }];
        const wrapper = mount(PluginsPage, { props: { owner: s.owner } });
        await wrapper.get('[data-plugin="broken"]').trigger('click'); expect(wrapper.get('[role="dialog"]').text()).toContain('<script>fixture</script>');
        expect(wrapper.get('[role="dialog"]').find('script').exists()).toBe(false);
        expect(wrapper.get('[role="dialog"] a').attributes('href')).toBeUndefined();
        await wrapper.get('[data-action="close"]').trigger('click');
        await wrapper.get('[data-plugin="demo"]').trigger('click');
        const update = wrapper.findAll('[role="dialog"] button').find(b => b.text() === 'Update'); await update.trigger('click');
        expect(s.aj.tasks.start).toHaveBeenCalledWith('aj.plugins.plugins.tasks.InstallPlugin', [], { name: 'demo', version: '1.3' });
        s.done(); await flushPromises(); s.dialogs.at(-1).reject(); await flushPromises();
        await wrapper.get('[data-tab="community"]').trigger('click'); await wrapper.get('[data-repo="extra"]').trigger('click');
        await wrapper.findAll('[role="dialog"] button').find(b => b.text() === 'Install').trigger('click');
        expect(s.aj.tasks.start).toHaveBeenLastCalledWith('aj.plugins.plugins.tasks.InstallPlugin', [], { name: 'extra', version: '2' });
        s.fail({ error: 'fixture' }); await flushPromises();
        await wrapper.findAll('button').find(b => b.text() === 'Restart panel').trigger('click'); expect(s.aj.restart).toHaveBeenCalledOnce();
        wrapper.unmount(); s.owner.dispose();
        const host = document.createElement('div'); document.body.append(host); const stop = mountPlugins(host, s.aj, { version: '2.2.17' });
        await flushPromises(); expect(host.textContent).toContain('Installed plugins'); stop(); expect(host.textContent).toBe(''); host.remove();
    });
    it('ignores late list responses after dispose and does not offer a restart after a late task', async () => {
        const s = setup(); let respond;
        s.http.get.mockImplementation(() => new Promise(resolve => { respond = resolve; }));
        void s.owner.start(); await flushPromises(); s.owner.dispose(); respond({ data: {} }); await flushPromises();
        expect(s.owner.state.pypiList).toBeNull();
        const active = setup(); await active.owner.start(); await active.owner.installPlugin(local[1]); const count = active.requests.length;
        active.owner.dispose(); active.done(); await flushPromises(); expect(active.requests).toHaveLength(count);
        expect(active.dialogs).toHaveLength(1); expect(active.dialogs[0].close).toHaveBeenCalledOnce();
    });
});

it('keeps loading indicators, both install entry points, uninstall and upgrade-all controls usable', async () => {
    const s = setup();
    const wrapper = mount(PluginsPage, { props: { owner: s.owner } });
    expect(wrapper.findAll('[role="status"]')).toHaveLength(2);
    expect(wrapper.text()).toContain('no upgrades available');
    await s.owner.start(); await flushPromises();
    await wrapper.get('[data-plugin="demo"]').trigger('click');
    await wrapper.findAll('[role="dialog"] button').find(b => b.text() === 'Uninstall').trigger('click');
    s.dialogs.at(-1).resolve(); await flushPromises(); s.fail({ error: 'fixture uninstall denied' }); await flushPromises();
    expect(s.notices).toContainEqual(['error', 'Uninstall failed', 'fixture uninstall denied']);
    await wrapper.findAll('button').find(b => b.text() === 'Update everything').trigger('click'); await flushPromises();
    s.fail({}); await flushPromises(); expect(s.notices).toContainEqual(['error', 'Some plugins failed to update']);
    await wrapper.get('[data-tab="community"]').trigger('click');
    await wrapper.findAll('button').find(b => b.text() === 'Install').trigger('click');
    expect(s.aj.tasks.start).toHaveBeenLastCalledWith('aj.plugins.plugins.tasks.InstallPlugin', [], { name: 'extra', version: '2' });
    s.fail({}); await flushPromises();
    await wrapper.get('[data-tab="official"]').trigger('click');
    await wrapper.findAll('button').find(b => b.text() === 'Uninstall').trigger('click');
    s.dialogs.at(-1).reject(); await flushPromises();
    wrapper.unmount(); s.owner.dispose();
    const sidebar = mount(TaskSidebar, { props: { aj: { tasks: { state: { tasks: [{ id: 'T', name: 'Working' }] } } } } });
    expect(sidebar.text()).toContain('...'); sidebar.unmount();
});

it('reports repository failure without inventing a loaded empty list', async () => {
    const s = setup(), original = s.http.get.getMockImplementation();
    s.http.get.mockImplementation((url, data) => url.endsWith('ajenti-plugins') ? Promise.reject(new Error('repository offline')) : original(url, data));
    await s.owner.start(); expect(s.owner.state.repoList).toBeNull();
    expect(s.notices).toContainEqual(['error', 'Could not load plugin repository', 'repository offline']); s.owner.dispose();
});


it('matches the real Angular repository filter including negation and literal punctuation', async () => {
    const s = setup(), old = tasksOracle({ http: s.http, notify: s.notify, messagebox: s.messagebox });
    await s.owner.start();
    const wrapper = mount(PluginsPage, { props: { owner: s.owner } }); await wrapper.get('[data-tab="community"]').trigger('click');
    for (const query of ['extra', '!extra', '!absent', '"', '2', 'COMMUNITY']) {
        await wrapper.get('input').setValue(query);
        expect(wrapper.findAll('[data-repo]').map(item => item.attributes('data-repo')))
            .toEqual(old.filter(repo.filter(item => item.type !== 'official'), query).map(item => item.name));
    }
    wrapper.unmount(); s.owner.dispose(); old.close();
});

it('does not issue writes through direct page actions for a denied identity or a disposed route', async () => {
    const denied = setup(false); await denied.owner.start();
    await denied.owner.installPlugin(local[1]); await denied.owner.uninstallPlugin(local[1]); await denied.owner.upgradeEverything(); denied.owner.restart(); await denied.owner.refresh();
    expect(denied.requests).toEqual([]); expect(denied.aj.tasks.start).not.toHaveBeenCalled(); expect(denied.dialogs).toEqual([]); expect(denied.aj.restart).not.toHaveBeenCalled();
    denied.owner.dispose();
    const disposed = setup(); await disposed.owner.start(); disposed.owner.dispose(); const count = disposed.requests.length;
    await disposed.owner.installPlugin(local[1]); await disposed.owner.uninstallPlugin(local[1]); await disposed.owner.upgradeEverything(); disposed.owner.restart(); await disposed.owner.refresh();
    expect(disposed.requests).toHaveLength(count); expect(disposed.aj.tasks.start).not.toHaveBeenCalled(); expect(disposed.aj.restart).not.toHaveBeenCalled();
});
