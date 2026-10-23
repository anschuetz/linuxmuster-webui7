<script setup>
import { computed, inject, ref, watch } from 'vue';

/** @type {import('../../../adapter/aj.mjs').Aj} */
const aj = inject('aj');
const configuredLinks = ref([]);
const links = computed(() => configuredLinks.value.filter((link) =>
    Object.keys(link.permissions).includes(aj.identity.profile.sophomorixRole)));

aj.pageTitle.set(aj.gettext('Links'));
watch(() => aj.identity.user, async (user) => {
    if (user == null) return;
    configuredLinks.value = [];
    try {
        const { data } = await aj.http.get('/api/lmn/links');
        configuredLinks.value = data.status === 'success' ? Object.values(data.data) : [];
    } catch {
        // The adapter's HTTP interceptor displays the backend error dialog.
        configuredLinks.value = [];
    }
}, { immediate: true });
</script>

<template>
    <div v-if="links.length === 0" class="alert alert-info" style="margin-top:15px;">
        <i class="fa fa-info-circle"></i> <span>{{ aj.gettext('Currently no links defined!') }}</span>
    </div>
    <div v-for="(link, index) in links" :key="index" class="flex-container info-cards" style="margin-top:10px;">
        <div class="panel panel-info" style="width:100%;">
            <div class="panel-heading" style="padding:10px;height:55px;">
                <img :src="link.icon" height="30px"><span style="font-size:18px;line-height:32px;padding-left:10px;">{{ link.title }}</span>
                <div style="float:right;">
                    <a :href="link.link"><button class="btn btn-default"><i class="fas fa-globe"></i> <span>{{ aj.gettext('Open') }}</span></button></a>
                </div>
            </div>
            <div class="panel-body">{{ link.description }}</div>
        </div>
    </div>
</template>
