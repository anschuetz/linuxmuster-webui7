<script setup>
import { computed, inject } from 'vue';
import { formatUptime, formatBytes } from './widget-format.mjs';
const props = defineProps({ widget: { type: Object, required: true }, value: { default: undefined }, sessions: { default: undefined } });
const aj = inject('aj'), t = aj.gettext;
const type = computed(() => props.widget.typeId);
const cpu = computed(() => {
    const values = props.value || [];
    return { active: values.filter(x => x > 0).length, count: values.length, percent: Math.floor(values.reduce((sum, x) => sum + x / values.length, 0) * 100) };
});
const usage = computed(() => props.value === undefined ? undefined : Math.floor(100 * props.value.used / props.value.total));
</script>
<template>
    <div v-if="type === 'hostname'"><div class="widget-header">{{ t('Hostname') }}</div><div class="widget-value">{{ value }}</div></div>
    <div v-else-if="type === 'uptime'"><div class="widget-header">{{ t('Uptime') }}</div><div class="widget-value">{{ formatUptime(value) }}</div></div>
    <div v-else-if="type === 'loadavg'" class="row aj-theme-grid"><div v-for="(label,i) in ['1 min','5 min','15 min']" :key="label" class="col-4 shell-widget-column"><div class="widget-header">{{ t(label) }}</div><div class="widget-value">{{ value?.[i] }}</div></div></div>
    <div v-else-if="type === 'cpu'" class="row aj-theme-grid">
        <div class="col-4 shell-widget-column"><div class="widget-header">{{ t('Active cores') }}</div><progress :value="cpu.active" :max="cpu.count || 1"></progress><div class="widget-value">{{ value === undefined ? '/' : `${cpu.active}/${cpu.count}` }}</div></div>
        <div class="col-8 shell-widget-column"><div class="widget-header">{{ t('CPU usage') }}</div><progress :value="cpu.percent" max="100"></progress><div class="widget-value">{{ value === undefined ? '' : cpu.percent }}%<sup v-if="cpu.percent > 95"><span class="badge shell-stock-label bg-danger"><i class="fa fa-warning"></i></span></sup></div></div>
    </div>
    <div v-else-if="type === 'memory' || type === 'disk'" class="row aj-theme-grid">
        <div v-if="!widget.config?.hideTotal" class="col-4 shell-widget-column"><div class="widget-header">{{ t('Total') }}</div><progress max="1" value="0"></progress><div class="widget-value">{{ formatBytes(value?.total,t) }}</div></div>
        <div class="col-8 shell-widget-column"><div class="widget-header">{{ type === 'disk' ? `${t('Filesystem')}: ${widget.config?.mountpoint ?? ''}` : t('Memory usage') }}</div><progress :value="Number.isFinite(usage) ? usage : undefined" max="100"></progress><div class="widget-value">{{ usage }}%<sup v-if="usage > 90"><span class="badge shell-stock-label bg-danger"><i class="fa fa-warning"></i></span></sup></div></div>
    </div>
    <div v-else-if="type === 'datetime'"><div class="widget-header">Date Time</div><div class="widget-value">{{ value || 'Unknown' }}</div></div>
    <div v-else-if="type === 'sessions'" class="widget-header"><p>{{ t('Authenticated users') }}</p><div><p v-for="(session,key) in sessions" :key="key" class="text-primary">{{ session.identity }}<span class="float-end">{{ session.client_info.address }}</span></p></div></div>
</template>
