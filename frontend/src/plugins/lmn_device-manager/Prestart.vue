<script setup>
import { inject, unref } from 'vue';
const props = defineProps({ commands: [Array, Object], refresh: Function });
const emit = defineEmits(['close']), aj = inject('aj');
async function change(command, edit) {
    try {
        const payload = edit ? { preStartCommand: command, newCommand: (await aj.messagebox.prompt(aj.gettext('Edit Linbo-Pre-Start Command'), command.content)).value } : { preStartCommand: command };
        const { data } = await aj.http.post('/api/lmn/device-manager/' + (edit ? 'editPrestartCommands' : 'removePrestartCommands'), payload);
        if (data.status) aj.notify.success(aj.gettext(edit ? 'Command edited successfully!' : 'Command deleted successfully!'));
        else aj.notify.error(aj.gettext(edit ? 'Failed to edit: ' : 'Failed to delete: ') + data.message);
        props.refresh();
    } catch { /* Prompt cancellation or HTTP errors keep the list, as in Angular. */ }
}
</script>
<template>
    <div class="modal-header"><h3>{{ unref(commands)?.length }} {{ aj.gettext('Linbo-Pre-Start Command(s)') }}</h3></div>
    <div class="modal-body">
        <div v-if="!unref(commands)?.length" class="alert alert-info" style="width:100%">{{ aj.gettext("Currently no Linbo-Pre-Start Command's defined!") }}</div>
        <table v-if="unref(commands)?.length > 0" class="table"><thead><tr><th>{{ aj.gettext('Name') }}</th><th>{{ aj.gettext('Command') }}</th><th></th></tr></thead><tbody>
            <tr v-for="(command,index) in unref(commands)" :key="index"><td style="vertical-align:middle">{{ command.name }}</td><td style="vertical-align:middle">{{ command.content }}</td><td style="line-height:40px;text-align:right"><button data-edit class="btn btn-default" @click="change(command,true)"><i class="fas fa-pencil"></i> Edit</button> <button data-delete class="btn btn-danger" @click="change(command,false)"><i class="fas fa-times"></i> Delete</button></td></tr>
        </tbody></table>
    </div>
    <div class="modal-footer"><button class="btn btn-default" @click="refresh">{{ aj.gettext('Refresh') }}</button><button class="btn btn-default" @click="emit('close')">{{ aj.gettext('Close') }}</button></div>
</template>
