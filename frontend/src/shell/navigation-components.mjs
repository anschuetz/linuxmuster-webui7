import { defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue';

// Same anchor scheme allowlist as AngularJS $$sanitizeUri, including relative links.
function href(value) {
    const anchor = document.createElement('a'); anchor.href = value;
    return /^(https?|ftp|mailto|tel|file):$/.test(anchor.protocol) ? value : `unsafe:${value}`;
}

function useBodyClasses(nav) {
    const classes = ['widescreen-mode-on', 'widescreen-mode-off', ...(nav.customization.plugins?.core?.bodyClass ?? '').split(/\s+/).filter(Boolean)];
    const original = classes.map(name => [name, document.body.classList.contains(name)]);
    watchEffect(() => {
        document.body.classList.toggle('widescreen-mode-on', Boolean(nav.layout.widescreen));
        document.body.classList.toggle('widescreen-mode-off', !nav.layout.widescreen);
        classes.slice(2).forEach(name => document.body.classList.add(name));
    });
    onBeforeUnmount(() => original.forEach(([name, present]) => document.body.classList.toggle(name, present)));
}

// Observe actual wrapping, fonts, customization, zoom and viewport changes together.
function useHeaderHeight() {
    const navbar = ref(null), root = document.documentElement;
    const previous = root.style.getPropertyValue('--shell-header-height');
    let observer;
    onMounted(() => {
        const update = () => {
            const height = navbar.value.getBoundingClientRect().height;
            if (height > 0) root.style.setProperty('--shell-header-height', `${height}px`);
        };
        update();
        if (globalThis.ResizeObserver) { observer = new ResizeObserver(update); observer.observe(navbar.value); }
    });
    onBeforeUnmount(() => {
        observer?.disconnect();
        if (previous) root.style.setProperty('--shell-header-height', previous);
        else root.style.removeProperty('--shell-header-height');
    });
    return navbar;
}

const SidebarItem = defineComponent({
    props: ['item', 'nav', 'gettext'],
    setup(props) {
        const expanded = ref(false);
        return () => {
            const { item, nav, gettext } = props, children = item.children ?? [];
            if (item.isTopLevel && !children.length) return null;
            const open = item.isRoot || item.isTopLevel || expanded.value;
            const ordered = item.isRoot ? children : [...children].sort((a, b) =>
                (a.weight ?? Infinity) - (b.weight ?? Infinity) || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : a.name.toLowerCase() > b.name.toLowerCase() ? 1 : 0));
            return h('div', { class: ['sidebar-item', 'nav-item', { isRoot: item.isRoot, isTopLevel: item.isTopLevel,
                hasChildren: children.length > 0, active: `${nav.prefix}${item.url}` === nav.layout.path }] }, [
                item.isTopLevel ? h('h5', gettext(item.name)) : null,
                !item.isRoot && !item.isTopLevel ? h('div', [
                    children.length ? h('a', { href: '#', class: 'expander', onClick: event => {
                        event.preventDefault(); event.stopPropagation(); expanded.value = !expanded.value;
                    } }, [h('i', { class: `fa fa-fw fa-caret-${open ? 'down' : 'right'}` })]) : null,
                    h('a', { class: 'link nav-link', href: href(`${item.url.startsWith('/') ? nav.prefix + item.url : item.url}/`) }, [
                        h('i', { class: ['sidebar-link-icon', item.icon.includes(' ') ? `fa-fw ${item.icon}` : `fa fa-fw fa-${item.icon}`] }), gettext(item.name),
                    ]),
                ]) : null,
                h('div', { class: 'children', style: { display: open && children.length ? '' : 'none' } },
                    ordered.map((child, index) => h(SidebarItem, { key: child.id ?? index, item: child, nav, gettext }))),
            ]);
        };
    },
});

