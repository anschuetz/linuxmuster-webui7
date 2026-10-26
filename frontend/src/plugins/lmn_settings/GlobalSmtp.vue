<script setup>
import { inject } from 'vue';
import Checkbox from './Checkbox.vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.smtp_config">
<br> <div class="c12-field">
<label>Email relay</label> <div>
<Checkbox v-model="s.config.data.email.enable" :text="aj.gettext('Enable email relay for notification')">
</Checkbox>
</div>
</div> <hr> <div class="c12-field" v-show="s.config.data.email.enable">
<div class="alert alert-info" v-show="!s.smtp_config.smtp.server">
<i class="fa fa-info-circle">
</i> <Translated tag="span" text="The smtp.yml config file seems to be empty. Currently it's ont possible to send emails with this configuration.">
</Translated>
</div> <div class="c12-columns aj-theme-columns">
<div class="aj-theme-wide-half">
<Translated tag="label" text="SMTP host">
</Translated> <div>
<input v-model.trim="s.smtp_config.smtp.server" type="text" class="form-control">
</div> <br> <Translated tag="label" text="Port">
</Translated> <div class="btn-group c12-justified">
<a @click="s.smtp_config.smtp.port = 'starttls'" :class="{ active: s.smtp_config.smtp.port === 'starttls' }" class="btn c12-button">
                                TLS ( port 587 )
                            </a> <a @click="s.smtp_config.smtp.port = 'ssl'" :class="{ active: s.smtp_config.smtp.port === 'ssl' }" class="btn c12-button">
                                SSL ( port 465 )
                            </a>
</div>
</div> <div class="aj-theme-wide-half">
<Translated tag="label" text="SMTP user">
</Translated> <div>
<input v-model.trim="s.smtp_config.smtp.user" type="text" class="form-control">
</div> <br> <Translated tag="label" text="SMTP password">
</Translated> <div v-show="!s.showSMTPPassword" class="c12-field c12-feedback">
<input v-model="s.smtp_config.smtp.password" type="password" class="form-control"> <span v-show="!s.showSMTPPassword" @click="s.toggleShowSMTPPassword()" class="fas fa-eye c12-feedback-icon" style="cursor: pointer; pointer-events: all; line-height:34px;">
</span>
</div> <div v-show="s.showSMTPPassword" class="c12-field c12-feedback">
<input v-model.trim="s.smtp_config.smtp.password" type="text" class="form-control"> <span v-show="s.showSMTPPassword" @click="s.toggleShowSMTPPassword()" class="fas fa-eye-slash c12-feedback-icon" style="cursor: pointer; pointer-events: all; line-height:34px;">
</span>
</div>
</div>
</div> <hr> <div class="c12-columns aj-theme-columns">
<div class="aj-theme-wide-half">
<Translated tag="label" text="Template email reset">
</Translated> <div>
<input v-model.trim="s.config.data.email.templates.reset_email" type="text" class="form-control">
</div>
</div>
</div>
</div>
</div>
</template>
