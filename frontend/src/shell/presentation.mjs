import { computed, defineComponent, effectScope, h, onBeforeUnmount, reactive, shallowRef, watchEffect } from 'vue';
import { createMessages } from './messages.mjs';
import { createNotifications } from './notifications.mjs';
import { createModalService } from './modal.mjs';
import { createFavicon } from './favicon.mjs';

/** Isolated presentation owner. No product entry or Angular adapter imports it. */
export function createPresentation({ http, identity, navigate, gettext = text => text, getAj,
    browserLocation = window.location, customization = {} }) {
    const notifications = createNotifications(navigate), messages = createMessages();
    const title = shallowRef(''), scope = effectScope();
    let disposed = false, timers = [];
    const later = (fn, delay) => { timers = [...timers, setTimeout(() => { if (!disposed) fn(); }, delay)]; };
    const modal = createModalService(() => getAj ? getAj() : services);
    const state = reactive({ pageTitle: computed(() => title.value),
        toasts: computed(() => notifications.state.toasts), messages: computed(() => messages.state.messages) });
    const favicon = createFavicon({ identity, customization });
    scope.run(() => watchEffect(() => { document.title = `${title.value}${title.value ? ' | ' : ''}${identity.profile.schoolname ?? ''}`; }));
    async function forceRestart() {
        const progress = messages.messagebox.show({ progress: true, title: gettext('Restarting') });
        // These informational handles have no buttons and are closed by the workflow.
        progress.catch(() => {});
        try {
            await http.post('/api/core/restart-master');
            if (disposed) return;
            later(() => {
                progress.close();
                messages.messagebox.show({ title: gettext('Restarted'), text: gettext('Please wait') }).catch(() => {});
                later(() => { browserLocation.reload(); later(() => browserLocation.reload(), 5000); }, 0);
            }, 5000);
        } catch (error) {
            progress.close();
            if (!disposed) notifications.notify.error(gettext('Could not restart'), error.message);
        }
    }
    const services = {
        state, gettext, http, identity, navigate, notify: notifications.notify, messagebox: messages.messagebox, modal,
        pageTitle: { set: value => { title.value = value; } }, favicon,
        forceRestart,
        restart: () => messages.messagebox.show({ title: gettext('Restart'), text: gettext('Restart the panel?'),
            positive: gettext('Yes'), negative: gettext('No') }).then(() => { void forceRestart(); }),
        clickToast: notifications.click, pauseToast: notifications.pause, resumeToast: notifications.resume,
        answerMessage: messages.answer,
        dispose() {
            if (disposed) return;
            disposed = true; timers.forEach(clearTimeout); timers = [];
            scope.stop(); favicon.dispose(); notifications.dispose(); messages.dispose(); modal.dispose();
        },
    };
    return services;
}

const Message = defineComponent({
    props: ['message', 'services'],
    setup(props) {
        const value = shallowRef(props.message.value);
        const answer = positive => props.services.answerMessage(props.message.id, positive, value.value);
        return () => {
            const m = props.message, t = props.services.gettext;
            return h('dialog', { open: true, class: 'messagebox', 'aria-label': t(m.title || m.prompt || '') }, [
                h('div', { class: 'modal-header' }, [h('h4', t(m.title || ''))]),
                h('div', { class: ['modal-body', { scrollable: m.scrollable }] }, [
                    m.progress ? h('div', { role: 'progressbar', 'aria-label': t('Please wait') }, [h('i', { class: 'fa fa-spinner fa-spin' })]) : null,
                    t(m.text || ''),
                    m.data ? h('pre', JSON.stringify(m.data, null, 2)) : null,
                    m.prompt ? h('label', [m.prompt, h('input', { class: 'form-control', type: m.input_type, value: value.value,
                        onInput: event => { value.value = m.input_type === 'password' ? event.target.value : event.target.value.trim(); },
                        onKeydown: event => { if (event.key === 'Enter') answer(true); }, autofocus: true })]) : null,
                ]),
                h('div', { class: 'modal-footer' }, [
                    m.positive ? h('button', { class: 'positive btn btn-default btn-flat', onClick: () => answer(true) }, t(m.positive)) : null,
                    m.negative ? h('button', { class: 'negative btn btn-default btn-flat', onClick: () => answer(false) }, t(m.negative)) : null,
                ]),
            ]);
        };
    },
});

export const ShellServices = defineComponent({
    props: { services: { type: Object, required: true } },
    setup(props) {
        onBeforeUnmount(() => props.services.dispose());
        return () => [h('div', { id: 'toast-container', class: 'toast-top-right', 'aria-live': 'polite' }, props.services.state.toasts.map(toast =>
            h('div', { key: toast.id, class: ['toast', `toast-${toast.level}`], role: 'status',
                onClick: () => props.services.clickToast(toast), onMouseenter: () => props.services.pauseToast(toast), onMouseleave: () => props.services.resumeToast(toast),
            }, [h('div', { class: 'toast-title' }, toast.title), h('div', { class: 'toast-message' }, toast.text)]))),
        ...props.services.state.messages.map(message => h(Message, { key: message.id, message, services: props.services }))];
    },
});
