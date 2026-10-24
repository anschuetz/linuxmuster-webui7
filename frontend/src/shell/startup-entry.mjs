import { start } from './startup.mjs';
void start(window.LmnShellBootstrap).catch(error => {
    console.error('Shell bootstrap failed', error);
    const host = document.getElementById('lmn-shell') || document.body;
    host.textContent = 'Could not start the panel. ';
    const fallback = document.createElement('a');
    const url = new URL(window.location.href); url.searchParams.set('shell', 'angular');
    fallback.href = url.href; fallback.textContent = 'Open previous interface'; host.append(fallback);
});
