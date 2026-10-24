<script setup>
defineProps({ peer: String, config: String, qr: String });
</script>
<template>
    <div style="margin:10px"><h2>Wireguard-Konfiguration "{{ peer }}"</h2><pre v-if="config !== undefined">{{ config }}</pre><img v-else style="width:100%" :src="'data:image/png;base64,' + qr"></div>
</template>
