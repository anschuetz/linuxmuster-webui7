import { createApp, h } from 'vue';

let active = [];
let hadModalOpen = false;
// Keep service stacks below native messageboxes (dialog .modal: 2000).
const serviceLayer = depth => Math.min(1050 + 2 * depth, 1998);

const ModalFrame = {
    props: ['component', 'componentProps', 'options', 'depth', 'isTop'], emits: ['close', 'cancel'],
    setup(props, { emit }) {
        return () => [h('div', { class: 'modal-backdrop fade show', style: props.depth ? { zIndex: serviceLayer(props.depth) - 1 } : undefined }), h('div', {
            class: 'modal fade show', role: 'dialog', 'aria-modal': 'true', tabindex: -1, style: { display: 'block', ...(props.depth ? { zIndex: serviceLayer(props.depth) } : {}) },
            onClick: event => { if (props.isTop() && (props.options.backdrop ?? true) === true && event.target === event.currentTarget) emit('cancel'); },
        }, [h('div', { class: ['modal-dialog', { [`modal-${props.options.size}`]: ['sm', 'lg'].includes(props.options.size) }], role: 'document' }, [
            h('div', { class: 'modal-content' }, [h(props.component, {
                ...props.componentProps, onClose: result => emit('close', result), onCancel: () => emit('cancel'),
            })]),
        ])])];
    },
};

/** Explicit lifetime owned by the future shell/route, without an Angular scope. */
export function createModalService(getAj) {
    let cancellations = [], disposed = false;
    function open(Component, props = {}, options = {}) {
        if (disposed) return Promise.reject(new Error('Modal service disposed'));
        return new Promise((resolve, reject) => {
            const host = document.createElement('div'), previousFocus = document.activeElement;
            let app, settled = false;
            function finish(success, result) {
                if (settled) return;
                settled = true;
                queueMicrotask(() => {
                    document.removeEventListener('keydown', onKey);
                    app?.unmount(); host.remove();
                    cancellations = cancellations.filter(fn => fn !== cancel);
                    active = active.filter(item => item !== host);
                    if (active.length === 0 && !hadModalOpen) document.body.classList.remove('modal-open');
                    previousFocus?.focus();
                    if (success) resolve(result); else reject(result);
                });
            }
            const cancel = () => finish(false, new Error('Modal cancelled'));
            const onKey = event => {
                if (event.key === 'Escape' && active.at(-1) === host && !document.querySelector('dialog.messagebox[open]')) {
                    event.preventDefault();
                    if (options.keyboard !== false) cancel();
                }
            };
            try {
                const aj = getAj();
                if (active.length === 0) hadModalOpen = document.body.classList.contains('modal-open');
                active = [...active, host]; cancellations = [...cancellations, cancel];
                document.body.classList.add('modal-open'); document.body.append(host);
                document.addEventListener('keydown', onKey);
                app = createApp(ModalFrame, { component: Component, componentProps: props, options, depth: active.length - 1, isTop: () => active.at(-1) === host,
                    onClose: result => finish(true, result), onCancel: cancel });
                app.provide('aj', aj); app.config.globalProperties.$gettext = aj.gettext;
                app.config.errorHandler = error => finish(false, error);
                app.mount(host); host.querySelector('.modal').focus();
            } catch (error) { finish(false, error); }
        });
    }
    return { open, dispose() { disposed = true; cancellations.forEach(cancel => cancel()); } };
}
