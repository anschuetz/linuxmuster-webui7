import { expect, it, vi } from 'vitest';
import { createMockAj } from '../../adapter/mock.mjs';
import { createGroups, sortedConfigs, initialTab } from './groups.mjs';
import { configs, images, config, examples } from '../../../e2e/fixtures/linbo4.mjs';
const base = '/api/lmn/linbo4';
function setup(options = {}) {
    const calls = [], notify = vi.fn(), prompt = vi.fn(), show = vi.fn();
    const aj = createMockAj({
        identity: { profile: { activeSchool: 'p83-school' } }, notify,
        messagebox: { prompt, show },
        http: async request => {
            calls.push(request);
            if (options.http) return options.http(request);
            const data = request.url === base + '/configs' ? configs()
                : request.url === base + '/images' ? images()
                : request.url === base + '/examples/config' ? examples
                : request.url === '/api/lmn/read-config-setup' ? { setup: { serverip: '192.0.2.83' } }
                : config();
            return { data, status: 200 };
        },
    });
    return { groups: createGroups(aj), aj, calls, notify, prompt, show };
}
it('starts undefined, filters schools before linking images and preserves API ordering', async () => {
    const { groups, calls } = setup();
    expect([groups.state.configs, groups.state.images, groups.state.examples, groups.state.changed]).toEqual([undefined, undefined, undefined, false]);
    await groups.load();
    expect(groups.state.configs).toEqual([configs()[0], configs()[2], configs()[3]]);
    expect(groups.state.images).toEqual([{ ...images()[0], backups_list: [{ timestamp: 1, date: '20241001' }], used_in: ['zulu', 'alpha'] }]);
    expect(groups.state.examples).toEqual(examples);
    expect(calls.map(c => [c.method, c.url])).toEqual([['get', base + '/configs'], ['get', base + '/examples/config'], ['get', base + '/images']]);
});
it('retains loading on list errors and loaded configs when images fail', async () => {
    const failed = setup({ http: async () => { throw new Error('rejected'); } });
    await failed.groups.load();
    expect([failed.groups.state.configs, failed.groups.state.images, failed.groups.state.examples]).toEqual([undefined, undefined, undefined]);
    const partial = setup({ http: async ({ url }) => {
        if (url === base + '/images') throw new Error('images');
        return { data: url.endsWith('/configs') ? configs() : examples };
    } });
    await partial.groups.load(); expect(partial.groups.state.configs.length).toBe(3); expect(partial.groups.state.images).toBe(undefined);
});
it('sorts file names like Angular orderBy without changing input; hash selects only known tabs', () => {
    const list = [{ file: 'start.conf.z' }, { file: 'start.conf.B' }, { file: 'start.conf.a' }, { file: 'start.conf.A' }];
    expect(sortedConfigs(list)).toEqual([list[2], list[3], list[1], list[0]]);
    expect(list.map(c => c.file)).toEqual(['start.conf.z', 'start.conf.B', 'start.conf.a', 'start.conf.A']);
    expect(['', '#groups', '#images', '#unknown'].map(initialTab)).toEqual([0, 0, 1, 0]);
});
it('creates an empty config, marks dirty only after successful save and appends the original row shape', async () => {
    const { groups, prompt, calls } = setup(); await groups.load();
    prompt.mockResolvedValue({ value: 'p83-empty' }); await groups.createConfig();
    expect(calls.at(-1)).toEqual({ method: 'post', url: base + '/config/start.conf.p83-empty', data: { config: { LINBO: { Group: 'p83-empty' } }, os: [], partitions: [] }, cfg: undefined });
    expect(groups.state.configs.at(-1)).toEqual({ file: 'start.conf.p83-empty', images: [] }); expect(groups.state.changed).toBe(true);
});
it('loads example then setup, overrides only Group and Server without mutating response', async () => {
    const source = config(), { groups, prompt, calls } = setup({ http: async ({ url }) => ({ data: url.endsWith('/configs') ? configs() : url.endsWith('/images') ? images() : url.endsWith('/examples/config') ? examples : url === '/api/lmn/read-config-setup' ? { setup: { serverip: '192.0.2.83' } } : source }) });
    await groups.load(); prompt.mockResolvedValue({ value: 'p83-example' }); await groups.createConfig(examples[0]);
    expect(calls.slice(-3).map(r => [r.method, r.url, r.data])).toEqual([
        ['get', base + '/config/examples/' + examples[0], undefined], ['get', '/api/lmn/read-config-setup', undefined],
        ['post', base + '/config/start.conf.p83-example', { ...config(), config: { LINBO: { ...config().config.LINBO, Group: 'p83-example', Server: '192.0.2.83' } } }],
    ]); expect(source).toEqual(config());
});
it('rejects invalid or duplicate create names and ignores empty/cancel without HTTP writes', async () => {
    const { groups, prompt, notify, calls } = setup(); await groups.load(); const initial = calls.length;
    prompt.mockResolvedValueOnce({ value: 'bad/name' }).mockResolvedValueOnce({ value: 'alpha' }).mockResolvedValueOnce({ value: '' }).mockRejectedValueOnce('cancel');
    for (let n = 0; n < 4; n++) await groups.createConfig();
    expect(calls.length).toBe(initial); expect(groups.state.changed).toBe(false);
    expect(notify.mock.calls).toEqual([['error', 'bad/name can only contain alphanumeric chars or _-', undefined], ['error', 'A config file with this name already exists!', undefined]]);
});
it.each(['get', 'post'])('does not append or mark dirty when create %s fails', async method => {
    const { groups, prompt } = setup({ http: async req => {
        if (req.method === method && req.url.includes('/config/')) throw new Error('failed');
        return { data: req.url.endsWith('/configs') ? configs() : [] };
    } });
    await groups.load(); prompt.mockResolvedValue({ value: 'failed' });
    await groups.createConfig(method === 'get' ? examples[0] : undefined);
    expect(groups.state.changed).toBe(false); expect(groups.state.configs).toEqual([configs()[0], configs()[2], configs()[3]]);
});
it('copy keeps metadata and image links, and deliberately permits duplicate target names like Angular', async () => {
    const { groups, prompt, calls } = setup(); await groups.load();
    prompt.mockResolvedValue({ value: 'alpha' }); await groups.duplicateConfig('start.conf.zulu');
    expect(prompt.mock.calls).toEqual([['New name', 'zulu']]);
    expect(calls.slice(-2).map(r => [r.method, r.url, r.data])).toEqual([
        ['get', base + '/config/start.conf.zulu', undefined],
        ['post', base + '/config/start.conf.alpha', { ...config(), config: { LINBO: { ...config().config.LINBO, Group: 'alpha' } } }],
    ]);
    expect(groups.state.configs.at(-1)).toEqual({ ...configs()[0], file: 'start.conf.alpha' }); expect(groups.state.changed).toBe(true);
});
it('rename performs GET → POST → DELETE and retains the stale original row like Angular', async () => {
    const { groups, prompt, calls } = setup(); await groups.load(); prompt.mockResolvedValue({ value: 'renamed' });
    await groups.duplicateConfig('start.conf.alpha', true);
    expect(calls.slice(-3).map(r => [r.method, r.url])).toEqual([['get', base + '/config/start.conf.alpha'], ['post', base + '/config/start.conf.renamed'], ['delete', base + '/config/start.conf.alpha']]);
    expect(groups.state.configs).toEqual([configs()[0], configs()[2], configs()[3], { ...configs()[2], file: 'start.conf.renamed' }]); expect(groups.state.changed).toBe(true);
});
it('copy cancellation, empty and invalid names make no request', async () => {
    const { groups, prompt, calls } = setup(); await groups.load(); const initial = calls.length;
    prompt.mockRejectedValueOnce('cancel').mockResolvedValueOnce({ value: '' }).mockResolvedValueOnce({ value: '/' });
    for (let n = 0; n < 3; n++) await groups.duplicateConfig('start.conf.alpha');
    expect(calls.length).toBe(initial); expect(groups.state.changed).toBe(false);
});
it('failed rename deletion leaves the newly appended row but no dirty flag, like Angular', async () => {
    const { groups, prompt } = setup({ http: async req => {
        if (req.method === 'delete') throw new Error('delete failed');
        return { data: req.url.endsWith('/configs') ? configs() : req.url.includes('/config/') ? config() : [] };
    } });
    await groups.load(); prompt.mockResolvedValue({ value: 'renamed' }); await groups.duplicateConfig('start.conf.alpha', true);
    expect(groups.state.configs.at(-1).file).toBe('start.conf.renamed'); expect(groups.state.changed).toBe(false);
});
it('delete confirms GRUB effect, handles cancel/failure and updates only on success', async () => {
    let fail = true;
    const { groups, show, calls } = setup({ http: async req => {
        if (req.method === 'delete' && fail) throw new Error('failed');
        return { data: req.url.endsWith('/configs') ? configs() : [] };
    } });
    await groups.load(); show.mockRejectedValueOnce('cancel').mockResolvedValue(undefined);
    await groups.deleteConfig('start.conf.alpha'); expect(calls.filter(c => c.method === 'delete')).toEqual([]);
    await groups.deleteConfig('start.conf.alpha'); expect(groups.state.changed).toBe(false);
    fail = false; await groups.deleteConfig('start.conf.alpha');
    expect(show.mock.calls[0]).toEqual([{ title: "Delete 'start.conf.alpha' ?", text: "Delete the file 'start.conf.alpha'? This will also delete the associated grub config file located in /srv/linbo/boot/grub.", positive: 'Delete', negative: 'Cancel' }]);
    expect(groups.state.configs).toEqual([configs()[0], configs()[3]]); expect(groups.state.changed).toBe(true);
});
it('keeps Angular duplicate-row behavior: copies every match but deletion removes only the first', async () => {
    const { groups, prompt, show } = setup(); await groups.load();
    prompt.mockResolvedValueOnce({ value: 'alpha' }).mockResolvedValueOnce({ value: 'other' });
    await groups.duplicateConfig('start.conf.alpha');
    await groups.duplicateConfig('start.conf.alpha');
    expect(groups.state.configs.filter(c => c.file === 'start.conf.other')).toEqual([{ ...configs()[2], file: 'start.conf.other' }, { ...configs()[2], file: 'start.conf.other' }]);
    show.mockResolvedValue(undefined); await groups.deleteConfig('start.conf.alpha');
    expect(groups.state.configs.filter(c => c.file === 'start.conf.alpha')).toEqual([configs()[2]]);
});
