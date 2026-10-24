// E2E-only mount: no production entry or plugin consumer.
import { createApp } from 'vue';
import SmbUpload from '../../src/common/SmbUpload.vue';
import { createSmbclient } from '../../src/common/smbclient.mjs';
import { createAjentiAdapter } from '../../src/adapter/ajenti.mjs';

window.P64 = {
    async mount(host, services) {
        const aj = createAjentiAdapter(services);
        const client = createSmbclient(aj);
        const shares = await client.shares(aj.identity.user);
        const home = shares.find((share) => share.name === 'Home').path;
        const state = { client, home, descriptors: undefined };
        const app = createApp(SmbUpload, { uploadpath: home, onUploaded: (files) => { state.descriptors = files; } });
        app.provide('aj', aj);
        app.mount(host);
        return state;
    },
};
