/** Replace $q progress with a callback; the returned promise exposes cancel().
 * Flow is already used globally by smbUpload (flow-init, 1 MiB chunks).
 * Unlike the old hanging $q promise, failed/cancelled uploads reject and detach.
 */
export function startFlowUpload(aj, flow, path, onProgress = () => {}, finishUrl = '/api/lmn/smbclient/finish-upload') {
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
                const response = await aj.http.post(finishUrl, files);
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
