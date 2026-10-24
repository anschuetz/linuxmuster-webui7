<script setup>
import { computed, inject, ref } from 'vue';
import { isListAttr, ordered } from './model.mjs';
const props = defineProps(['fields', 'user']);
const emit = defineEmits(['cancel', 'updateFields']);
const aj = inject('aj');
const fields = ref(props.fields?.map((field) => ({ ...field, value: Array.isArray(field.value) ? [...field.value] : field.value })));
const sorted = computed(() => ordered(fields.value, ['title']));
const values = (field) => fields.value.find((f) => f.attr === field.attr).value;
const error = () => aj.notify.error(aj.gettext('Error, please verify the user and/or your values.'));
function replace(field, value) {
    fields.value = fields.value.map((f) => f.attr === field.attr ? { ...f, value } : f);
    emit('updateFields', fields.value);
}
async function edit(field) {
    const list = isListAttr(field.attr), proxy = field.attr === 'proxyAddresses';
    let msg;
    try {
        msg = await (list ? aj.messagebox.prompt(aj.gettext(proxy ? 'New address' : 'New value')) : aj.messagebox.prompt(aj.gettext('New value'), field.value));
    } catch { return; /* Prompt dismissed: original sends nothing. */ }
    const path = proxy ? 'proxyaddresses' : `${list ? 'custommulti' : 'custom'}/${field.attr.slice(-1)}`;
    try {
        await aj.http.post(`/api/lmn/users/${props.user.sAMAccountName}/${path}`, { [proxy ? 'address' : 'value']: msg.value });
        aj.notify.success(aj.gettext(list ? proxy ? 'Address added !' : 'Value added !' : 'Value updated !'));
        if (!list) replace(field, msg.value || 'null');
        else if (msg.value) replace(field, [...values(field), msg.value]);
    } catch {
        error();
        // The original single-value service resolves undefined on HTTP failure.
        if (!list) replace(field, undefined);
    }
}
async function remove(field, value) {
    const proxy = field.attr === 'proxyAddresses';
    try {
        await aj.messagebox.show({ title: aj.gettext(proxy ? 'Remove proxy address' : 'Remove custom field value'), text: aj.gettext('Do you really want to remove ') + value + ' ?', positive: aj.gettext('OK'), negative: aj.gettext('Cancel') });
    } catch { return; /* Core messagebox.then ignores the original service's second callback. */ }
    try {
        await aj.http.patch(`/api/lmn/users/${props.user.sAMAccountName}/${proxy ? 'proxyaddresses' : `custommulti/${field.attr.slice(-1)}`}`, { [proxy ? 'address' : 'value']: value });
        aj.notify.success(aj.gettext('Value removed !'));
    } catch {
        // Only proxy removal handles PATCH failure and still resolves in the original.
        if (!proxy) return;
        error();
    }
    const current = values(field);
    const position = current.indexOf(value);
    replace(field, current.filter((_, i) => i !== (position < 0 ? current.length - 1 : position)));
}
</script>
<template>
    <div class="modal-header"><h3>{{ aj.gettext('User Details') }} - {{ user.givenName }} {{ user.sn }}</h3></div>
    <div style="padding:0 20px"><br><h4>{{ aj.gettext('Properties') }}</h4>
        <div style="display:flex;align-items:flex-start"><table class="table"><tbody>
            <tr v-for="(custom, index) in sorted" :key="index"><td>{{ custom.title }}</td>
                <td v-if="isListAttr(custom.attr)" style="display:inline-block"><span v-for="(value, i) in custom.value" :key="i" class="label label-info" style="display:inline-block" @click="custom.editable && remove(custom, value)">{{ value }}<i v-if="custom.editable" class="far fa-times-circle"></i></span></td>
                <td v-else>{{ custom.value }}</td>
                <td><a v-if="custom.editable" @click="edit(custom)"><i :class="isListAttr(custom.attr) ? 'fa fa-plus' : 'fa fa-pencil'"></i></a></td>
            </tr>
        </tbody></table></div>
        <div class="modal-footer"><a class="btn btn-default btn-flat" @click="$emit('cancel')">{{ aj.gettext('Close') }}</a></div>
    </div>
</template>
