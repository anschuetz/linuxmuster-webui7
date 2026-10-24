import { computed, reactive, shallowRef } from 'vue';

export function createNotifications(navigate) {
    const toasts = shallowRef([]);
    let timers = new Map(), serial = 0, disposed = false;
    function remove(toast) {
        clearTimeout(timers.get(toast.id)); timers.delete(toast.id);
        toasts.value = toasts.value.filter(item => item !== toast);
    }
    function pause(toast) { clearTimeout(timers.get(toast.id)); timers.delete(toast.id); }
    function resume(toast) {
        pause(toast);
        if (!disposed && toast.timeout > 0) timers.set(toast.id, setTimeout(() => remove(toast), toast.timeout));
    }
    function add(level, title, text, options = {}, url) {
        if (disposed) return;
        const toast = { id: ++serial, level, title, text, timeout: options.sticky ? 0 : options.timeout ?? 5000, url };
        toasts.value = [toast, ...toasts.value]; resume(toast);
    }
    const notify = Object.fromEntries(['success', 'info', 'warning', 'error'].map(level => [level,
        (title, text, options) => add(level, title, text, options)]));
    const clear = () => { timers.forEach(clearTimeout); timers = new Map(); toasts.value = []; };
    return {
        notify: { ...notify, custom: (level, title, text, url) => add(level, title, text, {}, url) },
        state: reactive({ toasts: computed(() => toasts.value) }), pause, resume, clear,
        click(toast) { try { if (toast.url) navigate(toast.url); } finally { remove(toast); } },
        dispose() { disposed = true; clear(); },
    };
}
