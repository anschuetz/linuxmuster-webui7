import { createApp } from 'vue';
import Wizard from './Wizard.vue';
import { connectCore } from './core.mjs';

let core;
// Called once by this plugin's Angular run hook, before any route is mounted.
export function configure(services) { core = services; }
export function mount(element, aj) {
    const app = createApp(Wizard, { step: element.dataset.step });
    app.provide('aj', aj.wizard ? aj : connectCore(aj, core));
    app.mount(element);
    return () => app.unmount();
}
