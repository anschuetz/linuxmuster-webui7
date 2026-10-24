import { getCurrentScope, h, onScopeDispose, shallowRef, watch } from 'vue';

/**
 * Open a non-dismissible wait dialog. status is translated through aj.gettext.
 * update accepts a percentage or {value, max}; absent/zero max is indeterminate.
 * close is idempotent; result exposes modal completion or bridge cancellation.
 * When called in a Vue scope, disposal closes the dialog automatically.
 */
export function openWait(aj, { status = '', style = 'spinner' } = {}) {
    const state = shallowRef({ progress: null, closed: false });
    const close = () => { state.value = { ...state.value, closed: true }; };
    const WaitDialog = {
        emits: ['close'],
        setup(props, { emit }) {
            watch(() => state.value.closed, (closed) => {
                if (closed) emit('close');
            }, { immediate: true, flush: 'sync' });
            return () => {
                const progress = state.value.progress;
                return [
                    h('div', { class: 'modal-header' }, [h('h4', aj.gettext(status))]),
                    h('div', { class: 'modal-body' }, [style === 'progressbar'
                        ? h('div', { class: 'progress', style: { height: '10px' } }, [
                            h('div', {
                                class: ['progress-bar progress-bar-warning', { indeterminate: progress === null }],
                                role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100,
                                'aria-valuenow': progress ?? undefined,
                                style: { width: `${progress ?? 100}%` },
                            }),
                        ])
                        : h('div', { class: 'spinner', role: 'status' }, [
                            h('i', { class: 'fa fa-circle-o-notch fa-spin', 'aria-hidden': 'true' }),
                        ])]),
                ];
            };
        },
    };
    const result = aj.modal.open(WaitDialog, {}, { backdrop: 'static', keyboard: false });
    // Both settlement paths release state and prevent updates after bridge teardown.
    result.then(close, close);
    if (getCurrentScope()) onScopeDispose(close);
    return {
        result, close,
        update(progress) {
            if (state.value.closed) return;
            const percent = typeof progress === 'number' ? progress
                : progress?.max ? 100 * progress.value / progress.max : null;
            state.value = { ...state.value, progress: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : null };
        },
    };
}
