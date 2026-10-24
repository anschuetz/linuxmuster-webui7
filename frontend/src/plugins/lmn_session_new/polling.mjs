import { ref } from 'vue';

/** Scope-owned, immediate/5-second polling; the shell already reports HTTP errors. */
export function createPolling(task) {
    const active = ref(false);
    let timer, disposed = false;
    const run = () => Promise.resolve(task()).catch(() => { /* Keep polling after a failed request, as $interval does. */ });
    const stop = () => { clearInterval(timer); timer = undefined; active.value = false; };
    return {
        active, stop,
        start() {
            if (disposed) return;
            stop(); active.value = true; run(); timer = setInterval(run, 5000);
        },
        dispose() { stop(); disposed = true; },
    };
}
