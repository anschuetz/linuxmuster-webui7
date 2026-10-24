<script setup>
import { computed, inject } from 'vue';
import { createGlobalSettings } from './global.mjs';
import Translated from './Translated.mjs';
import UserSearch from './UserSearch.vue';
import GlobalGeneral from './GlobalGeneral.vue';
import GlobalSubnets from './GlobalSubnets.vue';
import GlobalSmtp from './GlobalSmtp.vue';
import GlobalRoles from './GlobalRoles.vue';
import GlobalApi from './GlobalApi.vue';
import GlobalTfa from './GlobalTfa.vue';
import GlobalEdulution from './GlobalEdulution.vue';
import GlobalVersion from './GlobalVersion.vue';
defineProps({ customization: { default: () => ({}) }, layout: { default: () => ({ sidebar: true }) } });
const aj = inject('aj');
const s = createGlobalSettings(aj);
aj.pageTitle.set(aj.gettext('Global Settings'));
const headings = computed(() => [aj.gettext('General'), aj.gettext('Subnets'), aj.gettext('Smtp relay'), "Allowed roles", "Api Keys", '2FA', "Edulution UI", "About Linuxmuster.net"]);
function selectTab(index) {
    s.activetab = index;
    switch (index) {
        case 2: s.getSmtpConfig(); break;
        case 3: s.getAllowedRoles(); break;
        case 4: s.getApiConfig(); break;
        case 5: s.getTfaConfig(); break;
        case 6: s.checkEdulution(); break;
        case 7: s.getLMNVersion(); break;
    }
}
</script>
<template>
<br>
<component :is="'progress-spinner'" v-if="!s.config.data">
<div>
<div class="one">
</div>
<div class="two">
</div>
</div>
</component>
<div v-if="s.config.data">
<ul class="nav nav-tabs">
<li v-for="(heading, index) in headings" :key="index" :class="{ active: s.activetab === index }">
<a href="#" @click.prevent="selectTab(index)">{{ heading }}</a>
</li>
</ul>
<div class="tab-content">
<div v-show="s.activetab === 0" class="tab-pane" :class="{ active: s.activetab === 0 }">
<GlobalGeneral :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 1" class="tab-pane" :class="{ active: s.activetab === 1 }">
<GlobalSubnets :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 2" class="tab-pane" :class="{ active: s.activetab === 2 }">
<GlobalSmtp :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 3" class="tab-pane" :class="{ active: s.activetab === 3 }">
<GlobalRoles :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 4" class="tab-pane" :class="{ active: s.activetab === 4 }">
<GlobalApi :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 5" class="tab-pane" :class="{ active: s.activetab === 5 }">
<GlobalTfa :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 6" class="tab-pane" :class="{ active: s.activetab === 6 }">
<GlobalEdulution :s="s" :customization="customization" />
</div>
<div v-show="s.activetab === 7" class="tab-pane" :class="{ active: s.activetab === 7 }">
<GlobalVersion :s="s" :customization="customization" />
</div>
</div>
<div class="floating-toolbar-padder">
</div>
<component :is="'floating-toolbar'"><div class="container"><div class="row"><div :class="{ 'col-md-3': layout.sidebar }"></div><div :class="layout.sidebar ? 'col-md-9' : 'col-md-12'"><div class="bar row">
<Translated tag="a" text="Save" v-show="s.activetab === 0" @click="s.save()" class="btn btn-lmn">
</Translated> <Translated tag="a" text="Restart WebUI" v-show="s.activetab === 0" @click="s.restart()" class="btn btn-lmn">
</Translated> <Translated tag="a" text="Save &amp;amp; Apply Subnets" v-show="s.activetab === 1" @click="s.saveApplySubnets()" class="btn btn-lmn">
</Translated> <Translated tag="a" text="Save" v-show="s.activetab === 2" @click="s.save()" class="btn btn-lmn">
</Translated> <Translated tag="a" text="Restart WebUI" v-show="s.activetab === 2" @click="s.restart()" class="btn btn-lmn">
</Translated> <Translated tag="a" text="Save" v-show="s.activetab === 3" @click="s.saveWebui()" class="btn btn-lmn">
</Translated> <Translated tag="a" text="Save" v-show="s.activetab === 4" @click="s.saveApiKeys()" class="btn btn-lmn">
</Translated>
</div></div></div></div></component>
<div v-if="s.showNewApiKey" class="block-element animate-modal">
<div class="modal">
<div class="modal-dialog">
<div class="modal-content">
<div class="modal-header">
<Translated tag="h4" text="New API key">
</Translated>
</div> <div class="modal-body">
<form @submit.prevent>
<div>
<Translated tag="span" text="Name:">
</Translated> <input v-model.trim="s.apiKey.name" type="text" class="form-control">
</div> <div style="margin-top:10px;">
<Translated tag="span" text="Ips:">
</Translated> <br> <template v-for="(ip, index) in s.apiKey.ips" :key="index">
<span class="label label-info" @click="s.removeApiKeyIp(ip)" style="display:inline-block;">{{ ip }} <i class="far fa-times-circle">
</i>
</span>
</template> <a @click="s.toggleAddIp()">
<i class="fa fa-plus">
</i>
</a>
</div> <div style="margin-top:10px;">
<Translated tag="span" text="Scope (leave empty to allow the whole API):">
</Translated> <br> <template v-for="(entry, index) in s.apiKey.scope" :key="index">
<span class="label label-warning" @click="s.removeApiKeyScope(entry)" style="display:inline-block; margin-right:5px;">{{ entry }} <i class="far fa-times-circle">
</i>
</span>
</template> <a @click="s.toggleAddScope()">
<i class="fa fa-plus">
</i>
</a>
</div> <div style="margin-top:10px;">
<Translated tag="span" text="Associated user (the API will be called with this user's permissions):">
</Translated> <UserSearch v-model="s._.newApiUser" :find-users="s.findUsers" :placeholder="s.searchText" type="text" class="form-control" autofocus>
</UserSearch>
</div>
</form>
</div> <div class="modal-footer">
<Translated tag="a" text="Save" @click="s.saveApiKey()" :disabled="undefined === '' || !s._.newApiUser?.label" class="btn btn-default btn-flat">
</Translated> <Translated tag="a" text="Close" @click="s.closeAddApiKey()" class="btn btn-default btn-flat">
</Translated>
</div>
</div>
</div>
</div>
</div> <div v-if="s.showUpdateApiKey" class="block-element animate-modal">
<div class="modal">
<div class="modal-dialog">
<div class="modal-content">
<div class="modal-header">
<Translated tag="h4" text="Update API key">
</Translated>
</div> <div class="modal-body">
<form @submit.prevent>
<div>
<Translated tag="span" text="Name:">
</Translated> <input v-model.trim="s.apiKey.name" type="text" class="form-control">
</div> <div style="margin-top:10px;">
<Translated tag="span" text="Ips:">
</Translated> <br> <template v-for="(ip, index) in s.apiKey.ips" :key="index">
<span class="label label-info" @click="s.removeApiKeyIp(ip)" style="display:inline-block;">{{ ip }} <i class="far fa-times-circle">
</i>
</span>
</template> <a @click="s.toggleAddIp()">
<i class="fa fa-plus">
</i>
</a>
</div> <div style="margin-top:10px;">
<Translated tag="span" text="Scope (leave empty to allow the whole API):">
</Translated> <br> <template v-for="(entry, index) in s.apiKey.scope" :key="index">
<span class="label label-warning" @click="s.removeApiKeyScope(entry)" style="display:inline-block; margin-right:5px;">{{ entry }} <i class="far fa-times-circle">
</i>
</span>
</template> <a @click="s.toggleAddScope()">
<i class="fa fa-plus">
</i>
</a>
</div> <div style="margin-top:10px;">
<Translated tag="span" text="Associated user (the API will be called with this user's permissions):">
</Translated> <UserSearch v-model="s._.newApiUser" :find-users="s.findUsers" :placeholder="s.searchText" type="text" class="form-control" autofocus>
</UserSearch>
</div>
</form>
</div> <div class="modal-footer">
<Translated tag="a" text="Save" @click="s.updateApiKey()" :disabled="undefined === '' || !s._.newApiUser?.label" class="btn btn-default btn-flat">
</Translated> <Translated tag="a" text="Close" @click="s.closeUpdateApiKey()" class="btn btn-default btn-flat">
</Translated>
</div>
</div>
</div>
</div>
</div> <div v-if="s.showAddApiKeyIp" class="block-element animate-modal">
<div class="modal">
<div class="modal-dialog">
<div class="modal-content">
<div class="modal-header">
<Translated tag="h4" text="Add IP">
</Translated>
</div> <div class="modal-body">
<form @submit.prevent>
<Translated tag="span" text="IP :">
</Translated> <input v-model.trim="s._.newIp" type="text" class="form-control">
</form>
</div> <div class="modal-footer">
<Translated tag="a" text="Save" @click="s.saveApiKeyIp()" class="btn btn-default btn-flat" :disabled="!s.validateIp(s._.newIp)">
</Translated> <Translated tag="a" text="Close" @click="s.toggleAddIp()" class="btn btn-default btn-flat">
</Translated>
</div>
</div>
</div>
</div>
</div> <div v-if="s.showAddApiKeyScope" style="width:900px; max-width:95vw;" class="block-element animate-modal">
<div class="modal">
<div class="modal-dialog">
<div class="modal-content">
<div class="modal-header">
<Translated tag="h4" text="Add scope entry">
</Translated>
</div> <div class="modal-body">
<form @submit.prevent>
<Translated tag="span" text="Method and path, without the /v1 prefix. Use * for one path segment and ** for the rest of the path.">
</Translated> <input v-model.trim="s._.newScope" type="text" class="form-control" placeholder="GET /linbo/hosts/*/status">
</form> <div class="alert alert-info" style="margin-top:20px; margin-bottom:0;">
<i class="fa fa-info-circle">
</i> <Translated tag="span" :text="[&quot;A key without a scope reaches the whole API with the permissions of its&quot;, &quot;                    associated user. A scope restricts it to a list of endpoints; it only ever&quot;, &quot;                    narrows, the user&#x27;s permissions still apply behind it.&quot;].join(&#x27;\n&#x27;)">
</Translated> <br> <Translated tag="span" :text="[&quot;Write the path as it appears in the API documentation but without the /v1&quot;, &quot;                    prefix. The method may be * to allow any of them. Mind the trailing slash:&quot;, &quot;                    /users and /users/ are not the same path.&quot;].join(&#x27;\n&#x27;)">
</Translated> <table class="table table-condensed" style="margin-top:10px; margin-bottom:10px; background:transparent;">
<tbody>
<tr>
<td style="width:1%; white-space:nowrap;">
<code>GET /linbo/hosts/pc01/status</code>
</td> <Translated tag="td" text="exactly this path, and nothing else">
</Translated>
</tr> <tr>
<td style="width:1%; white-space:nowrap;">
<code>GET /linbo/hosts/*/status</code>
</td> <Translated tag="td" text="<code>*</code> stands for exactly one path segment, here any host">
</Translated>
</tr> <tr>
<td style="width:1%; white-space:nowrap;">
<code>GET /linbo/**</code>
</td> <Translated tag="td" text="<code>**</code> stands for the rest of the path, here every route below /linbo. It is only allowed at the end.">
</Translated>
</tr> <tr>
<td style="width:1%; white-space:nowrap;">
<code>* /devices/list/default-school</code>
</td> <Translated tag="td" text="any method on that one path">
</Translated>
</tr>

</tbody>
</table> <Translated tag="span" :text="[&quot;A scope entry that matches no route of the API is written to the&quot;, &quot;                    linuxmuster-api log when the service starts, and never allows anything.&quot;].join(&#x27;\n&#x27;)">
</Translated>
</div>
</div> <div class="modal-footer">
<Translated tag="a" text="Save" @click="s.saveApiKeyScope()" class="btn btn-default btn-flat" :disabled="!s.validateScope()">
</Translated> <Translated tag="a" text="Close" @click="s.toggleAddScope()" class="btn btn-default btn-flat">
</Translated>
</div>
</div>
</div>
</div>
</div> <div v-if="s.showApiKeySecret" style="width:600px; max-width:90vw;" class="block-element animate-modal">
<div class="modal">
<div class="modal-dialog">
<div class="modal-content">
<div class="modal-header">
<Translated tag="h4" text="Api key secret">
</Translated>
</div> <div class="modal-body">
<Translated tag="p" text="Copy this secret now, it will not be shown in clear text like this again." class="alert alert-info">
</Translated> <textarea readonly rows="3" class="form-control" style="font-family: monospace; resize: none;" @click="$event.target.select()">{{ s.apiKeySecret }}</textarea>
</div> <div class="modal-footer">
<a @click="s.copyApiKeySecret()" class="btn btn-default btn-flat">
<i class="fa fa-copy">
</i> <Translated tag="span" text="Copy">
</Translated>
</a> <Translated tag="a" text="Close" @click="s.closeApiKeySecret()" class="btn btn-default btn-flat">
</Translated>
</div>
</div>
</div>
</div>
</div>
</div>
</template>
