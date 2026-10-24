<script setup>
import { inject, onBeforeUnmount, ref } from 'vue';
import GroupsTab from './GroupsTab.vue';
import { createGroups, initialTab } from './groups.mjs';
const aj = inject('aj');
const emit = defineEmits(['edit-config', 'import-devices', 'download-iso']);
const groups = createGroups(aj);
const { state } = groups;
const tab = ref(initialTab(window.location.hash));
aj.pageTitle.set(aj.gettext('LINBO 4'));
const offLeave = aj.guardLeave(() => !state.changed || window.confirm(aj.gettext('You should call an import devices process to apply the new changes, quit this page anyway ?')));
onBeforeUnmount(offLeave);
groups.load();
// Subsequent parts supply editor/import/images here; production remains Angular until part 5.
</script>

<template>
    <br>
    <component :is="'progress-spinner'" v-if="state.configs === undefined" role="status"><div><div class="one"></div><div class="two"></div></div></component>
    <div v-else>
        <ul class="nav nav-tabs">
            <li :class="{ active: tab === 0 }"><a href="" @click.prevent="tab = 0">{{ aj.gettext('Groups') }}</a></li>
            <li :class="{ active: tab === 1 }"><a href="" @click.prevent="tab = 1">{{ aj.gettext('Images') }}</a></li>
        </ul>
        <GroupsTab v-show="tab === 0" :configs="state.configs" :examples="state.examples" :changed="state.changed"
            @create-config="groups.createConfig" @duplicate-config="groups.duplicateConfig" @delete-config="groups.deleteConfig"
            @edit-config="(...args) => emit('edit-config', ...args)" @import-devices="emit('import-devices')" @download-iso="emit('download-iso')" />
        <div v-show="tab === 1"><slot name="images" :images="state.images" /></div>
    </div>
</template>
