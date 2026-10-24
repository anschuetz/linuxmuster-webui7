import { computed, effectScope, reactive, shallowRef, watchEffect } from 'vue';

// Core 0.116 palette and 16px glyph; customization URLs override identity color.
const colors = { red: '#F44336', bluegrey: '#607D8B', purple: '#9C27B0', blue: '#2196F3', default: '#2196F3',
    cyan: '#00BCD4', green: '#4CAF50', deeporange: '#FF5722', orange: '#FF9800', teal: '#009688' };
export function createFavicon({ identity, customization }) {
    const scope = effectScope(), themeColor = shallowRef();
    function setURL(url) {
        const link = document.querySelector('link[rel="shortcut icon"]');
        if (link) { link.type = 'image/x-icon'; link.href = url; }
    }
    function set(color) {
        themeColor.value = colors[color];
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.content = colors[color] ?? '';
        const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
        const context = canvas.getContext('2d');
        context.fillStyle = colors[color];
        const rectangles = color ? [[4, 4, 3, 8], [4, 4, 8, 3], [9, 4, 3, 8], [4, 9, 8, 3]] : [[1, 6, 4, 4], [6, 6, 4, 4], [11, 6, 4, 4]];
        rectangles.forEach(rect => context.fillRect(...rect)); setURL(canvas.toDataURL());
    }
    function init() {
        scope.run(() => watchEffect(() => {
            const url = customization.plugins?.core?.faviconURL;
            if (url) setURL(url); else set(identity.color);
        }));
    }
    return { init, set, setURL, state: reactive({ themeColor: computed(() => themeColor.value) }), dispose: () => scope.stop() };
}
