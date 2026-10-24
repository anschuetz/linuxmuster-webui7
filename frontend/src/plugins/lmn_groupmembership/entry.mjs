import { createApp } from 'vue';
import { createSmbclient } from '../../common/smbclient.mjs';
import Groupmembership from './Groupmembership.vue';

export function mount(element, aj) {
    const app = createApp(Groupmembership);
    app.provide('aj', aj);
    app.provide('smbclient', createSmbclient(aj));
    app.mount(element);
    return () => app.unmount();
}
