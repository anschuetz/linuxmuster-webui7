<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.passwordConstraintsForm">
<br> <div v-if="s.passwordConstraints">
<div class="row aj-theme-grid">
<div class="c13-field aj-theme-columns">
<div class="aj-theme-wide-third">
<Translated tag="label" text="Choose a role to configure">
</Translated> <select v-model="s.passwordConstraintsRole" class="form-control">
<template v-for="(role, index) in s.passwordConstraintsRoles" :key="index">
<option :value="role">{{ role }}</option>
</template>
</select>
</div>
</div>
</div> <br> <hr> <br> <Translated tag="h3" text="Default rules (all schools)">
</Translated> <Translated tag="p" text="Only global administrators can change the default rules applied to every school." class="shell-help" v-if="!s.isGlobalAdmin">
</Translated> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="Minimum length">
</Translated> <td>
<input v-model.number="s.passwordConstraintsForm.default[s.passwordConstraintsRole].minLength" @input="if ($event.target.validity.badInput) s.passwordConstraintsForm.default[s.passwordConstraintsRole].minLength = undefined; else if ($event.target.value === '') s.passwordConstraintsForm.default[s.passwordConstraintsRole].minLength = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.passwordConstraintsForm.default[s.passwordConstraintsRole].minLength = undefined;" type="number" min="0" :disabled="!s.isGlobalAdmin" class="form-control" :placeholder="aj.gettext('Samba minimum applies if empty')">
</td>
</tr> <tr>
<Translated tag="th" text="Required character classes">
</Translated> <td>
<template v-for="(cls, index) in s.passwordRuleClasses" :key="index">
<label class="form-check form-check-inline aj-native-check-inline">
<input v-model="s.passwordConstraintsForm.default[s.passwordConstraintsRole].classes[cls]" type="checkbox" :disabled="!s.isGlobalAdmin" @change="s.clampRequiredCount(s.passwordConstraintsForm.default[s.passwordConstraintsRole])"> {{ s.passwordRuleClassLabels[cls] }}</label>
</template>
</td>
</tr> <tr>
<Translated tag="th" text="Required count">
</Translated> <td>
<input v-model.number="s.passwordConstraintsForm.default[s.passwordConstraintsRole].count" @input="if ($event.target.validity.badInput) s.passwordConstraintsForm.default[s.passwordConstraintsRole].count = undefined; else if ($event.target.value === '') s.passwordConstraintsForm.default[s.passwordConstraintsRole].count = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.passwordConstraintsForm.default[s.passwordConstraintsRole].count = undefined; s.clampRequiredCount(s.passwordConstraintsForm.default[s.passwordConstraintsRole])" type="number" min="1" :max="s.checkedClassCount(s.passwordConstraintsForm.default[s.passwordConstraintsRole])" :disabled="!s.isGlobalAdmin" class="form-control" :placeholder="aj.gettext('all checked')" style="width: 8em;">
</td>
</tr>

</tbody>
</table> <br> <hr> <br> <label class="form-check form-check-inline aj-native-check-inline">
<input type="checkbox" :checked="s.hasSchoolOverride(s.passwordConstraintsRole)" @click="s.toggleSchoolOverride(s.passwordConstraintsRole)"> <Translated tag="span" text="Override for this school">
</Translated> ({{ s.currentSchool }})
        </label> <Translated tag="p" text="This replaces the default rules above for this role in this school — it does not add to them." class="shell-help" v-show="s.hasSchoolOverride(s.passwordConstraintsRole)">
</Translated> <div v-if="s.hasSchoolOverride(s.passwordConstraintsRole)">
<br> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="Minimum length">
</Translated> <td>
<input v-model.number="s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].minLength" @input="if ($event.target.validity.badInput) s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].minLength = undefined; else if ($event.target.value === '') s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].minLength = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].minLength = undefined;" type="number" min="0" class="form-control" :placeholder="aj.gettext('Samba minimum applies if empty')">
</td>
</tr> <tr>
<Translated tag="th" text="Required character classes">
</Translated> <td>
<template v-for="(cls, index) in s.passwordRuleClasses" :key="index">
<label class="form-check form-check-inline aj-native-check-inline">
<input v-model="s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].classes[cls]" type="checkbox" @change="s.clampRequiredCount(s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole])"> {{ s.passwordRuleClassLabels[cls] }}</label>
</template>
</td>
</tr> <tr>
<Translated tag="th" text="Required count">
</Translated> <td>
<input v-model.number="s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].count" @input="if ($event.target.validity.badInput) s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].count = undefined; else if ($event.target.value === '') s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].count = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole].count = undefined; s.clampRequiredCount(s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole])" type="number" min="1" :max="s.checkedClassCount(s.passwordConstraintsForm.schools[s.currentSchool][s.passwordConstraintsRole])" class="form-control" :placeholder="aj.gettext('all checked')" style="width: 8em;">
</td>
</tr>

</tbody>
</table>
</div>
</div>
</div>
</template>
