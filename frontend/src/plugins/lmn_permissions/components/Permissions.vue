<script setup>
import { computed, inject, ref, watch } from 'vue';
import { roles, columns, headings, cycle, iconify, colorize, provider, logo, methodClass, matchesPlugin, matchesApi, matchesSidebar } from '../matrix.mjs';

const aj = inject('aj');
const tab = ref('Plugins');
const query = ref({ plugin: '', sidebar: '' });
const matrix = ref();
const plugins = computed(() => Object.keys(matrix.value?.[0] ?? {}).sort()
    .filter(name => matchesPlugin(name, query.value.plugin) && Object.keys(matrix.value[0][name].methods).length > 0));
const sidebarUrls = computed(() => Object.keys(matrix.value?.[2] ?? {}).sort()
    .filter(url => matchesSidebar(url, query.value.sidebar, matrix.value[2])));
const sidebarOrphans = computed(() => matrix.value && Object.keys(matrix.value[2]).filter(url => matrix.value[2][url].plugin === 'NOT IMPLEMENTED'));
const apiOrphans = computed(() => matrix.value && Object.keys(matrix.value[1]).filter(id => matrix.value[1][id].name === 'NO DESCRIPTION'));
aj.pageTitle.set(aj.gettext('List all permissions'));
watch(() => aj.identity.user, async user => {
    if (user == null) return;
    matrix.value = undefined;
    try {
        const { data } = await aj.http.get('/api/lmn/permissions');
        matrix.value = data;
    } catch {
        // Existing Angular HTTP interceptors display backend errors.
    }
}, { immediate: true });
function toggleFilter(kind, index) {
    if (index < 1 || index > roles.length) return;
    const role = roles[index - 1];
    query.value = { ...query.value, [kind]: query.value[kind] === role ? '' : role };
}
function change(index, id, role) {
    const values = matrix.value[index];
    matrix.value = matrix.value.map((value, position) => position === index
        ? { ...values, [id]: { ...values[id], [role]: cycle(values[id][role]) } } : value);
}
async function exportPermissions() {
    try {
        // Angular also exposes Export while loading; omitted fields serialize away.
        await aj.http.post('/api/lmn/permissions/export', {
            api: matrix.value?.[1], sidebar: matrix.value?.[2], pluginDict: matrix.value?.[0],
        });
    } catch {
        // The adapter keeps the existing error handling; edits stay available.
    }
}
const image = name => `/resources/lmn_common/resources/img/${logo(name)}`;
</script>

<template>
    <br>
    <div class="c4-permissions">
        <ul class="nav nav-tabs c4-tabs">
            <li v-for="name in ['Plugins', 'Sidebar', 'Orphan']" :key="name" class="nav-item">
                <a class="nav-link" :class="{ active: tab === name }" href="" @click.prevent="tab = name">{{ name }}</a>
            </li>
        </ul>
        <div v-if="tab === 'Plugins'">
            <input v-model="query.plugin" type="search" autofocus class="form-control" placeholder="Filter per plugin name or per role">
            <div v-for="plugin in plugins" :key="plugin">
                <img :src="image(matrix[0][plugin].provider)" class="float-end" height="33">
                <h2>{{ plugin }}</h2>
                <div class="c4-table-scroll"><table :id="'table_' + plugin" class="table" style="width:100%">
                    <tbody>
                        <tr><th v-for="(heading, index) in headings" :key="heading" @click="toggleFilter('plugin', index)">{{ aj.gettext(heading) }}</th></tr>
                        <template v-for="url in Object.keys(matrix[0][plugin].methods)" :key="url">
                            <tr><td colspan="6"><b>{{ url }}</b></td></tr>
                            <tr v-for="(details, index) in matrix[0][plugin].methods[url].filter(details => matchesApi(details, query.plugin, matrix[1]))" :key="index">
                                <td style="width:300px;border-top-width:0" :title="details.doc">
                                    <i :class="['fas', details.auth ? 'fa-lock' : 'fa-lock-open']"></i>
                                    <i v-if="details.api" class="fas fa-project-diagram"></i>
                                    <i v-if="details.page" class="far fa-file"></i>
                                    <span v-if="details.method" :class="['badge', 'c4-badge', { success: 'bg-success', primary: 'bg-primary', info: 'bg-info', danger: 'bg-danger', default: 'bg-secondary' }[methodClass(details.method)]]">{{ details.method }}</span>
                                    <span class="badge c4-badge bg-secondary">{{ details.permission_id }}</span>
                                </td>
                                <template v-if="details.permission_id">
                                    <td v-for="role in columns" :key="role" style="text-align:center;border-top-width:0" @click="change(1, details.permission_id, role)">
                                        <i :class="['fas', 'fa-' + iconify(matrix[1][details.permission_id][role])]" :style="colorize(matrix[1][details.permission_id][role])"></i>
                                    </td>
                                </template>
                                <td v-else colspan="5" style="text-align:center;border-top-width:0">{{ aj.gettext('No authorization set for this method.') }}</td>
                            </tr>
                        </template>
                    </tbody>
                </table></div>
            </div>
        </div>
        <div v-else-if="tab === 'Sidebar'">
            <input v-model="query.sidebar" type="search" autofocus class="form-control" placeholder="Filter per URL or per role">
            <div class="c4-table-scroll"><table class="table" style="width:100%">
                <tbody>
                    <tr><th v-for="(heading, index) in headings" :key="heading" @click="toggleFilter('sidebar', index)">{{ aj.gettext(heading) }}</th></tr>
                    <tr v-for="url in sidebarUrls" :key="url">
                        <td style="width:300px"><img :src="image(provider(url))" class="float-end" height="33"><b>{{ url }}</b><br><i>Plugin {{ matrix[2][url].plugin }}</i><br></td>
                        <td v-for="role in columns" :key="role" style="text-align:center" @click="change(2, url, role)">
                            <i :class="['fas', 'fa-' + iconify(matrix[2][url][role])]" :style="colorize(matrix[2][url][role])"></i>
                        </td>
                    </tr>
                </tbody>
            </table></div>
        </div>
        <div v-else>
            <template v-for="(orphans, index) in [sidebarOrphans, apiOrphans]" :key="index">
                <h2>{{ aj.gettext(index === 0 ? 'Sidebar' : 'Permissions') }}</h2>
                <div v-if="orphans?.length > 0" class="alert alert-warning">
                    <span>{{ aj.gettext('Elements listed in default-ui-permissions.ini but not used :') }}</span>
                    <ul><li v-for="url in orphans" :key="url">{{ url }}</li></ul>
                </div>
                <p v-if="orphans?.length === 0" class="alert alert-success">{{ aj.gettext(index === 0 ? 'No orphan element in the sidebar permissions !' : 'No orphan element in the permissions !') }}</p>
            </template>
        </div>
        <component :is="'floating-toolbar'" class="c4-toolbar">
            <div class="container"><div class="row aj-theme-toolbar-layout">
                <div class="aj-theme-toolbar-offset permissions-toolbar-offset"></div>
                <div class="aj-theme-toolbar-main permissions-toolbar-main"><div class="bar aj-theme-toolbar">
                    <button class="btn btn-lmn" @click="exportPermissions">{{ aj.gettext('Export permissions file') }}</button>
                </div></div>
            </div></div>
        </component>
    </div>
</template>
