<script setup>
import { computed, inject, ref, watch } from 'vue';

const aj = inject('aj');
const entries = ref();
const zone = ref();
const editing = ref(null);
const types = ['AAAA', 'A', 'PTR', 'CNAME', 'NS', 'MX', 'TXT'];
const record = computed(() => editing.value?.record);
// Angular captures these once when the controller starts.
const titles = { modify: aj.gettext('Modify this entry'), delete: aj.gettext('Delete this entry') };
const fields = [['host', 'Subdomain : '], ['type', 'Type : '], ['value', 'Value : '], ['priority', 'Priority : ']];

const models = Object.fromEntries(fields.map(([name]) => [name, computed({
    get: () => record.value[name],
    set: (value) => change(name, value),
})]));

aj.pageTitle.set(aj.gettext('Samba_dns'));
watch(() => aj.identity.user, async (user) => {
    if (user == null) return;
    entries.value = undefined;
    zone.value = undefined;
    try {
        const { data } = await aj.http.get('/api/lmn/dns');
        [entries.value, zone.value] = data;
    } catch {
        // The adapter handles HTTP errors; Angular leaves the tables unset.
    }
}, { immediate: true });
function add() {
    editing.value = { mode: 'new', record: { host: '', type: 'A', value: '', ttl: 900 } };
}
function modify(index) {
    const sub = entries.value.sub[index];
    editing.value = { mode: 'update', index, old: { ...sub }, record: sub };
}
function change(name, value) {
    const current = editing.value;
    const updated = { ...current.record, [name]: value };
    editing.value = { ...current, record: updated };
    // Keep Angular's live editing, including edits followed by Close.
    if (current.mode === 'update') entries.value = {
        ...entries.value,
        sub: entries.value.sub.map((sub, index) => index === current.index ? updated : sub),
    };
}
async function save() {
    const current = editing.value;
    editing.value = null;
    try {
        if (current.mode === 'new') {
            await aj.http.put('/api/lmn/dns', { sub: current.record });
            aj.notify.success(aj.gettext('Entry saved !'));
            entries.value = { ...entries.value, sub: [...entries.value.sub, current.record] };
        } else {
            await aj.http.post('/api/lmn/dns', { old: current.old, new: current.record });
            aj.notify.success(aj.gettext('Entry updated !'));
        }
    } catch {
        // Preserve local edits on failure, as in the original controller.
    }
}
async function remove(sub) {
    try {
        await aj.messagebox.show({ text: 'Do you really want to delete this entry?', positive: 'Delete', negative: 'Cancel' });
    } catch {
        return;
    }
    try {
        const value = sub.type === 'MX' ? `${sub.value}\\ ${sub.priority}` : sub.value;
        await aj.http.patch('/api/lmn/dns', { sub: sub.host, type: sub.type, value });
        aj.notify.success(aj.gettext('Entry deleted !'));
        entries.value = { ...entries.value, sub: entries.value.sub.filter((entry) => entry !== sub) };
    } catch {
        // Failed deletes keep the row; the adapter presents the HTTP error.
    }
}
</script>

<template>
    <div>
        <h3><span>{{ aj.gettext('Zone informations') }}</span> ({{ zone }})</h3>
        <table class="table">
            <thead><tr><th>{{ aj.gettext('Type') }}</th><th>{{ aj.gettext('TTL') }}</th><th>{{ aj.gettext('Value') }}</th></tr></thead>
            <tbody><tr v-for="(sub, index) in entries?.root" :key="index"><td>{{ sub.type }}</td><td>{{ sub.ttl }}</td><td>{{ sub.value }}</td></tr></tbody>
        </table>
        <button class="btn btn-success float-end" @click="add"><i class="fa fa-plus"></i> <span>{{ aj.gettext('Add an entry') }}</span></button>
        <h3>{{ aj.gettext('Subdomains') }}</h3>
        <table class="table">
            <thead><tr><th>{{ aj.gettext('Host') }}</th><th>{{ aj.gettext('Type') }}</th><th>{{ aj.gettext('TTL') }}</th><th>{{ aj.gettext('Value') }}</th><th></th><th></th></tr></thead>
            <tbody><tr v-for="(sub, index) in entries?.sub" :key="index">
                <td>{{ sub.host }} <span v-if="sub.type === 'MX'">({{ sub.priority }})</span></td><td>{{ sub.type }}</td><td>{{ sub.ttl }}</td><td>{{ sub.value }}</td>
                <td width="1"><button class="btn dns-button" :title="titles.modify" @click="modify(index)"><i class="fa fa-edit"></i></button></td>
                <td width="1"><button class="btn dns-button" :title="titles.delete" @click="remove(sub)"><i class="fa fa-trash-o"></i></button></td>
            </tr></tbody>
        </table>
        <div v-if="editing" class="modal show" role="dialog" aria-modal="true" style="display:block;background:rgba(0,0,0,.5)">
            <div class="modal-dialog"><div class="modal-content">
                <div class="modal-header"><h4 v-if="editing.mode === 'new'">{{ aj.gettext('New DNS entry') }}</h4></div>
                <div class="modal-body"><form @submit.prevent>
                    <template v-for="[name, label] in fields" :key="name">
                        <span v-show="name !== 'priority' || record.type === 'MX'">{{ aj.gettext(label) }}</span>
                        <select v-if="name === 'type' && editing.mode === 'new'" class="form-control" :name="name" :value="record[name]" @change="change(name, $event.target.value)"><option v-for="type in types" :key="type">{{ type }}</option></select>
                        <input v-else v-show="name !== 'priority' || record.type === 'MX'" type="text" class="form-control" :name="name" v-model.trim="models[name].value" :disabled="editing.mode === 'update' && (name === 'host' || name === 'type')">
                    </template>
                </form></div>
                <div class="modal-footer">
                    <a class="btn dns-button btn-flat" @click="save">{{ aj.gettext(editing.mode === 'new' ? 'Save' : 'Update') }}</a>
                    <a class="btn dns-button btn-flat" @click="editing = null">{{ aj.gettext('Close') }}</a>
                </div>
            </div></div>
        </div>
    </div>
</template>
