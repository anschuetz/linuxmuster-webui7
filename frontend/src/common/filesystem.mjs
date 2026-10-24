import { startFlowUpload } from './flowUpload.mjs';

// Preserve slash separators; filenames and encodings cannot introduce query/hash parts.
export function filesystemUrl(operation, path, encoding) {
    const escaped = path.split('/').map(encodeURIComponent).join('/');
    const query = ['read', 'write'].includes(operation) ? `?encoding=${encodeURIComponent(encoding || 'utf-8')}` : '';
    return `/api/filesystem/${operation}/${escaped}${query}`;
}

/** Same data/payload contract as filesystem 0.51; authorization remains server-side. */
export function createFilesystem(aj) {
    const get = (operation, path, encoding) => aj.http.get(filesystemUrl(operation, path, encoding)).then(r => r.data);
    return {
        read: (path, encoding) => get('read', path, encoding),
        write: (path, content, encoding) => aj.http.post(filesystemUrl('write', path, encoding), content).then(r => r.data),
        list: path => get('list', path),
        stat: path => get('stat', path),
        startFlowUpload: (flow, path, onProgress) => startFlowUpload(aj, flow, path, onProgress, '/api/filesystem/finish-upload'),
    };
}

// UI navigation boundary only, not a replacement for backend ACL or symlink checks.
export function withinRoot(path, root) {
    const normalize = value => {
        const parts = [];
        for (const part of value.split('/')) {
            if (part === '..') parts.pop();
            else if (part && part !== '.') parts.push(part);
        }
        return '/' + parts.join('/');
    };
    const base = normalize(root), target = normalize(path);
    return target === base || target.startsWith(base === '/' ? '/' : base + '/');
}
