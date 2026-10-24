import { computed, reactive, shallowRef } from 'vue';

/** close hides only; positive/negative settle with the complete message payload. */
export function createMessages() {
    const messages = shallowRef([]);
    let handles = new Map(), serial = 0, disposed = false;
    function close(id) {
        messages.value = messages.value.filter(message => message.id !== id);
        const handle = handles.get(id);
        if (handle) handle.message = { ...handle.message, visible: false };
    }
    function show(options) {
        if (disposed) throw new Error('Messagebox disposed');
        const id = ++serial, message = { ...options, visible: true };
        let resolve, reject;
        const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
        handles.set(id, { message, resolve, reject });
        messages.value = [...messages.value, { id, ...message }];
        return Object.assign(promise, { close: () => close(id) });
    }
    function answer(id, positive, value) {
        const handle = handles.get(id);
        if (!handle) return;
        if (value !== undefined) handle.message = { ...handle.message, value };
        close(id); handles.delete(id);
        if (positive) handle.resolve(handle.message); else handle.reject(handle.message);
    }
    return {
        messagebox: { show, prompt: (prompt, value, inputType = 'text') => show({ prompt, value: value || '', input_type: inputType, positive: 'OK', negative: 'Cancel' }) },
        state: reactive({ messages: computed(() => messages.value) }), answer,
        dispose() { disposed = true; handles.forEach(handle => handle.reject(new Error('Messagebox disposed'))); handles = new Map(); messages.value = []; },
    };
}
