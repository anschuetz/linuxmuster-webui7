import { defineComponent, h, inject } from 'vue';

// Original gettext keys can contain static icons and inline code. Render those
// nodes without v-html or executable catalog attributes; keep complete msgids.
const inlineTags = new Set(['I', 'CODE', 'SPAN', 'BR', 'B', 'STRONG', 'EM', 'A']);
function nodes(parent) {
    return [...parent.childNodes].map(node => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent;
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        if (!inlineTags.has(node.tagName)) return node.textContent;
        const attrs = node.hasAttribute('class') ? { class: node.getAttribute('class') } : {};
        if (node.tagName === 'A' && node.hasAttribute('href')) {
            const href = node.getAttribute('href');
            if (/^https?:\/\//i.test(href)) attrs.href = href;
        }
        return h(node.tagName.toLowerCase(), attrs, nodes(node));
    });
}
export default defineComponent({
    props: ['tag', 'text'],
    setup(props) {
        const aj = inject('aj');
        return () => {
            const template = document.createElement('template');
            template.innerHTML = aj.gettext(props.text);
            return h(props.tag, null, nodes(template.content));
        };
    },
});
