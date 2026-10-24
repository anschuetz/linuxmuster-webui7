import { createApp, h } from 'vue';

let active = [];
let hadModalOpen = false;

/** Bootstrap 3 frame; the component supplies header/body/footer and emits close(result) or cancel. */
const ModalFrame = {
    props: ['component', 'componentProps', 'backdrop'],
    emits: ['close', 'cancel'],
    setup(props, { emit }) {
        return () => [
            h('div', { class: 'modal-backdrop fade in' }),
            h('div', {
                class: 'modal fade in', role: 'dialog', 'aria-modal': 'true',
                tabindex: -1, style: { display: 'block' },
                onClick: (event) => { if (props.backdrop === true && event.target === event.currentTarget) emit('cancel'); },
            }, [h('div', { class: 'modal-dialog', role: 'document' }, [
                h('div', { class: 'modal-content' }, [
                    h(props.component, {
                        ...props.componentProps,
                        onClose: (result) => emit('close', result),
                        onCancel: () => emit('cancel'),
                    }),
                ]),
            ])]),
        ];
    },
};

/** Each open dialog belongs to the Angular bridge scope, when supplied. */
export function createModalService(getAj, $scope) {
    return { open: (Component, props = {}, options = {}) => new Promise((resolve, reject) => {
        const host = document.createElement('div');
        const previousFocus = document.activeElement;
        let app;
        let offDestroy;
        let settled = false;
        const finish = (success, result) => {
            if (settled) return;
            settled = true;
            // A component may emit close during mount: unmount after mounting finishes.
            queueMicrotask(() => {
                offDestroy?.();
                document.removeEventListener('keydown', onKey);
                app?.unmount();
                host.remove();
                active = active.filter((item) => item !== host);
                if (active.length === 0 && !hadModalOpen) document.body.classList.remove('modal-open');
                previousFocus?.focus();
                if (success) resolve(result);
                else reject(result);
            });
        };
        const cancel = () => finish(false, new Error('Modal cancelled'));
        const onKey = (event) => {
            if (event.key === 'Escape' && active.at(-1) === host) {
                event.preventDefault();
                if (options.keyboard !== false) cancel();
            }
        };
        try {
            const aj = getAj();
            if (active.length === 0) hadModalOpen = document.body.classList.contains('modal-open');
            active = [...active, host];
            document.body.classList.add('modal-open');
            document.body.append(host);
            document.addEventListener('keydown', onKey);
            offDestroy = $scope?.$on('$destroy', cancel);
            app = createApp(ModalFrame, {
                component: Component, componentProps: props, backdrop: options.backdrop ?? true,
                onClose: (result) => finish(true, result), onCancel: cancel,
            });
            app.provide('aj', aj);
            app.config.globalProperties.$gettext = aj.gettext;
            app.config.errorHandler = (error) => finish(false, error);
            app.mount(host);
            host.querySelector('.modal').focus();
        } catch (error) {
            finish(false, error);
        }
    }) };
}
