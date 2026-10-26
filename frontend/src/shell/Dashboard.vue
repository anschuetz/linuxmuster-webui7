<script setup>
import { computed, inject, onBeforeUnmount } from 'vue';
import Widget from './Widget.vue';
const props = defineProps({ model: { type: Object, required: true } });
const aj = inject('aj'), t = aj.gettext, m = props.model, s = m.state;
onBeforeUnmount(m.dispose);
const tabs = computed(() => s.userConfig?.dashboard.tabs || []);
const types = computed(() => Object.fromEntries(s.availableWidgets.map(type => [type.id,type])));
const available = computed(() => [...s.availableWidgets].sort((a,b) => t(a.name).toLowerCase().localeCompare(t(b.name).toLowerCase())));
const selected = computed(() => tabs.value[s.activeTabIndex]);
let dragged;
function drag(event,id) { dragged = id; event.dataTransfer?.setData('text/plain',id); }
function drop(column,position) { if (dragged) void m.moveWidget(s.activeTabIndex, dragged, column, position); dragged = undefined; }
const mountpoint = computed({ get: () => s.configuredWidget.config.mountpoint ?? '', set: value => m.updateWidgetConfig('mountpoint',value === '' ? null : value) });
const format = computed({ get: () => s.configuredWidget.config.format, set: value => m.updateWidgetConfig('format',value) });
</script>
<template>
    <br><div v-if="!s.ready" role="status" class="progress-spinner"><i class="fa fa-spinner fa-spin"></i></div>
    <div v-if="s.ready">
        <div v-if="m.customization.allowAdd" class="float-end">
            <span>{{ t('Tabs') }}</span>
            <button class="btn btn-light shell-stock-button subtle" data-action="add-tab" @click="m.addTab()">{{ t('Add') }}</button>
            <button class="btn btn-light shell-stock-button subtle" data-action="rename-tab" @click="m.renameTab(s.activeTabIndex)">{{ t('Rename') }}</button>
            <button v-if="tabs.length > 1" class="btn btn-light shell-stock-button subtle" data-action="remove-tab" @click="m.removeTab(s.activeTabIndex)">{{ t('Remove') }}</button>
            <button v-for="width in [1,2]" :key="width" class="btn btn-light shell-stock-button subtle" :data-action="`width-${width}`" :aria-label="String(width)" @click="m.setWidth(s.activeTabIndex,width)"><i class="fa" :class="width === 1 ? 'fa-stop' : 'fa-pause'"></i></button>
            <details><summary>{{ t('Add widget') }}</summary><button v-for="type in available" :key="type.id" class="btn btn-light shell-stock-button" :data-add-widget="type.id" @click="m.addWidget(s.activeTabIndex,type)">{{ t(type.name) }}</button></details>
        </div>
        <ul class="nav nav-tabs shell-dashboard-tabs" role="tablist"><li v-for="(tab,i) in tabs" :key="i" class="nav-item"><button class="nav-link" :class="{active:s.activeTabIndex === i}" role="tab" :aria-selected="s.activeTabIndex === i" :data-tab="i" @click="s.activeTabIndex=i">{{ tab.name }}</button></li></ul>
        <div v-if="selected" class="dashboard-widgets-container"><div class="row aj-theme-grid">
            <div v-for="column in ['widgetsLeft','widgetsRight']" v-show="column === 'widgetsLeft' || selected.width === 2" :key="column" :data-column="column" :class="column === 'widgetsRight' || selected.width === 2 ? 'aj-theme-half' : selected.width === 1 ? 'aj-theme-full' : undefined" @dragover.prevent @drop.prevent="drop(column)">
                <div v-for="(widget,i) in selected[column]" :key="widget.id" class="widget" :data-widget="widget.id" @dragover.prevent @drop.stop.prevent="drop(column,i)">
                    <button v-if="types[widget.typeId]?.config_template && m.customization.allowConfigure" class="widget-btn config-btn btn btn-light shell-stock-button" data-action="configure" :title="t('Configure')" @click="m.configureWidget(widget.id)"><i class="fa fa-fw fa-wrench"></i></button>
                    <a v-if="m.customization.allowMove" class="widget-btn move-btn btn btn-light shell-stock-button" draggable="true" data-action="move" :aria-label="t('Move')" @dragstart="drag($event,widget.id)" @dragend="dragged=undefined"><i class="fa fa-fw fa-arrows"></i></a>
                    <button v-if="m.customization.allowRemove" class="widget-btn remove-btn btn btn-light shell-stock-button" data-action="remove" :title="t('Remove')" @click="m.removeWidget(s.activeTabIndex,widget.id)"><i class="fa fa-fw fa-trash-o"></i></button>
                    <Widget :widget="widget" :value="s.values[widget.id]" :sessions="s.sessions[widget.id]" />
                </div>
            </div>
        </div></div>
        <dialog v-if="s.configuredWidget" open :aria-label="t(types[s.configuredWidget.typeId].name)">
            <div class="modal-header"><h4>{{ t(types[s.configuredWidget.typeId].name) }}</h4></div>
            <div class="modal-body">
                <label v-if="s.configuredWidget.typeId === 'disk'">{{ t('Filesystem') }}<select v-model="mountpoint" name="mountpoint" class="form-control form-select shell-stock-select"><option value="">{{ t('All combined') }}</option><option v-for="point in s.mountpoints" :key="point" :value="point">{{ point }}</option></select></label>
                <label v-if="s.configuredWidget.typeId === 'datetime'">Format<select v-model="format" name="format" class="form-control form-select shell-stock-select"><option value="%d.%m.%Y %H:%M">Date Time</option><option value="%d.%m.%Y">Date</option><option value="%H:%M">Time</option></select></label>
            </div>
            <div class="modal-footer"><button class="btn btn-light shell-stock-button btn-flat" data-action="save-config" @click="m.saveWidgetConfig()">{{ t('Save') }}</button></div>
        </dialog>
    </div>
</template>
