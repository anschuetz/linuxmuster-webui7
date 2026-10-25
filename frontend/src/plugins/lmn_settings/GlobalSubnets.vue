<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.subnets">
<br> <Translated tag="h3" text="List of subnets">
</Translated> <Translated tag="div" :text="[&quot;&lt;i class=\&quot;fa fa-warning \&quot;&gt;&quot;, &quot;&lt;/i&gt;&quot;, &quot;                Change this values with high precaution ! A wrong value may completely block your network !&quot;].join(&#x27;\n&#x27;)" class="alert alert-danger">
</Translated> <table class="table">
<tbody>
<tr>
<Translated tag="th" text="Network / Prefix">
</Translated> <Translated tag="th" text="Ip router">
</Translated> <Translated tag="th" text="Begin lease range">
</Translated> <Translated tag="th" text="End lease range">
</Translated> <Translated tag="th" text="Setup flag">
</Translated>
</tr> <template v-for="(subnet, index) in s.subnets" :key="index">
<tr v-if="subnet.network.charAt(0) !== '#'">
<td>
<input v-model.lazy.trim="subnet.network" type="text" placeholder="Network" class="form-control">
</td> <td>
<input v-model.lazy.trim="subnet.routerIp" type="text" placeholder="Ip router" class="form-control">
</td> <td>
<input v-model.lazy.trim="subnet.beginRange" type="text" placeholder="Begin lease range" class="form-control">
</td> <td>
<input v-model.lazy.trim="subnet.endRange" type="text" placeholder="End lease range" class="form-control">
</td> <td>
<input v-model.lazy.trim="subnet.nameServer" type="text" placeholder="Nameserver" class="form-control">
</td> <td>
<input v-model.lazy.trim="subnet.nextServer" type="text" placeholder="Tftp server" class="form-control">
</td> <td>
<input v-model.lazy.trim="subnet.setupFlag" type="text" placeholder="Setup flag" class="form-control">
</td> <td width="1">
<button class="btn c12-button" @click="s.removeSubnet(subnet)" :title="s.trans?.remove">
<i class="fa fa-trash-o">
</i>
</button>
</td>
</tr>
</template>

</tbody>
</table> <button class="btn c12-button" @click="s.addSubnet()">
<i class="fa fa-plus">
</i> <Translated tag="span" text="Add a subnet">
</Translated>
</button>
</div>
</template>
