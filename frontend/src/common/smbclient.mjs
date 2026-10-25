import { startFlowUpload } from './flowUpload.mjs';

const base = '/api/lmn/smbclient';

/** The legacy smbclient service; all backend requests go through aj.http. */
export function createSmbclient(aj) {
    const get = (url, cfg) => aj.http.get(`${base}${url}`, cfg).then((response) => response.data);
    const post = (url, data) => aj.http.post(`${base}${url}`, data).then((response) => response.data);
    const transfer = (operation, suffix) => (src, dst, notifySuccess = true) =>
        post(`/${operation}`, { src, dst }).then((data) => {
            if (notifySuccess) aj.notify.success(src + aj.gettext(suffix));
            return data;
        }, (response) => {
            aj.notify.error(response.data.message);
            // Successful copy/move endpoints return null; false marks a handled failure.
            return false;
        });
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
