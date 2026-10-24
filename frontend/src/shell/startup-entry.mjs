import { start } from './startup.mjs';
void start(window.LmnShellBootstrap).catch(error => {
    console.error('Shell bootstrap failed', error);
    const host = document.getElementById('lmn-shell') || document.body;
    host.textContent = 'Could not start the panel. ';
});
