// Test-only entry: backup-list UI belongs to P87; exercise its editor callback here.
import { createApp, h } from 'vue';
import LinboPage from '../../src/plugins/lmn_linbo4/LinboPage.vue';
import { createImageActions } from '../../src/plugins/lmn_linbo4/images.mjs';
import { backupImage, imageList } from './linbo4-images.mjs';
export function mount(element, aj) {
    const app=createApp({render:()=>h(LinboPage)});app.provide('aj',aj);app.mount(element);
    window.p86editBackup=()=>createImageActions(aj).editImage(backupImage(),imageList());
    return ()=>{delete window.p86editBackup;app.unmount();};
}
