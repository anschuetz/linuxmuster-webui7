import { createApp } from 'vue';
import PasswordChange from './PasswordChange.vue';

export function mount(element, aj) {
    const app = createApp(PasswordChange);
    app.provide('aj', aj);
    app.mount(element);
    return () => app.unmount();
}
