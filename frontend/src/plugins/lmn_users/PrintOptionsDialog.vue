<script setup>
import { computed, inject, onBeforeUnmount, ref } from 'vue';
import { createPrint, initialPrintOptions, printTitle } from './print.mjs';
const props = defineProps({ schoolclass: { type: [Array, String], required: true }, user: String, adminClass: { type: [String, Array], required: true } });
const emit = defineEmits(['close', 'cancel']);
const aj = inject('aj'), gettext = aj.gettext, api = createPrint(aj);
const options = ref(initialPrintOptions(props.schoolclass, props.user, props.adminClass));
const templates = ref({ individual: [], multiple: [] });
const title = printTitle(props.schoolclass, aj.identity.profile.activeSchool, gettext);
const templateKey = computed(() => options.value.one_per_page ? 'template_one_per_page' : 'template_multiple');
const choices = computed(() => templates.value[options.value.one_per_page ? 'individual' : 'multiple']);
const selected = computed(() => options.value[templateKey.value]);
let active = true;
onBeforeUnmount(() => { active = false; });
function publish(data) {
    if (!active) return;
    templates.value = { individual: data.individual, multiple: data.multiple };
    options.value = { ...options.value, template_one_per_page: data.template_one_per_page, template_multiple: data.template_multiple };
}
// Failed template/config loads retain first/empty choices; core handles HTTP errors.
api.templates(options.value, publish).then(data => { if (data) publish(data); }).catch(() => {});
async function print() { if (await api.print(options.value, () => options.value) && active) emit('close'); }
</script>
<template>
    <div class="modal-header"><h4>{{ title }}</h4></div>
    <div class="modal-body">
        <div class="form-group"><label>{{ gettext('Format') }}</label><br>
            <div class="btn-group"><button v-for="format in ['pdf', 'csv']" :key="format" class="btn btn-default" :class="{ active: options.format === format }" :data-format="format" @click="options = { ...options, format }"><i :class="format === 'pdf' ? 'fa fa-file' : 'fa fa-ellipsis-v'" /> {{ format.toUpperCase() }}</button></div>
        </div>
        <div v-show="options.format === 'pdf'" class="form-group" data-options>
            <label>{{ gettext('Options') }}</label><br>
            <span checkbox role="checkbox" tabindex="0" :class="{ active: options.one_per_page }" :aria-checked="options.one_per_page" @click="options = { ...options, one_per_page: !options.one_per_page }" @keydown.space.prevent="options = { ...options, one_per_page: !options.one_per_page }"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i> {{ gettext('One per page') }}</span><br>
            <span checkbox role="checkbox" tabindex="0" :class="{ active: options.pdflatex }" :aria-checked="options.pdflatex" @click="options = { ...options, pdflatex: !options.pdflatex }" @keydown.space.prevent="options = { ...options, pdflatex: !options.pdflatex }"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i> {{ gettext('Use pdflatex instead of latex') }}</span><br><br>
            <div v-if="selected">
                <label>{{ gettext('Use following template') }}</label>
                <select class="form-control" :value="choices.indexOf(selected)" @change="options = { ...options, [templateKey]: choices[Number($event.target.value)] }"><option v-for="(item, index) in choices" :key="index" :value="index">{{ item.filename }}</option></select><br>
                <div class="alert alert-info"><table><tbody>
                    <tr><th>{{ gettext(selected.path.startsWith('/usr') ? 'Default sophomorix template' : 'Custom template for your school') }}</th><td> </td></tr>
                    <tr><th>{{ gettext('Lang: ') }}</th><td>{{ selected.lang }}</td></tr>
                    <tr><th>{{ gettext(options.one_per_page ? 'Password per page: ' : 'Passwords per page: ') }}</th><td>{{ options.one_per_page ? 1 : selected.numberPerPage }}</td></tr>
                </tbody></table></div>
            </div>
        </div>
    </div>
    <div class="modal-footer"><button class="btn btn-default btn-flat" data-action="print" @click="print">{{ gettext('Print') }}</button><button class="btn btn-default btn-flat" data-action="cancel" @click="emit('cancel')">{{ gettext('Cancel') }}</button></div>
</template>
