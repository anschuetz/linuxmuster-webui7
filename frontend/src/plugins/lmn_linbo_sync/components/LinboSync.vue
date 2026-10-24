<script setup>
import { inject, onMounted, shallowRef } from 'vue';
import SyncGroup from './SyncGroup.vue';
const aj = inject('aj'), groups = shallowRef(), school = shallowRef(), active = shallowRef();
onMounted(() => {
    aj.pageTitle.set(aj.gettext('Linbo synchronization'));
    // Errors belong to the adapter; the original leaves the tabset blank.
    aj.http.get('/api/lmn/activeschool').then(resp => { school.value = resp.data; }, () => {});
    aj.http.get('/api/lmn/linbosync/last_syncs').then(resp => {
        groups.value = resp.data;
        active.value = Object.keys(resp.data)[0];
    }, () => {});
});
</script>
<template>
    <div>
        <br>
        <div class="form-group">
            <ul class="nav nav-tabs" role="tablist">
                <li v-for="(_, name) in groups" :key="name" :class="{ active: active === String(name) }" role="presentation">
                    <a href="" role="tab" :aria-selected="active === String(name)" @click.prevent="active = String(name)">{{ name }}</a>
                </li>
            </ul>
            <div class="tab-content">
                <SyncGroup v-for="(details, name) in groups" :key="name" v-show="active === String(name)"
                    class="tab-pane" :class="{ active: active === String(name) }" :name="String(name)" :details="details" :school="school" />
            </div>
        </div>
    </div>
</template>
