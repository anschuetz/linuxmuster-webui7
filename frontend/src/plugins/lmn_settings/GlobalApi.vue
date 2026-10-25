<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.api_keys">
<br> <Translated tag="p" text="linuxmuster-api does not seem to be installed on your system." v-show="s.missing_lmnapi" class="alert alert-info">
</Translated> <div v-show="!s.missing_lmnapi">
<Translated tag="p" text="This tab allow you to configure the api keys for linuxmuster-api" class="alert alert-info">
</Translated> <div>
<Translated tag="span" text="Enable host key authentication">
</Translated> <input v-model="s.api_keys.enable_host_auth" type="checkbox">
</div> <div v-show="s.api_keys.enable_host_auth" style="margin-top:20px;">
<button class="btn btn-success float-end" @click="s.addApiKey()">
<i class="fa fa-plus">
</i> <Translated tag="span" text="Add a key">
</Translated>
</button> <Translated tag="h3" text="Hosts keys">
</Translated> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="Name">
</Translated> <Translated tag="th" text="Ips">
</Translated> <Translated tag="th" text="Scope">
</Translated> <Translated tag="th" text="User context">
</Translated> <th>
</th> <th>
</th> <th>
</th>
</tr> <template v-for="(key, name, index) in s.api_keys.keys" :key="index">
<tr>
<td>{{ name }}</td> <td>
<template v-for="(ip, index) in key.ips" :key="index">
<span class="badge c12-label bg-info" style="margin-right:5px;">{{ ip }}</span>
</template>
</td> <td>
<template v-for="(entry, index) in key.scope" :key="index">
<span class="badge c12-label bg-warning" style="margin-right:5px;">{{ entry }}</span>
</template>
</td> <td>{{ key.user }}</td> <td width="1">
<button class="btn c12-button" @click="s.editApiKey(key, name)">
<i class="fa fa-pencil">
</i>
</button>
</td> <td width="1">
<button class="btn c12-button" @click="s.showApiKey(key)">
<i class="fa fa-eye">
</i>
</button>
</td> <td width="1">
<button class="btn c12-button" @click="s.deleteApiKey(name)">
<i class="fa fa-trash-o">
</i>
</button>
</td>
</tr>
</template>

</tbody>
</table>
</div>
</div>
</div>
</template>
