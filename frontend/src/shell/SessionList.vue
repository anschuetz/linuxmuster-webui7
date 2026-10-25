<script setup>
import { onBeforeUnmount } from 'vue';
import { sessionDate } from './widget-format.mjs';
const props = defineProps({ model: { type: Object, required: true } });
const m = props.model, s = m.state, aj = m.aj, t = aj.gettext;
onBeforeUnmount(m.dispose);
</script>
<template>
    <br><div v-if="aj.identity.isSuperuser" class="shell-stock-field"><table style="width:100%" class="table">
        <thead><tr><th>{{ t('User') }} <span class="badge">{{ s.number }}</span></th><th>{{ t('IP') }}</th><th>{{ t('Logged in') }}</th><th>{{ t('Timeout') }}</th></tr></thead>
        <tbody><tr v-for="(session,key) in s.sessions" :key="key">
            <td style="width:20%;font-weight:bold"><span class="badge shell-stock-label bg-info">{{ session.identity }}</span></td><td style="width:20%;color:red"><span class="badge shell-stock-label bg-danger">{{ session.client_info.address }}</span></td>
            <td style="width:20%">{{ sessionDate(session.timestamp) }}</td><td style="width:20%">{{ sessionDate(Number(session.timestamp) + Number(s.session_max_time)) }}</td>
        </tr></tbody>
    </table></div>
    <div v-else class="text-center root-access-blocker"><h1><i class="fa fa-lock"></i></h1><h3>{{ t('Superuser access required') }}</h3></div>
</template>
