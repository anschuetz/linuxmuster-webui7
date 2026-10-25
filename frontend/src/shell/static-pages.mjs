import { defineComponent, h } from 'vue';

/** Stock's unbound UI sample and error page, plus LM's disabled-quota notice. */
export const StaticPage = defineComponent({
    props: ['kind', 'prefix', 'route', 'gettext'],
    setup(props) {
        return () => {
            const t = props.gettext;
            if (props.kind === 'configuration-error') return h('div', { role: 'alert', class: 'alert alert-danger' }, t('Could not load config'));
            if (props.kind === 'quotas-disabled') return h('div', { class: 'text-center' }, [
                h('h2', 'Quotas are disabled'), h('a', { class: 'btn btn-light shell-stock-button btn-lg', href: `${props.prefix}/view/lmn/settings` }, ['Enable quotas in the Settings ', h('i', { class: 'fa fa-arrow-right' })]),
            ]);
            if (props.kind === 'ui-test') return h('div', [h('h1', 'Index'),
                ...['Send a task', 'Boom', 'Click', 'Click', 'Click', 'Click', 'Click'].flatMap((text, index) => [
                    h('a', { class: `btn btn-${['light shell-stock-button', 'light shell-stock-button', 'light shell-stock-button', 'warning', 'success', 'info', 'danger'][index]}` }, text), h('br'), h('br'),
                ]), h('div', { class: 'list-group' }, ['Alpha', 'Bravo', 'Charlie'].map(text => h('a', { class: 'list-group-item' }, text))),
            ]);
            const url = `${window.location.origin}${props.prefix}${props.route.fullPath}`;
            return h('div', { class: 'container' }, [h('div', { class: 'row', id: '404' }, [h('div', [
                h('h1', t('404 - Page not found')), h('p', { class: 'alert alert-danger' }, [h('i', { class: 'fa fa-exclamation-triangle', style: { color: 'red' } }),
                    t('The URL {{url}} was not found on this server.').replace('{{url}}', url)]),
            ])])]);
        };
    },
});
