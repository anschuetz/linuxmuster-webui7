// Flow.js wire contract, transported through aj.http instead of Flow's private XHR.
// Flow's default forceChunkSize=false merges a short remainder into the final chunk.
const chunkSize = 1024 * 1024;
export function uploadFilesystem(aj, file, path, onProgress = () => {}) {
    let cancelled = false, finishing = false, abort;
    const timeout = new Promise(resolve => { abort = resolve; });
    const checkCancelled = () => { if (cancelled) throw new DOMException('Upload cancelled', 'AbortError'); };
    const id = `${file.size}-${(file.webkitRelativePath || file.name).replace(/[^0-9a-zA-Z_-]/g, '')}`;
    const total = Math.max(Math.floor(file.size / chunkSize), 1);
    const transfer = async () => {
        for (let index = 0; index < total; index++) {
            checkCancelled();
            const start = index * chunkSize, end = index === total - 1 ? file.size : start + chunkSize;
            const params = new URLSearchParams({
                flowChunkNumber: index + 1, flowChunkSize: chunkSize, flowCurrentChunkSize: end - start,
                flowTotalSize: file.size, flowIdentifier: id, flowFilename: file.name,
                flowRelativePath: file.webkitRelativePath || file.name, flowTotalChunks: total,
            });
            const url = `/api/filesystem/upload?${params}`;
            let existing;
            try { existing = await aj.http.get(url, { timeout }); }
            catch { checkCancelled(); } // Flow sends the chunk after any unsuccessful probe.
            checkCancelled();
            if (existing?.status !== 200) {
                const body = new FormData();
                for (const [key, value] of params) body.append(key, value);
                body.append('file', file.slice(start, end), file.name);
                try {
                    await aj.http.post('/api/filesystem/upload', body, { timeout, headers: { 'Content-Type': undefined }, transformRequest: value => value });
                } catch {
                    checkCancelled();
                    // Legacy Flow also fires complete after a permanent file error; filesystem then calls finish.
                    break;
                }
                checkCancelled();
            }
            onProgress((index + 1) / total);
        }
        checkCancelled();
        finishing = true;
        return (await aj.http.post('/api/filesystem/finish-upload', [{ id, path, name: file.name }])).data;
    };
    return Object.assign(transfer(), { cancel() { if (!finishing) { cancelled = true; abort(); } } });
}
