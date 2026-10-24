export function setupURL(setup, href = window.location.href) {
    return `https://${setup.hostip || '10.0.0.1'}:${new URL(href).port}`;
}
export function redirect(url) { window.location.href = url; }
