<script setup>
defineProps(['data', 'qr', 'peer']);
</script>
<template>
    <div style="margin:10px"><h2>Wireguard-Konfiguration "{{ peer }}"</h2>
        <div v-if="!data" class="alert alert-warning" role="alert">No configuration is available for this user. Please contact an administrator.</div>
        <img v-else-if="qr" style="width:100%" :src="`data:image/png;base64,${data}`">
        <pre v-else>{{ data.data }}</pre>
    </div>
</template>
