<script setup>
import { computed, inject } from 'vue';
import { imageBytes } from './images.mjs';
const props = defineProps({ image: { type: Object, required: true }, getImage: Function, editImage: Function, restoreBackup: Function, deleteBackupImage: Function });
const emit = defineEmits(['close']);
const aj = inject('aj');
const current = computed(() => props.getImage?.() ?? props.image);
// Angular orderBy:'-timestamp' keeps the source order for equal timestamps.
const backups = computed(() => current.value.backups_list.map((backup, index) => ({ backup, index }))
    .sort((a, b) => b.backup.timestamp - a.backup.timestamp || a.index - b.index).map(item => item.backup));
const lines = text => text ? text.split('\n') : [];
</script>

<template>
    <div class="modal-header"><h4>{{ current.name }} - {{ aj.gettext('Backups') }}</h4></div>
    <div class="modal-body"><table class="table">
        <thead><tr><th>{{ aj.gettext('Status') }}</th><th style="min-width:100px">{{ aj.gettext('Name / Size') }}</th><th>{{ aj.gettext('Comment') }}</th><th colspan="3" style="min-width:150px">{{ aj.gettext('Actions') }}</th></tr></thead>
        <tbody>
            <tr><td><i>{{ aj.gettext('Base image') }}</i><br><i class="fas fa-check" style="color:green"></i></td>
                <td><b>{{ current.name }}</b><br><b>{{ current.date }}</b><br><i>{{ imageBytes(current.size, aj.gettext) }}</i></td>
                <td><div v-for="(line, index) in lines(current.desc)" :key="index">{{ line }}<br></div></td><td></td><td></td><td></td></tr>
            <tr v-for="(backup, index) in backups" :key="index" :data-backup="backup.date">
                <td><i>{{ aj.gettext('Backup') }}</i><br><i class="fas fa-history" style="color:orange"></i></td>
                <td><b>{{ backup.date }}</b><br><i>{{ imageBytes(backup.size, aj.gettext) }}</i></td>
                <td><div v-for="(line, lineIndex) in lines(backup.desc)" :key="lineIndex">{{ line }}<br></div></td>
                <td width="1"><button data-action="edit-backup" class="btn btn-default" @click="editImage(backup)"><i class="fa fa-cog"></i></button></td>
                <td width="1"><button data-action="restore-backup" class="btn btn-default" @click="restoreBackup(current, backup.date)"><i class="fa fa-undo"></i></button></td>
                <td width="1"><button data-action="delete-backup" class="btn btn-default" @click="deleteBackupImage(current, backup.date)"><i class="fa fa-trash-o"></i></button></td>
            </tr>
        </tbody>
    </table></div>
    <div class="modal-footer"><a data-action="close" class="btn btn-default btn-flat" @click="emit('close')">{{ aj.gettext('Close') }}</a></div>
</template>
