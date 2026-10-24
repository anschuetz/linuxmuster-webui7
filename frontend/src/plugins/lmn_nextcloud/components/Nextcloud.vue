<script setup>
import { inject, ref, watch } from 'vue';

const aj = inject('aj');
const shell = aj.shell;
const responsecode = ref(1);
aj.pageTitle.set(aj.gettext('Nextcloud'));
watch(() => aj.identity.user, async user => {
    if (user == null) return;
    let data;
    try {
        ({ data } = await aj.http.get('/api/lmn/nextcloud'));
    } catch {
        // As in Angular, retain the current state; the adapter owns HTTP errors.
        return;
    }
    responsecode.value = data[0];
    if (responsecode.value === 200) {
        if (data[2]) { shell.toggleNavigation(); shell.toggleWidescreen(); }
        const url = data[1] + (data[3] ? `/index.php/login?user=${aj.identity.user}` : '');
        window.open(url, 'iframe_nextcloud');
    }
}, { immediate: true });
</script>

<template>
    <component :is="'progress-spinner'" v-show="responsecode === 1" class="nextcloud-spinner" style="margin-top:20px;">
        <div><div class="one"></div><div class="two"></div></div>
    </component>
    <div v-show="responsecode !== 200 && responsecode !== 1" class="alert alert-info" style="margin-top:10px;">
        <i class="fa fa-info-circle"></i> <span>{{ aj.gettext('URL not found or not valid! Please check config file.') }}</span>
        <span></span>
    </div>
    <div v-show="responsecode === 200" style="width:auto;height:100vh;margin-left:-15px;margin-right:-15px;margin-top:-60px;">
        <iframe name="iframe_nextcloud" style="width:100%;height:100%;border:0;margin-top:60px;"></iframe>
    </div>
</template>
