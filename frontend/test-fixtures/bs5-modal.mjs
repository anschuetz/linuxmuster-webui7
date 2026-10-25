import { createApp, h } from 'vue';
import { createPresentation, ShellServices } from '../src/shell/presentation.mjs';
const services = createPresentation({ http: {}, identity: { profile: {}, color: 'blue' }, navigate() {} });
const service = services.modal, host = document.createElement('div');
document.body.append(host);
createApp(ShellServices, { services }).mount(host);
const Dialog = { emits: ['close', 'cancel'], setup(_, { emit }) {
    return () => h('div', [h('div', { class: 'modal-header' }, 'Dialog'),
        h('div', { class: 'modal-body' }, [h('button', { onClick: () => emit('close', 42) }, 'Done')])]);
} };
window.modalFixture = { open: options => {
    const result = service.open(Dialog, {}, options); result.catch(() => {}); return result;
}, message() {
    const result = services.messagebox.show({ title: 'Confirm', positive: 'Confirm', negative: 'Cancel' });
    result.catch(() => {});
}, dispose: services.dispose };
