<script setup>
import { inject, onMounted, ref } from 'vue';
const aj = inject('aj');
defineEmits(['cancel']);
const qrdata = ref();
const header = ref();
// The shared modal frame uses Bootstrap's default size; this original dialog is lg.
onMounted(() => header.value.closest('.modal-dialog')?.classList.add('modal-lg'));
aj.http.get('/api/webdav/qrcode').then(({ data }) => { qrdata.value = data; }, () => { /* Adapter handles errors; retain loading values. */ });
</script>
<template>
    <div ref="header" class="modal-header"><h2>{{ aj.gettext('Mobile access') }}</h2></div>
    <div class="modal-body"><i class="fab fa-apple fa-3x pull-right"></i>
        <h3>{{ aj.gettext('Setup guide for iOS') }}</h3>
        <p>{{ aj.gettext('To set up mobile access to the school server from iOS based devices, please proceed as follows:') }}</p>
        <p><img width="100" :src="'/resources/lmn_common/resources/img/app-store-badge.svg'"><span>QR CODE TO APPSTORE</span></p>
        <div class="webdav-ios-tuto"><p>{{ qrdata?.displayName }}</p><p>{{ qrdata?.url }}</p><p>{{ qrdata?.username }}</p><p>{{ aj.gettext('Your password') }}</p></div>
        <h3>{{ aj.gettext('Easy setup') }}</h3>
        <p>{{ aj.gettext('For easy setup, please scan your personal code in the app:<br>').replace(/<br\s*\/?\s*>/g, '') }}<br></p>
        <p style="text-align:center"><img class="centered" :src="qrdata && `data:image/png;base64, ${qrdata.qrcode}`"></p>
    </div>
    <div class="modal-footer"><button class="btn btn-default btn-flat pull-right" @click="$emit('cancel')">{{ aj.gettext('Close') }}</button></div>
</template>
