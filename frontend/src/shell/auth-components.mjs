import { createApp, defineComponent, h, onBeforeUnmount } from 'vue';
import { createLogin, createPasswordReset, createTotp } from './auth.mjs';

const totpDate = seconds => {
    const date = new Date(seconds * 1000), pad = value => String(value).padStart(2, '0');
    const offset = -date.getTimezoneOffset(), zone = `${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}${pad(Math.abs(offset) % 60)}`;
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${zone}`;
};
const button = (text, action, attrs = {}) => h('button', { type: 'button', class: 'btn btn-default', onClick: action, ...attrs }, text);
const field = (model, name, label, { type = 'text', change, disabled } = {}) => h('label', [label,
    h('input', { name, type, class: 'form-control', value: model.state[name], disabled, 'aria-label': label,
        onInput: event => { const value = type === 'password' ? event.target.value : event.target.value.trim(); model.state[name] = value; change?.(value); } }),
]);
const form = (submit, children) => h('form', { onSubmit: event => { event.preventDefault(); void submit(); } }, children);

export const Login = defineComponent({
    props: ['model'],
    setup({ model: m }) {
        onBeforeUnmount(m.dispose);
        return () => {
            const s = m.state, t = m.gettext;
            return h('div', { class: 'container' }, [form(m.login, [
                s.mode === 'normal' ? field(m, 'username', t('Username'), { disabled: s.working }) : null,
                field(m, 'password', t('Password'), { type: s.showPassword ? 'text' : 'password', disabled: s.working }),
                button(t(s.showPassword ? 'Hide password' : 'Show password'), () => { s.showPassword = !s.showPassword; }, { 'data-action': 'show-password' }),
                button(t(s.mode === 'sudo' ? 'Authenticate' : 'Log in'), undefined, { type: 'submit', disabled: !s.username || !s.password || s.working }),
                s.showPWReset ? h('a', { href: '/view/reset_password_send' }, t('Password forgotten ?')) : null,
            ]), s.verif_code ? h('dialog', { open: true, 'aria-label': t('Please enter TOTP verification code:') }, [
                field(m, 'code', t('Please enter TOTP verification code:'), { change: m.verify }),
                button(t('Cancel'), m.cancel, { 'data-action': 'cancel' }),
            ]) : null]);
        };
    },
});

export const PasswordReset = defineComponent({
    props: ['model'],
    setup({ model: m }) {
        onBeforeUnmount(m.dispose);
        return () => {
            const s = m.state, t = m.gettext;
            if (s.serial === undefined) return form(m.send, [field(m, 'mail', t('Email')),
                button(t('Send instructions to reset password'), undefined, { type: 'submit', disabled: !s.mail })]);
            if (!s.ready) return h('div', { role: 'progressbar', 'aria-label': t('Please wait') });
            if (!s.serial_ok) return h('div', { class: 'alert alert-danger' }, t('The used link is not valid or expired.'));
            return form(m.save, [field(m, 'password1', t('New password'), { type: 'password' }),
                field(m, 'password2', t('Reenter the new password'), { type: 'password' }),
                s.password1 && s.password1 !== s.password2 ? h('p', t('The two entered passwords differ')) : null,
                button(t('Reset password'), undefined, { type: 'submit', disabled: !s.password1 || !s.password2 || s.password1 !== s.password2 }),
            ]);
        };
    },
});

export const Totp = defineComponent({
    props: ['model'],
    setup({ model: m }) {
        onBeforeUnmount(m.dispose);
        return () => {
            const s = m.state, t = m.gettext;
            const edit = (name, label, change) => h('label', [t(label), h(name === 'description' ? 'textarea' : 'input', {
                name, class: 'form-control', value: s.tmp_totp[name], onInput: event => {
                    s.tmp_totp = { ...s.tmp_totp, [name]: event.target.value.trim() }; if (change) void change();
                },
            })]);
            return h('div', [s.totp.length ? h('table', { class: 'table' }, [h('thead', [h('tr', ['User', 'Date', 'Description', ''].map(text => h('th', t(text))))]),
                h('tbody', s.totp.map(item => h('tr', { key: item.created }, [h('td', m.identity.user), h('td', totpDate(item.created)), h('td', item.description),
                    h('td', button(t('Delete'), () => m.remove(item), { 'data-action': 'delete' })),
                ])))]) : h('div', { class: 'alert alert-info' }, t('There is currently no TOTP key for this user.')),
            button(t('Add new TOTP'), m.add, { 'data-action': 'add' }),
            s.add_new ? h('dialog', { open: true, 'aria-label': t('Add new TOTP') }, [h('h4', t('Add new TOTP')), h('p', m.identity.user),
                edit('description', 'Description'), edit('secret', 'Key', m.updateQr), button(t('Generate key'), m.randomSecret),
                m.valid() ? [h('img', { src: `data:image/png;base64,${s.tmp_qr}`, alt: t('TOTP QR code') }),
                    h('label', [t('Verify'), h('input', { name: 'verification', class: 'form-control', value: s.verif_code, onInput: event => m.verify(event.target.value.trim()) })]),
                    button(t('Save'), m.save, { 'data-action': 'save', disabled: !s.verified }),
                ] : h('p', t('A valid key should contain at least 32 characters chosen from "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".')),
                button(t('Cancel'), m.cancel, { 'data-action': 'cancel' }),
            ]) : null]);
        };
    },
});

/** Explicit isolated mount only; no product router, bootstrap or Angular adapter imports this. */
export function mountAuthentication(element, options) {
    const { path } = options;
    let component, model;
    const login = /^\/view\/login\/([^/]+)(?:\/(.*))?$/.exec(path);
    const reset = /^\/view\/reset_password\/([^/]+)$/.exec(path);
    if (login) { component = Login; model = createLogin({ ...options, mode: login[1] }); }
    else if (path === '/view/totp') { component = Totp; model = createTotp(options); }
    else if (reset || path === '/view/reset_password_send') { component = PasswordReset; model = createPasswordReset({ ...options, serial: reset ? reset[1] : undefined }); }
    else throw new Error('Unknown authentication route');
    const app = createApp(component, { model }); app.mount(element); void model.start();
    return () => app.unmount();
}
