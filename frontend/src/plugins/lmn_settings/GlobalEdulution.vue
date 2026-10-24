<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.edulutionStatus">
<br>  <div class="card" style="width: 100%;">
<ul class="list-group list-group-flush">
<li class="list-group-item" style="display: flex; align-items: center; height: 80px;">
<span style="width: 50px;">
<component v-show="s.edulutionStatus.api_installed === null" :is="'progress-spinner'">
<div>
<div class="one">
</div>
<div class="two">
</div>
</div>
</component> <i class="fas fa-check-circle" style="font-size: 20px; color: green;" v-show="s.edulutionStatus.api_installed">
</i> <i class="fas fa-times-circle" style="font-size: 20px; color: red;" v-show="s.edulutionStatus.api_installed === false">
</i>
</span> <Translated tag="span" text="Check if API is installed" style="margin-left: 10px;">
</Translated>
</li>
</ul>
</div> <div class="card" style="width: 100%;">
<ul class="list-group list-group-flush">
<li class="list-group-item" style="display: flex; align-items: center; height: 80px;">
<span style="width: 50px;">
<component v-show="s.edulutionStatus.api_running === null" :is="'progress-spinner'">
<div>
<div class="one">
</div>
<div class="two">
</div>
</div>
</component> <i class="fas fa-check-circle" style="font-size: 20px; color: green;" v-show="s.edulutionStatus.api_running">
</i> <i class="fas fa-times-circle" style="font-size: 20px; color: red;" v-show="s.edulutionStatus.api_running === false">
</i>
</span> <Translated tag="span" text="Check if API is running" style="margin-left: 10px;">
</Translated>
</li>
</ul>
</div> <div class="card" style="width: 100%;">
<ul class="list-group list-group-flush">
<li class="list-group-item" style="display: flex; align-items: center; height: 80px;">
<span style="width: 50px;">
<component v-show="s.edulutionStatus.binduser_created === null" :is="'progress-spinner'">
<div>
<div class="one">
</div>
<div class="two">
</div>
</div>
</component> <i class="fas fa-check-circle" style="font-size: 20px; color: green;" v-show="s.edulutionStatus.binduser_created">
</i> <i class="fas fa-times-circle" style="font-size: 20px; color: red;" v-show="s.edulutionStatus.binduser_created === false">
</i>
</span> <Translated tag="span" text="Check if a Bind-User exists for edulution" style="margin-left: 10px;">
</Translated> <button class="btn btn-lmn" style="margin-left: auto; " @click="s.createEdulutionBinduser()" v-show="s.edulutionStatus.binduser_created === false">Create binduser</button>
</li>
</ul>
</div> <div class="card" style="width: 100%;">
<ul class="list-group list-group-flush">
<li class="list-group-item" style="display: flex; align-items: center; height: 80px;">
<span style="width: 50px;">
<i class="fas fa-check-circle" style="font-size: 20px; color: green;">
</i>
</span> <span style="margin-left: 10px;">
<Translated tag="span" text="External Domain">
</Translated>: <input v-model.trim="s.edulutionStatus.external_domain" style="margin-left: 15px;" type="text"> (The domain under which the Linuxmuster-Server is accessible from outside.)
                        </span>
</li>
</ul>
</div> <button class="btn btn-lmn" @click="s.generateEdulutionSetupToken()" v-show="s.edulutionStatus.api_installed &amp;&amp; s.edulutionStatus.api_running &amp;&amp; s.edulutionStatus.binduser_created">Generate edulution Setup Token</button> <pre v-show="s.edulutionToken" style="margin-top: 20px; white-space:pre-wrap;">{{ s.edulutionToken }}</pre> <button class="btn btn-lmn" style="margin-top: 10px;" @click="s.copyEdulutionSetupToken()" v-show="s.edulutionToken">Copy</button> <div class="alert alert-info" v-show="s.edulutionToken" style="margin-top: 20px;">
<i class="fa fa-info-circle">
</i> <Translated tag="span" :text="[&quot;The server must be accessible from the edulution server via port &lt;b&gt;443 (https)&lt;/b&gt;, port &lt;b&gt;8001 (API)&lt;/b&gt; and port &lt;b&gt;389 (LDAP)&lt;/b&gt; or &lt;b&gt;636 (LDAPs)&lt;/b&gt;. &quot;, &quot;                    Ask your IT-Administrator if you need support here!&quot;].join(&#x27;\n&#x27;)">
</Translated>
</div>
</div>
</template>
