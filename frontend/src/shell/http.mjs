// Angular-free implementation of the HTTP subset documented in adapter/aj.mjs.
const bodyMethods = ['post', 'put', 'patch'];
const encode = value => encodeURIComponent(value)
    .replace(/%40/gi, '@').replace(/%3A/gi, ':').replace(/%24/g, '$')
    .replace(/%2C/gi, ',').replace(/%3B/gi, ';').replace(/%20/g, '+');

function withParams(url, params = {}) {
    const parts = Object.keys(params).sort().flatMap(key => {
        const value = params[key];
        if (value == null) return [];
        return (Array.isArray(value) ? value : [value]).map(item => {
            const text = item instanceof Date ? item.toISOString()
                : item !== null && typeof item === 'object' ? JSON.stringify(item) : item;
            return `${encode(key)}=${encode(text)}`;
        });
    });
    if (!parts.length) return url;
    return `${url}${url.includes('?') ? '&' : '?'}${parts.join('&')}`;
}

function requestBody(data, cfg) {
    if (cfg.transformRequest) {
        return [cfg.transformRequest].flat().reduce((value, transform) => transform(value), data);
    }
    if (data !== null && typeof data === 'object'
        && !(data instanceof Blob) && !(data instanceof FormData) && !(data instanceof ArrayBuffer)) {
        return JSON.stringify(data);
    }
    return data;
}

async function responseData(response, cfg) {
    if (cfg.responseType === 'blob') return response.blob();
    if (cfg.responseType === 'arraybuffer') return response.arrayBuffer();
    const text = await response.text();
    // Same default transform as $http, including JSON-looking text/plain bodies.
    const stripped = text.replace(/^\)\]\}',?\n/, '').trim();
    if (!stripped) return text;
    const jsonType = response.headers.get('content-type')?.startsWith('application/json');
    if (jsonType || /^(\[|\{(?!\{))/.test(stripped) && /[\]}]$/.test(stripped)) {
        try { return JSON.parse(stripped); } catch (error) { if (jsonType) throw error; }
    }
    return text;
}

export function createHttp({ fetch = globalThis.fetch, prefix = '', onError = () => {}, context = () => undefined } = {}) {
    async function request(method, url, data, cfg = {}) {
        const requestContext = context();
        const headers = new Headers({ Accept: 'application/json, text/plain, */*' });
        if (bodyMethods.includes(method)) headers.set('Content-Type', 'application/json;charset=utf-8');
        for (const [name, value] of Object.entries(cfg.headers ?? {})) {
            if (value == null) headers.delete(name); else headers.set(name, value);
        }
        if (data === undefined) headers.delete('Content-Type');
        const config = { ...cfg, method: method.toUpperCase(), url, data };
        let response;
        try {
            response = await fetch(withParams(url.startsWith('/') ? prefix + url : url, cfg.params), {
                method: config.method, headers, credentials: 'same-origin',
                ...(data === undefined ? {} : { body: requestBody(data, cfg) }),
                ...(cfg.signal ? { signal: cfg.signal } : {}),
            });
        } catch (cause) {
            const failure = { data: null, status: -1, config, cause };
            await onError(failure, requestContext);
            throw failure;
        }
        const result = { data: await responseData(response, cfg), status: response.status, config };
        if (response.status >= 200 && response.status < 300) return result;
        await onError(result, requestContext);
        throw result;
    }
    return Object.fromEntries(['get', 'head', 'delete', ...bodyMethods].map(method => [method,
        (url, ...args) => request(method, url, bodyMethods.includes(method) ? args[0] : undefined,
            args[bodyMethods.includes(method) ? 1 : 0]),
    ]));
}
