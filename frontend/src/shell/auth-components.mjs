import { createApp, defineComponent, h, onBeforeUnmount, vModelText, withDirectives } from 'vue';
import { createLogin, createPasswordReset, createTotp } from './auth.mjs';

const totpDate = seconds => {
    const date = new Date(seconds * 1000), pad = value => String(value).padStart(2, '0');
    const offset = -date.getTimezoneOffset(), zone = `${offset < 0 ? '-' : '+'}${pad(Math.floor(Math.abs(offset) / 60))}${pad(Math.abs(offset) % 60)}`;
    return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${zone}`;
};
const button = (text, action, attrs = {}) => h('button', { type: 'button', class: 'btn btn-secondary auth-secondary', onClick: action, ...attrs }, text);
const field = (model, name, label, { type = 'text', change, disabled, autofocus } = {}) =>
    h('input', { name, type, class: 'form-control', placeholder: label, value: model.state[name], disabled, autofocus, 'aria-label': label,
        onInput: event => { const value = type === 'password' ? event.target.value : event.target.value.trim(); if (value !== model.state[name]) { model.state[name] = value; change?.(value); } } });
const form = (submit, children) => h('form', { onSubmit: event => { event.preventDefault(); void submit(); } }, children);
const icon = classes => h('i', { class: classes, 'aria-hidden': 'true' });
const heading = classes => h('h1', { class: 'text-center', style: { perspective: '75px' } }, [icon(classes)]);
const logo = customization => customization?.plugins?.core?.bigLogoURL
    ? h('div', { class: 'text-center' }, [h('img', { src: customization.plugins.core.bigLogoURL, alt: '', style: { maxWidth: '100%' } })]) : null;
const authPage = content => h('div', { class: 'container auth-page' }, [
    h('div', { class: 'row aj-theme-auth', id: 'login-form' }, [h('div', { class: 'auth-layout-column' }),
        h('div', { class: 'auth-layout-column auth-card' }, content), h('div', { class: 'auth-layout-column' })]),
]);
const primary = (text, disabled, extraClass = '') => button(text, undefined, { type: 'submit', class: `btn btn-primary d-block w-100 ${extraClass}`, disabled });

export const Login = defineComponent({
    props: ['model', 'customization', 'prefix'],
    setup(props) {
        const m = props.model;
        onBeforeUnmount(m.dispose);
        return () => {
            const s = m.state, t = m.gettext;
            return authPage([form(m.login, [
                logo(props.customization),
                heading(`fa ${s.success ? 'fa-unlock-alt' : 'fa-lock'}${s.working ? ' flip-cycle' : ''}`),
                s.mode === 'normal' ? h('div', [field(m, 'username', t('Username'), { disabled: s.working, autofocus: true })]) : null,
                h('div', { class: 'auth-password-field position-relative' }, [
                    field(m, 'password', t('Password'), { type: s.showPassword ? 'text' : 'password', disabled: s.working }),
                    button([icon(`fas ${s.showPassword ? 'fa-eye-slash' : 'fa-eye'}`)], () => { s.showPassword = !s.showPassword; }, {
                        class: 'auth-password-toggle auth-password-feedback', 'data-action': 'show-password',
                        'aria-label': t(s.showPassword ? 'Hide password' : 'Show password'), 'aria-pressed': !!s.showPassword,
                    }),
                ]),
                h('div', [primary(t(s.mode === 'sudo' ? 'Authenticate' : 'Log in'), !s.username || !s.password || s.working)]),
                s.showPWReset ? h('div', [h('a', { href: `${props.prefix || ''}/view/reset_password_send` }, t('Password forgotten ?'))]) : null,
            ]), s.verif_code ? h('dialog', { open: true, class: 'auth-dialog', 'aria-label': t('Please enter TOTP verification code:') }, [
                h('div', { class: 'modal-header' }, [h('h4', t('Please enter TOTP verification code:'))]),
                h('div', { class: 'modal-body' }, [h('div', { class: 'auth-code-group' }, [field(m, 'code', t('Please enter TOTP verification code:'), { change: m.verify })])]),
                h('div', { class: 'modal-footer' }, [button(t('Cancel'), m.cancel, { class: 'btn btn-secondary auth-secondary btn-flat', 'data-action': 'cancel' })]),
            ]) : null]);
        };
    },
});

export const PasswordReset = defineComponent({
    props: ['model', 'customization'],
    setup(props) {
        const m = props.model;
        onBeforeUnmount(m.dispose);
        return () => {
            const s = m.state, t = m.gettext;
            if (s.serial === undefined) return authPage(form(m.send, [logo(props.customization), heading('far fa-envelope'),
                h('div', [field(m, 'mail', t('Email'))]), h('div', [primary(t('Send instructions to reset password'), !s.mail, 'auth-reset-send')])]));
            if (!s.ready) return authPage(h('div', { role: 'progressbar', 'aria-label': t('Please wait') }));
            if (!s.serial_ok) return authPage(h('div', { class: 'alert alert-danger' }, [icon('fa fa-warning'), ' ', h('b', t('The used link is not valid or expired.'))]));
            return authPage(form(m.save, [logo(props.customization), heading('fas fa-user-edit'),
                h('div', [h('span', t('Please enter the new password')), field(m, 'password1', t('New password'), { type: 'password' })]),
                h('div', [h('span', t('Please confirm the new password')), field(m, 'password2', t('Reenter the new password'), { type: 'password' })]),
                h('div', [s.password1 && s.password1 !== s.password2 ? h('small', { class: 'text-danger' }, t('The two entered passwords differ')) : null,
                    primary(t('Reset password'), !s.password1 || !s.password2 || s.password1 !== s.password2)]),
            ]));
        };
    },
});

export const Totp = defineComponent({
    props: ['model'],
    setup({ model: m }) {
        onBeforeUnmount(m.dispose);
        return () => {
            const s = m.state, t = m.gettext;
            const edit = (name, label, change) => h('label', [t(label), withDirectives(h(name === 'description' ? 'textarea' : 'input', {
                name, class: 'form-control', 'onUpdate:modelValue': value => {
                    if (value === s.tmp_totp[name]) return;
                    s.tmp_totp = { ...s.tmp_totp, [name]: value }; if (change) void change();
                },
            }), [[vModelText, s.tmp_totp[name], undefined, { trim: true }]])]);
            return h('div', [s.totp?.length ? h('table', { class: 'table' }, [h('thead', [h('tr', ['User', 'Date', 'Description', ''].map(text => h('th', t(text))))]),
                h('tbody', s.totp.map(item => h('tr', { key: item.created }, [h('td', m.identity.user), h('td', totpDate(item.created)), h('td', item.description),
                    h('td', button(t('Delete'), () => m.remove(item), { 'data-action': 'delete' })),
                ])))]) : s.totp?.length === 0 ? h('div', { class: 'alert alert-info' }, t('There is currently no TOTP key for this user.')) : null,
            button(t('Add new TOTP'), m.add, { 'data-action': 'add' }),
            s.add_new ? h('dialog', { open: true, 'aria-label': t('Add new TOTP') }, [h('h4', t('Add new TOTP')), h('p', m.identity.user),
                edit('description', 'Description'), edit('secret', 'Key', m.updateQr), button(t('Generate key'), m.randomSecret),
                m.valid() ? [h('img', { src: `data:image/png;base64,${s.tmp_qr}`, alt: t('TOTP QR code') }),
                    h('label', [t('Verify'), h('input', { name: 'verification', class: 'form-control', value: s.verif_code, onInput: event => { const value = event.target.value.trim(); if (value !== s.verif_code) void m.verify(value); } })]),
                    button(t('Save'), m.save, { 'data-action': 'save', disabled: !s.verified }),
                ] : h('p', t('A valid key should contain at least 32 characters chosen from "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".')),
                button(t('Cancel'), m.cancel, { 'data-action': 'cancel' }),
            ]) : null]);
        };
    },
});

/** Authentication routes shared by the root shell and isolated contract fixtures. */
export function mountAuthentication(element, options) {
    const { path } = options;
    let component, model;
    const login = /^\/view\/login\/([^/]+)(?:\/(.*))?$/.exec(path);
    const reset = /^\/view\/reset_password\/([^/]+)$/.exec(path);
    if (login) { component = Login; model = createLogin({ ...options, mode: options.mode ?? login[1] }); }
    else if (path === '/view/totp') { component = Totp; model = createTotp(options); }
    else if (reset || path === '/view/reset_password_send') { component = PasswordReset; model = createPasswordReset({ ...options, serial: reset ? options.serial ?? reset[1] : undefined }); }
    else throw new Error('Unknown authentication route');
    const app = createApp(component, { model, customization: options.customization, prefix: options.prefix }); app.mount(element); void model.start();
    return () => app.unmount();
}
