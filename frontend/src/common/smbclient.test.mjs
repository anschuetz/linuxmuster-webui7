import { expect, it, vi } from 'vitest';
import { createMockAj } from '../adapter/mock.mjs';
import { createSmbclient } from './smbclient.mjs';

function setup() {
    const http = vi.fn().mockResolvedValue({ data: 'result' });
    const notify = vi.fn();
    const prompt = vi.fn().mockResolvedValue({ value: 'secret' });
    const aj = createMockAj({ http, notify, messagebox: { prompt } });
    return { client: createSmbclient(aj), http, notify, prompt };
}
const cases = [
    ['shares', ['zem'], 'get', '/shares/zem', undefined],
    ['list', ['//server/home'], 'post', '/list', { path: '//server/home' }],
    ['delete_file', ['file'], 'post', '/unlink', { path: 'file' }],
    ['delete_dir', ['dir'], 'post', '/rmdir', { path: 'dir' }],
    ['stat', ['//server/a b'], 'get', '/stat///server/a b', undefined],
    ['createFile', ['file'], 'post', '/file', { path: 'file' }],
    ['createDirectory', ['dir'], 'post', '/directory', { path: 'dir' }],
];
it.each(cases)('%s preserves URL, payload, response and rejection', async (method, args, verb, url, data) => {
    const { client, http } = setup();
    expect(await client[method](...args)).toBe('result');
    expect(http).toHaveBeenCalledWith({ method: verb, url: `/api/lmn/smbclient${url}`, data, cfg: undefined });
    const failure = new Error('denied'); http.mockRejectedValueOnce(failure);
    await expect(client[method](...args)).rejects.toBe(failure);
});
it.each([['copy', ' copied!'], ['move', ' moved!']])('%s retains notifications and handled errors', async (method, text) => {
    const { client, http, notify } = setup();
    expect(await client[method]('src', 'dst')).toBe('result');
    expect(http).toHaveBeenLastCalledWith({ method: 'post', url: `/api/lmn/smbclient/${method}`, data: { src: 'src', dst: 'dst' }, cfg: undefined });
    expect(notify).toHaveBeenCalledWith('success', `src${text}`, undefined);
    notify.mockClear(); await client[method]('src', 'dst', false); expect(notify).not.toHaveBeenCalled();
    http.mockRejectedValueOnce({ data: { message: 'denied' } });
    expect(await client[method]('src', 'dst')).toBeUndefined();
    expect(notify).toHaveBeenCalledWith('error', 'denied', undefined);
});
it('prompts for a masked password, preserves cancellation and handles refresh errors', async () => {
    const { client, prompt, http, notify } = setup();
    http.mockResolvedValueOnce({ data: { type: 'success', msg: 'renewed' } });
    await client.refresh_krbcc();
    expect(prompt).toHaveBeenCalledWith('Please give your password:', '', 'password');
    expect(http).toHaveBeenLastCalledWith({ method: 'post', url: '/api/lmn/smbclient/refresh_krbcc', data: { pw: 'secret' }, cfg: undefined });
    expect(notify).toHaveBeenCalledWith('success', 'renewed', undefined);
    http.mockResolvedValueOnce({ data: { type: 'error', msg: 'bad password' } });
    await expect(client.refresh_krbcc()).rejects.toBeUndefined();
    expect(notify).toHaveBeenCalledWith('error', 'bad password', undefined);
    const error = new Error('cancel'); prompt.mockRejectedValueOnce(error); http.mockClear();
    await expect(client.refresh_krbcc()).rejects.toBe(error); expect(http).not.toHaveBeenCalled();
    http.mockRejectedValueOnce(error); await expect(client.refresh_krbcc()).rejects.toBe(error);
});
it('downloads UTF-8 paths as blobs through http cfg and propagates errors', async () => {
    const { client, http } = setup();
    const content = new Blob(['synthetic']); http.mockResolvedValueOnce({ data: content });
    expect(await client.download('//server/ä ?.txt')).toBe(content);
    expect(http.mock.calls[0][0]).toEqual({ method: 'get', url: '/api/lmn/smbclient/download?path=Ly9zZXJ2ZXIvw6QgPy50eHQ=', data: undefined, cfg: { responseType: 'blob' } });
    http.mockRejectedValueOnce(new Error('missing'));
    await expect(client.download('missing')).rejects.toThrow('missing');
});
export class FakeFlow {
    constructor(options) { this.options = options; this.handlers = new Map(); this.files = []; this.upload = vi.fn(); this.cancel = vi.fn(); this.assignBrowse = vi.fn(); this.assignDrop = vi.fn(); this.unAssignDrop = vi.fn(); }
    on(event, fn) { this.handlers.set(event, [...(this.handlers.get(event) || []), fn]); }
    off(event, fn) { this.handlers.set(event, (this.handlers.get(event) || []).filter((f) => f !== fn)); }
    fire(event, ...args) { for (const fn of this.handlers.get(event) || []) fn(...args); }
}
function flow() {
    const f = new FakeFlow();
    f.files = [{ uniqueIdentifier: 'id1', name: 'b.txt', progress: () => 0.429 }, { uniqueIdentifier: 'id2', name: 'a.txt', progress: () => 1 }];
    return f;
}
it('uploads all Flow files, reports rounded progress and finishes with exact descriptors', async () => {
    const { client, http } = setup(); const f = flow(); const progress = vi.fn();
    const result = client.startFlowUpload(f, '//home', progress);
    expect(f.upload).toHaveBeenCalledOnce(); f.fire('fileProgress');
    expect(progress).toHaveBeenCalledWith([{ id: 'id1', name: 'b.txt', progress: 42 }, { id: 'id2', name: 'a.txt', progress: 100 }]);
    f.fire('complete'); expect(await result).toBe('result');
    expect(http).toHaveBeenCalledWith({ method: 'post', url: '/api/lmn/smbclient/finish-upload', data: [{ id: 'id1', path: '//home', name: 'b.txt' }, { id: 'id2', path: '//home', name: 'a.txt' }], cfg: undefined });
    expect(f.cancel).toHaveBeenCalledOnce();
    progress.mockClear(); f.fire('fileProgress'); f.fire('complete');
    expect(progress).not.toHaveBeenCalled(); expect(http).toHaveBeenCalledOnce();
});
it.each(['fileError', 'error', 'finish', 'cancel', 'throw'])('settles and cleans up upload on %s', async (kind) => {
    const { client, http } = setup(); const f = flow();
    if (kind === 'throw') f.upload.mockImplementation(() => { throw new Error('start failed'); });
    const result = client.startFlowUpload(f, 'home');
    const rejected = expect(result).rejects.toBeDefined();
    if (kind === 'finish') { http.mockRejectedValueOnce(new Error('finish failed')); f.fire('complete'); }
    else if (kind === 'cancel') result.cancel();
    else if (kind !== 'throw') f.fire(kind, f.files[0], 'failed');
    await rejected;
    expect(f.cancel).toHaveBeenCalledOnce();
    f.fire('complete'); if (kind !== 'finish') expect(http).not.toHaveBeenCalled();
});
it('cancellation while finishing cannot resolve or finish twice', async () => {
    const { client, http } = setup(); const f = flow(); let finish;
    http.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const result = client.startFlowUpload(f, 'home'); f.fire('complete'); f.fire('complete');
    result.cancel(); await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    finish({ data: 'late' }); await Promise.resolve();
    expect(http).toHaveBeenCalledOnce(); expect(f.cancel).toHaveBeenCalledOnce();
});
