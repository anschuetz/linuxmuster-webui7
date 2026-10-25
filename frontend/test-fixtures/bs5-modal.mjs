import { h } from 'vue';
import { createModalService } from '../src/shell/modal.mjs';
const service = createModalService(() => ({ gettext: text => text }));
const Dialog = { emits: ['close', 'cancel'], setup(_, { emit }) {
    return () => h('div', [h('div', { class: 'modal-header' }, 'Dialog'),
        h('div', { class: 'modal-body' }, [h('button', { onClick: () => emit('close', 42) }, 'Done')])]);
} };
window.modalFixture = { open: options => {
    const result = service.open(Dialog, {}, options); result.catch(() => {}); return result;
}, dispose: service.dispose };
