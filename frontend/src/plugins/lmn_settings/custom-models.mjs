import { computed } from 'vue';

// Angular ngModel reads missing paths as undefined, creating their parents only
// on an edit. Keep that distinction instead of adding empty roles to POST data.
export function createCustomModels(state) {
    const roles = ['students', 'teachers', 'schooladministrators', 'globaladministrators'];
    const bind = (group, path) => computed({
        get: () => path.reduce((value, key) => value?.[key], state[group]),
        set: value => {
            const update = (previous, keys) => {
                const [key, ...rest] = keys;
                return { ...previous, [key]: rest.length ? update(previous?.[key], rest) : value };
            };
            state[group] = update(state[group], path);
        },
    });
    const fields = (group, prefix) => Object.fromEntries(['title', 'show', 'editable'].map(key => [key, bind(group, [...prefix, key])]));
    return {
        ...Object.fromEntries(['custom', 'customMulti'].map(group => [group, Object.fromEntries(roles.map(role => [role, Object.fromEntries([1, 2, 3, 4, 5].map(index => [index, fields(group, [role, index])]))]))])),
        proxyAddresses: Object.fromEntries(roles.map(role => [role, fields('proxyAddresses', [role])])),
        customDisplay: Object.fromEntries(roles.map(role => [role, Object.fromEntries([1, 2, 3].map(index => [index, bind('customDisplay', [role, index])]))])),
    };
}
