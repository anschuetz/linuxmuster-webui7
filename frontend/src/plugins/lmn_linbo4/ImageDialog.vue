<script setup>
import { computed, inject, onBeforeUnmount, ref, shallowRef } from 'vue';
import { fileUrl } from '../../common/fileEditor.mjs';
import { modelFields } from './config.mjs';
import { copyImage, imageBytes, textRows } from './images.mjs';
import ScriptEditor from './ScriptEditor.vue';
const props = defineProps({ image: { type: Object, required: true }, images: { type: Array, required: true }, renameImage: Function });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj');
const draft = shallowRef(copyImage(props.image));
const image = modelFields(() => draft.value, value => { draft.value = value; });
const rows = { desc: textRows(props.image.desc), info: textRows(props.image.info) };
const tab = ref('general'), menu = ref(null), examples = ref({});
const outside = event => { if (!event.target.closest('[data-image-copy]')) menu.value = null; };
const keydown = event => { if (event.key === 'Escape') menu.value = null; };
window.addEventListener('click', outside);
window.addEventListener('keydown', keydown);
onBeforeUnmount(() => { window.removeEventListener('click', outside); window.removeEventListener('keydown', keydown); });
const scripts = computed(() => [['reg', 'Registry patch'], ...(!draft.value.diff ? [['postsync', 'Postsync Script']] : []), ['prestart', 'Prestart Script']]);
const sources = Object.fromEntries(['reg', 'postsync', 'prestart'].map(key => [key, props.images.filter(item => item[key])]));
for (const key of ['reg', 'postsync', 'prestart']) {
    aj.http.get('/api/lmn/linbo4/examples/' + key).then(({ data }) => { examples.value = { ...examples.value, [key]: data }; })
        .catch(() => { /* Shell owns failed list requests; leave examples unset. */ });
}
function copyScript(key, text) { image[key] = text; menu.value = null; }
async function example(key, name) {
    menu.value = null;
    try { const { data } = await aj.http.get(fileUrl('read', '/srv/linbo/examples/' + name)); image[key] = data; }
    catch { /* Preserve current script on shell-owned read failure. */ }
}
</script>

<template>
    <div class="modal-header">
        <button v-if="!image.backup && !image.diff" data-action="rename" class="btn btn-default pull-right" @click="renameImage(draft)"><i class="fa fa-pencil"></i></button>
        <h4>{{ image.name }} <span v-if="image.diff">{{ aj.gettext('- Differential image') }}</span><span v-if="image.backup">{{ image.name }} - Backup {{ image.date }}</span></h4>
    </div>
    <div class="modal-body">
        <ul class="nav nav-tabs">
            <li :class="{active:tab === 'general'}"><a href="" @click.prevent="tab = 'general'; menu = null">{{ aj.gettext('General') }}</a></li>
            <li v-for="[key, label] in scripts" :key="key" :class="{active:tab === key}"><a href="" :data-tab="key" @click.prevent="tab = key; menu = null">{{ aj.gettext(label) }}</a></li>
        </ul>
        <div v-show="tab === 'general'"><br>
            <div v-for="[key, label] in [['desc','Description'],['info','Info']]" :key="key" class="form-group">
                <label>{{ aj.gettext(label) }}</label><textarea v-model.trim="image[key]" :data-model="'image.' + key" :rows="rows[key]" class="form-control"></textarea>
            </div>
            <div class="form-group"><label>{{ aj.gettext('Size') }}</label><div>{{ imageBytes(image.size, aj.gettext) }}</div></div>
        </div>
        <div v-for="[key] in scripts" v-show="tab === key" :key="key" :data-panel="key"><br>
            <ScriptEditor v-model="image[key]" :field="key" :active="tab === key" />
            <div data-image-copy class="dropdown" :class="{open:menu === key}">
                <button class="btn btn-default" :aria-expanded="menu === key" @click="menu = menu === key ? null : key"><i class="fa fa-copy"></i> Copy from <i class="fa fa-caret-down"></i></button>
                <ul v-show="menu === key" class="dropdown-menu">
                    <li v-for="(source, index) in sources[key]" :key="'source'+index"><a :data-source="key + ':' + source.name" @click="copyScript(key, source[key])">{{ source.name }}</a></li>
                    <li v-for="(name, index) in examples[key]" :key="'example'+index"><a :data-example="key + ':' + name" @click="example(key, name)">{{ name }} <small><i>Example</i></small></a></li>
                </ul>
            </div>
        </div>
    </div>
    <div class="modal-footer">
        <a data-action="save" class="btn btn-default btn-flat" @click="emit('close', draft)">{{ aj.gettext('Save') }}</a>
        <a data-action="cancel" class="btn btn-default btn-flat" @click="emit('cancel')">{{ aj.gettext('Close') }}</a>
    </div>
</template>
