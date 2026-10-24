<script setup>
import { computed, inject } from 'vue';
import { createSchoolSettings } from './school.mjs';
import Translated from './Translated.mjs';
import SchoolGeneral from './SchoolGeneral.vue';
import SchoolListImport from './SchoolListImport.vue';
import SchoolQuota from './SchoolQuota.vue';
import SchoolPrinting from './SchoolPrinting.vue';
import SchoolCustom from './SchoolCustom.vue';
import SchoolHolidays from './SchoolHolidays.vue';
import SchoolPassword from './SchoolPassword.vue';
defineProps({ customization: { default: () => ({}) } });
const aj = inject('aj');
const s = createSchoolSettings(aj);
aj.pageTitle.set(aj.gettext('Settings'));
const headings = computed(() => [aj.gettext('General'), aj.gettext('Listimport'), aj.gettext('Quota'), aj.gettext('Printing data'), aj.gettext('Custom fields'), aj.gettext('Holidays'), aj.gettext('Password constraints')]);
function selectTab(index) {
    s.activetab = index;
    switch (index) {
        case 3: s.load_custom_config(); break;
        case 4: s.load_custom_config(); break;
    }
}
</script>
<template>
<br>
<component :is="'progress-spinner'" v-if="!s.settings">
<div>
<div class="one">
</div>
<div class="two">
</div>
</div>
</component>
<div v-if="s.settings">
<ul class="nav nav-tabs">
<li v-for="(heading, index) in headings" :key="index" :class="{ active: s.activetab === index }">
<a href="#" @click.prevent="selectTab(index)">{{ heading }}</a>
</li>
</ul>
<div class="tab-content">
<div v-show="s.activetab === 0" class="tab-pane" :class="{ active: s.activetab === 0 }">
<SchoolGeneral :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 1" class="tab-pane" :class="{ active: s.activetab === 1 }">
<SchoolListImport :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 2" class="tab-pane" :class="{ active: s.activetab === 2 }">
<SchoolQuota :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 3" class="tab-pane" :class="{ active: s.activetab === 3 }">
<SchoolPrinting :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 4" class="tab-pane" :class="{ active: s.activetab === 4 }">
<SchoolCustom :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 5" class="tab-pane" :class="{ active: s.activetab === 5 }">
<SchoolHolidays :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 6" class="tab-pane" :class="{ active: s.activetab === 6 }">
<SchoolPassword :s="s" :customization="customization" />
</div>
</div>
<div class="floating-toolbar-padder">
</div>
<component :is="'floating-toolbar'">
<button v-show="s.activetab !== 4 &amp;&amp; s.activetab !== 6" @click="s.backups()" class="btn btn-lmn pull-right">
<i class="fa fa-history">
</i>
</button> <Translated tag="button" text="Save &amp;amp; check" v-show="s.activetab === 0" @click="s.saveAndCheck()" class="btn btn-lmn">
</Translated> <Translated tag="button" text="Save &amp;amp; Apply Quota" v-show="s.activetab === 2" @click="s.saveApplyQuota()" class="btn btn-lmn">
</Translated> <Translated tag="button" text="Save" v-show="s.activetab < 3" @click="s.save()" class="btn btn-lmn">
</Translated> <Translated tag="button" text="Save" v-show="s.activetab === 3" @click="s.save() &amp;&amp; s.saveCustom()" class="btn btn-lmn">
</Translated> <Translated tag="button" text="Save" v-show="s.activetab === 4" @click="s.saveCustom()" class="btn btn-lmn">
</Translated> <Translated tag="button" text="Save" v-show="s.activetab === 5" @click="s.saveApplyHolidays()" class="btn btn-lmn">
</Translated> <Translated tag="button" text="Save" v-show="s.activetab === 6" @click="s.savePasswordConstraints()" class="btn btn-lmn">
</Translated>
</component>

</div>
</template>
