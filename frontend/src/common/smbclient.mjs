const base = '/api/lmn/smbclient';

/** The legacy smbclient service; all backend requests go through aj.http. */
export function createSmbclient(aj) {
    const get = (url, cfg) => aj.http.get(`${base}${url}`, cfg).then((response) => response.data);
    const post = (url, data) => aj.http.post(`${base}${url}`, data).then((response) => response.data);
    const transfer = (operation, suffix) => (src, dst, notifySuccess = true) =>
        post(`/${operation}`, { src, dst }).then((data) => {
            if (notifySuccess) aj.notify.success(src + aj.gettext(suffix));
            return data;
        }, (response) => { aj.notify.error(response.data.message); });
    return {
        shares: (user) => get(`/shares/${user}`),
        list: (path) => post('/list', { path }),
        delete_file: (path) => post('/unlink', { path }),
        delete_dir: (path) => post('/rmdir', { path }),
        stat: (path) => get(`/stat/${path}`),
        createFile: (path) => post('/file', { path }),
        createDirectory: (path) => post('/directory', { path }),
        move: transfer('move', ' moved!'),
        copy: transfer('copy', ' copied!'),
        // Backend decodes UTF-8 base64url, including its padding.
        download: (path) => {
            const encoded = btoa(Array.from(new TextEncoder().encode(path), (byte) => String.fromCharCode(byte)).join(''))
                .replaceAll('+', '-').replaceAll('/', '_');
            return get(`/download?path=${encoded}`, { responseType: 'blob' });
        },
        startFlowUpload: (flow, path, onProgress = () => {}) => startFlowUpload(aj, flow, path, onProgress),
        refresh_krbcc: () => aj.messagebox.prompt('Please give your password:', '', 'password').then((msg) =>
            post('/refresh_krbcc', { pw: msg.value }).then((data) => {
                if (data.type === 'error') {
                    aj.notify.error(data.msg);
                    return Promise.reject();
                }
                aj.notify.success(data.msg);
            })),
    };
}

/** Replace $q progress with a callback; the returned promise exposes cancel().
 * Flow is already used globally by smbUpload (flow-init, 1 MiB chunks).
 * Unlike the old hanging $q promise, failed/cancelled uploads reject and detach.
 */
function startFlowUpload(aj, flow, path, onProgress) {
    let resolve, reject, settled = false, finishing = false;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    const cleanup = () => {
        for (const [event, handler] of Object.entries(handlers)) flow.off(event, handler);
        flow.cancel();
    };
    const settle = (error, data) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(data);
    };
    const handlers = {
        fileProgress: () => onProgress(flow.files.map((file) => ({
            id: file.uniqueIdentifier, name: file.name, progress: Math.floor(100 * file.progress()),
        }))),
        complete: async () => {
            if (finishing || settled) return;
            finishing = true;
            try {
                const files = flow.files.map((file) => ({ id: file.uniqueIdentifier, path, name: file.name }));
                const response = await aj.http.post(`${base}/finish-upload`, files);
                settle(null, response.data);
            } catch (error) { settle(error); }
        },
        fileError: (file, message) => settle(new Error(message || file.name)),
        error: (message) => settle(new Error(String(message))),
    };
    for (const [event, handler] of Object.entries(handlers)) flow.on(event, handler);
    // Once finish-upload starts, the backend write must complete and report its result.
    const cancel = () => {
        if (!finishing) settle(new DOMException('Upload cancelled', 'AbortError'));
    };
    try { flow.upload(); } catch (error) { settle(error); }
    return Object.assign(promise, { cancel });
}
