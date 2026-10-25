<script setup>
import { inject } from 'vue';
import Checkbox from './Checkbox.vue';
import Translated from './Translated.mjs';
import PathSelector from './PathSelector.vue';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div>
<br> <div class="flex-container lmn-container-list">
<div style="width: 700px;">
<div>
<div class="c12-field" v-show="!customization?.plugins?.settings?.hideLanguageSettings">
<Translated tag="label" text="Language">
</Translated> <div>
<select v-model="s.config.data.language" class="form-control">
<option v-for="(x, optionIndex) in s.languages" :key="optionIndex" :value="x">{{ x }}</option>
</select>
</div>
</div> <div class="c12-field">
<Translated tag="label" text="Max session time">
</Translated> <div class="row">
<div class="col-md-8">
<input v-model.number="s.config.data.session_max_time" @input="if ($event.target.validity.badInput) s.config.data.session_max_time = undefined; else if ($event.target.value === '') s.config.data.session_max_time = null; else if ($event.target.validity.rangeUnderflow || $event.target.validity.rangeOverflow) s.config.data.session_max_time = undefined;" class="form-control" type="number">
</div>
</div>
</div> <div v-show="s.config.data.bind.mode === 'tcp' &amp;&amp; s.config.data.ssl.enable &amp;&amp; !customization?.plugins?.settings?.hideSSLSettings">
<div class="c12-field">
<div class="row">
<div class="col-md-8">
<i class="fas fa-question-circle float-end" :title="s.help_certificate">
</i> <Translated tag="label" text="SSL certificate file">
</Translated> <PathSelector v-model="s.config.data.ssl.certificate" type="text">
</PathSelector>
</div>
</div>
</div> <div class="c12-field">
<div class="row">
<div class="col-md-8">
<i class="fas fa-question-circle float-end" :title="s.help_fqdn_certificate">
</i> <Translated tag="label" text="SSL FQDN certificate file">
</Translated> <PathSelector v-model="s.config.data.ssl.fqdn_certificate" type="text">
</PathSelector>
</div>
</div>
</div>
</div> <div class="c12-field">
<div>
<Checkbox v-model="s.config.data.ssl.force" :text="aj.gettext('Force SSL')">
</Checkbox>
</div>
</div> <hr v-show="!customization?.plugins?.settings?.hideProxiesSettings"> <div class="c12-field" v-show="!customization?.plugins?.settings?.hideProxiesSettings">
<div class="row">
<div class="col-md-6">
<div style="margin-bottom:20px;">
<Translated tag="label" text="Trusted domains">
</Translated> <i class="fas fa-question-circle float-end" :title="s.help_trusted_domains">
</i> <template v-for="(domain, index) in s.config.data.trusted_domains" :key="index">
<div class="input-group">
<input v-model.trim="s.config.data.trusted_domains[index]" class="form-control" type="text"> <div class="c12-input-button">
<a @click="s.delete_trusted_domain(s.config.data.trusted_domains[index])" class="btn c12-button">
<i class="fa fa-trash">
</i>
</a>
</div>
</div>
</template>
</div> <a @click="s.add_trusted_domain()" class="btn c12-button">
<i class="fa fa-plus">
</i> <Translated tag="span" text="New domain">
</Translated>
</a>
</div> <div class="col-md-6">
<div style="margin-bottom:20px;">
<Translated tag="label" text="Trusted proxies">
</Translated> <i class="fas fa-question-circle float-end" :title="s.help_trusted_proxies">
</i> <template v-for="(domain, index) in s.config.data.trusted_proxies" :key="index">
<div class="input-group">
<input v-model.trim="s.config.data.trusted_proxies[index]" class="form-control" type="text"> <div class="c12-input-button">
<a @click="s.delete_trusted_proxy(s.config.data.trusted_proxies[index])" class="btn c12-button">
<i class="fa fa-trash">
</i>
</a>
</div>
</div>
</template>
</div> <a @click="s.add_trusted_proxy()" class="btn c12-button">
<i class="fa fa-plus">
</i> <Translated tag="span" text="New proxy">
</Translated>
</a>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
</template>
