import { defineComponent, h, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/** Isolated host: the caller selects a plugin; this component owns no routing. */
export default defineComponent({
    name: 'RouteHost',
    props: {
        plugin: { type: String, default: null },
        aj: { type: Object, required: true },
        attrs: { type: Object, default: () => ({}) },
        registerStop: Function,
    },
    setup(props) {
        const element = ref(null);
        let dispose;
        function unmount() {
            const previous = dispose;
            dispose = undefined;
            previous?.();
        }
        function mount() {
            unmount();
            if (!props.plugin) return;
            const name = `LmnVue_${props.plugin}`;
            const entry = window[name];
            if (typeof entry?.mount !== 'function') {
                throw new Error(`Missing plugin entry: ${name}.mount`);
            }
            for (const [key, value] of Object.entries(props.attrs)) element.value.setAttribute(key, value);
            dispose = entry.mount(element.value, props.aj);
            props.registerStop?.(unmount);
        }
        onMounted(mount);
        watch(() => [props.plugin, props.aj], mount, { flush: 'post' });
        onBeforeUnmount(unmount);
        return () => h('div', { ref: element });
    },
});
