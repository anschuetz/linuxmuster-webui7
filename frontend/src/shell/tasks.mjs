import { reactive } from 'vue';
import { io as connect } from 'socket.io-client';

/** One explicit socket/push/tasks owner; never instantiated by the legacy adapter. */
export function createTaskServices({ http, notify, prefix = '', io = connect, gettext = text => text }) {
    const transport = io('/socket', { path: `${prefix}/socket.io`, autoConnect: false,
        withCredentials: true, forceNew: true });
    const state = reactive({ status: 'idle', connectionLost: false, error: null });
    const taskState = reactive({ tasks: [] });
    const subscribers = new Map(), pending = new Map(), pendingSends = new Set();
    let started = false, disposed = false;
    function subscribe(channel, fn) {
        if (disposed) throw new Error('Task services disposed');
        const token = Symbol(channel);
        subscribers.set(token, { channel, fn });
        return () => subscribers.delete(token);
    }
    function publish(channel, value) {
        for (const listener of subscribers.values()) if (listener.channel === channel) listener.fn(value);
    }
    function receive(message) {
        if (disposed) return;
        if (typeof message === 'string') {
            try { message = JSON.parse(message); } catch { return; }
        }
        if (!message || typeof message.plugin !== 'string') return;
        publish(`socket:${message.plugin}`, message.data);
    }
    const handlers = {
        connect() {
            state.status = 'connected'; state.connectionLost = false; state.error = null;
            void http.get('/api/core/tasks/request-update').catch(error => { if (!disposed) state.error = error; });
        },
        disconnect() { state.status = 'disconnected'; state.connectionLost = true; },
        connect_error(error) { state.status = 'error'; state.connectionLost = true; state.error = error; },
        message: receive,
    };
    const managerHandlers = {
        reconnect_attempt() { state.status = 'reconnecting'; },
        reconnect_failed() { state.status = 'error'; state.connectionLost = true; },
    };
    for (const [name, fn] of Object.entries(handlers)) transport.on(name, fn);
    for (const [name, fn] of Object.entries(managerHandlers)) transport.io.on(name, fn);
    subscribe('socket:push', message => {
        if (message && typeof message.plugin === 'string') publish(`push:${message.plugin}`, message.message);
    });
    subscribe('push:tasks', message => {
        if (message?.type === 'update' && Array.isArray(message.tasks)) taskState.tasks = message.tasks.map(task => ({ ...task, progress: { ...task.progress } }));
        if (message?.type !== 'message') return;
        const event = message.message;
        if (!event?.task || !['done', 'exception'].includes(event.type)) return;
        const deferred = pending.get(event.task.id);
        pending.delete(event.task.id);
        if (event.type === 'done') {
            deferred?.resolve(); notify.success(gettext(event.task.name), gettext('Done'));
        } else {
            deferred?.reject(event); notify.error(gettext(event.task.name), gettext(`Failed: ${event.exception}`));
        }
    });
    return {
        state,
        socket: { subscribe: (plugin, fn) => subscribe(`socket:${plugin}`, fn),
            send(plugin, data) {
                if (disposed) return Promise.reject(new Error('Task services disposed'));
                return new Promise((resolve, reject) => {
                    pendingSends.add(reject);
                    transport.emit('message', { plugin, data }, () => { pendingSends.delete(reject); resolve(); });
                });
            } },
        push: { subscribe: (plugin, fn) => subscribe(`push:${plugin}`, fn) },
        tasks: { state: taskState, async start(cls, args = [], kwargs = {}) {
            if (disposed) throw new Error('Task services disposed');
            const { data: id } = await http.post('/api/core/tasks/start', { cls, args, kwargs });
            if (disposed) throw new Error('Task services disposed');
            let resolve, reject;
            const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
            pending.set(id, { resolve, reject });
            return { id, promise };
        } },
        start() {
            if (started || disposed) return;
            started = true; state.status = 'connecting'; transport.connect();
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            for (const [name, fn] of Object.entries(handlers)) transport.off(name, fn);
            for (const [name, fn] of Object.entries(managerHandlers)) transport.io.off(name, fn);
            subscribers.clear(); transport.disconnect();
            for (const deferred of pending.values()) deferred.reject(new Error('Task services disposed'));
            pending.clear();
            for (const reject of pendingSends) reject(new Error('Task services disposed'));
            pendingSends.clear(); taskState.tasks = []; state.status = 'disposed';
        },
    };
}