export const ShellNavigation = defineComponent({
    props: ['nav', 'aj', 'identityDetails', 'sessionState', 'devMode'],
    setup(props, { slots }) {
        const dropdown = ref(false), input = ref(null), draft = ref('');
        const navbar = useHeaderHeight();
        useBodyClasses(props.nav);
        const dismiss = event => {
            if (event.key === 'Escape' || (event.type === 'click' && !event.target.closest('.dropdown'))) dropdown.value = false;
        };
        document.addEventListener('click', dismiss); document.addEventListener('keydown', dismiss);
        onBeforeUnmount(() => { document.removeEventListener('click', dismiss); document.removeEventListener('keydown', dismiss); });
        let touchX, touchY;
        watch(() => props.nav.search.visible, async visible => {
            if (visible) { draft.value = props.nav.search.query ?? ''; await nextTick(); input.value?.focus(); }
        });
        const swipeStart = event => { touchX = event.changedTouches[0].clientX; touchY = event.changedTouches[0].clientY ?? 0; };
        const swipeEnd = event => {
            const distance = event.changedTouches[0].clientX - touchX;
            const vertical = Math.abs((event.changedTouches[0].clientY ?? 0) - touchY);
            if (Math.abs(distance) > 30 && vertical < 75 && vertical / Math.abs(distance) < 0.3) props.nav.toggleOverlayNavigation(distance > 0);
        };
        return () => {
            const { nav, aj } = props, { layout, search } = nav, identity = aj.identity, t = aj.gettext;
            const core = nav.customization.plugins?.core ?? {}, details = props.identityDetails ?? {};
            const sidebar = mobile => h('div', { id: mobile ? 'shell-mobile-navigation' : undefined, class: mobile ? 'sidebar overlay-sidebar animate-sidebar hide-desktop hide-large' : 'col-md-3 sidebar hide-tablet hide-phone',
                style: { display: layout.navigationPresent && (mobile ? layout.overlay : layout.sidebar) ? '' : 'none' },
                onTouchstart: swipeStart, onTouchend: swipeEnd }, [
                slots.tasks?.(),
                h('div', core.sidebarUpperContent ?? ''),
                nav.sidebar.item ? h(SidebarItem, { item: nav.sidebar.item, nav, gettext: t }) : null,
                h('div', core.sidebarLowerContent ?? ''),
            ]);
            return [
                h('nav', { ref: navbar, class: 'navbar shell-navbar fixed-top' }, [
                    props.devMode && identity.user ? h('button', { class: 'btn btn-danger shell-restart-button float-end', 'data-action': 'restart-panel', onClick: () => aj.forceRestart() }, [h('i', { class: 'fas fa-redo' })]) : null,
                    h('div', { class: 'container' }, [
                        ...[false, true].map(mobile => h('button', { class: ['navbar-brand navigation-toggle', mobile ? 'mobile-navigation hide-desktop hide-large' : 'hide-phone hide-tablet'],
                            'aria-expanded': mobile ? layout.overlay : layout.sidebar, 'aria-controls': mobile ? 'shell-mobile-navigation' : undefined,
                            style: { display: layout.navigationPresent ? '' : 'none' }, 'aria-label': t('Navigation'),
                            onClick: () => mobile ? nav.toggleOverlayNavigation() : nav.toggleNavigation() }, [h('i', { class: 'fa fa-navicon' })])),
                        core.logoURL ? h('a', { class: 'navbar-brand', href: `${nav.prefix}/view/` }, [h('img', { src: core.logoURL })]) : null,
                        h('a', { class: 'navbar-brand ellipsis', href: `${nav.prefix}/view/` }, [t('School Console'), aj.state?.pageTitle ? h('span', { class: 'subtitle hide-phone hide-tablet' }, ` > ${t(aj.state.pageTitle)}`) : null]),
                        h('button', { class: 'navbar-brand navigation-toggle hide-phone hide-tablet float-end', 'aria-label': t('Widescreen'), onClick: () => nav.toggleWidescreen() },
                            [h('i', { class: `fa fa-${layout.widescreen ? 'compress' : 'expand'}` })]),
                        identity.user ? h('div', { class: ['float-end dropdown', { show: dropdown.value }] }, [
                            h('button', { class: ['btn btn-light shell-profile-button profile-button', { superuser: identity.isSuperuser }], 'aria-expanded': dropdown.value,
                                onClick: () => { dropdown.value = !dropdown.value; } }, [identity.user[0].toUpperCase(), identity.isSuperuser ? h('span', { class: 'rank' }, [h('i', { class: 'fa fa-angle-double-up' })]) : null]),
                            h('ul', { class: ['dropdown-menu dropdown-menu-end', { show: dropdown.value }] }, [
                                h('li', [h('div', [h('span', { class: 'subtle float-end' }, `UID ${details.effective ?? ''}`), h('i', { class: 'fa fa-fw fa-user' }), ` ${identity.user}`])]),
                                h('li', { class: 'hide-tablet hide-desktop hide-large' }, details.machine?.name),
                                ...(core.extraProfileMenuItems ?? []).map(item => h('li', [h('a', { class: 'extra-profile dropdown-item', href: href(item.url) }, [h('i', { class: `fa fa-fw fa-${item.icon}` }), item.name])])),
                                h('li', [h('a', { class: 'totp dropdown-item', href: '#', onClick: event => { event.preventDefault(); nav.manageTotp(); } }, [h('i', { class: 'fas fa-lock' }), ` ${t('TFA')}`])]),
                                h('li', [h('a', { class: 'logout dropdown-item', href: '#', onClick: event => { event.preventDefault(); nav.logout(); } }, [h('i', { class: 'fa fa-fw fa-power-off' }), ` ${t('Log out')}`])]),
                            ]),
                        ]) : null,
                        h('p', { class: 'navbar-text float-end hide-phone' }, details.machine?.name),
                        identity.user && props.sessionState ? h('span', { class: 'float-end sessiontime hide-phone' }, `${t('Session time :')} ${props.sessionState.counter.join(':')}`) : null,
                        identity.user && identity.profile.school_show ? h('p', { class: 'navbar-text float-end hide-phone' }, [
                            identity.profile.activeSchool, ' ', h('a', { class: 'school-change', href: `${nav.prefix}/view/lmn/change-school` }, `(${t('change')})`),
                        ]) : null,
                    ]),
                ]),
                h('div', { class: 'container' }, [h('div', { class: 'row' }, [sidebar(false),
                    h('div', { class: 'content shell-content', onTouchstart: swipeStart, onTouchend: swipeEnd }, slots.default?.())]), sidebar(true)]),
                search.visible ? h('div', { class: 'navbox-overlay' }, [h('div', { class: 'navbox-box' }, [
                    h('input', { ref: input, type: 'search', class: 'form-control', placeholder: t('Quick search'), value: draft.value,
                        onInput: event => { draft.value = event.target.value; nav.setQuery(draft.value); },
                        onKeydown: event => { if (event.key === 'Enter') nav.openResult(search.results?.[0]); },
                        onKeyup: event => { if (event.key === 'Escape') nav.cancelSearch(); } }),
                    h('div', { class: 'list-group' }, (search.results ?? []).map((result, index) => h('a', {
                        class: 'list-group-item', href: href(`${nav.prefix}${result.url}`), onClick: event => { event.preventDefault(); nav.openResult(result); },
                    }, [index === 0 ? h('code', { class: 'navbox-hotkey float-end' }, t('Enter')) : null,
                        h('i', { class: `fa fa-fw fa-${result.icon}` }), t(result.title)]))),
                ])]) : null,
            ];
        };
    },
});
