<script setup>
import { inject } from 'vue';
import Translated from './Translated.mjs';
defineProps(['s', 'customization']);
const aj = inject('aj');
</script>
<template>
<div v-if="s.templates && s.custom">
<br> <Translated tag="h3" text="Password printing data">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="School name">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.SCHOOL_LONGNAME" type="text" class="form-control" disabled>
</td>
</tr> <tr>
<td width="25%">
<Translated tag="label" text="Admin description">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.ADMINS_PRINT" type="text" class="form-control">
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="School landing page">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="URL">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLSTART_PRINT" type="text" class="form-control">
</td>
</tr> <tr>
<td width="25%">
<Translated tag="label" text="Comment">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLSTART_COMMENT_PRINT" type="text" class="form-control">
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="Webui">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="URL">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLSCHUKO_PRINT" type="text" class="form-control">
</td>
</tr> <tr>
<td width="25%">
<Translated tag="label" text="Comment">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLSCHUKO_COMMENT_PRINT" type="text" class="form-control">
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="Moodle">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="URL">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLMOODLE_PRINT" type="text" class="form-control">
</td>
</tr> <tr>
<td width="25%">
<Translated tag="label" text="Comment">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLMOODLE_COMMENT_PRINT" type="text" class="form-control">
</td>
</tr>

</tbody>
</table> <Translated tag="h3" text="Webmail">
</Translated> <table class="lm-table lm-table-padded">
<tbody>
<tr>
<td width="25%">
<Translated tag="label" text="URL">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLMAIL_PRINT" type="text" class="form-control">
</td>
</tr> <tr>
<td width="25%">
<Translated tag="label" text="Comment">
</Translated>
</td> <td>
<input v-model.trim="s.settings.school.URLMAIL_COMMENT_PRINT" type="text" class="form-control">
</td>
</tr>
</tbody>
</table> <Translated tag="h3" text="Latex templates">
</Translated> <Translated tag="p" :text="[&quot;If you want to use your own latex template for a specific school, please&quot;, &quot;            store it in the directory /etc/linuxmuster/sophomorix/SCHOOL/latex-templates/.&lt;br /&gt;&quot;, &quot;            It &lt;strong&gt;must&lt;/strong&gt; follow the naming convention&quot;, &quot;            &lt;quote&gt;&amp;lt;SCHOOLNAME&amp;gt;.&amp;lt;TEMPLATENAME&amp;gt;-&amp;lt;LANG&gt;-&amp;lt;NUM&amp;gt;-template.tex&lt;/quote&gt; as specified in&quot;, &quot;            &lt;a href=\&quot;https://github.com/linuxmuster/sophomorix4/blob/bionic/sophomorix-samba/lang/latex/README.latextemplates\&quot;&gt;in sophomorix&#x27;s wiki&lt;/a&gt;.&quot;, &quot;            &lt;br /&gt;&quot;, &quot;            &lt;br /&gt;&quot;, &quot;            If you want to define a template for &lt;strong&gt;all schools&lt;/strong&gt;, please store it in&quot;, &quot;            /usr/share/sophomorix/lang/latex/templates/. &lt;br /&gt;&quot;, &quot;            It &lt;strong&gt;must&lt;/strong&gt; follow the naming convention&quot;, &quot;            &lt;quote&gt;&amp;lt;TEMPLATENAME&amp;gt;-&amp;lt;LANG&gt;-&amp;lt;NUM&amp;gt;-template.tex&lt;/quote&gt; as specified in&quot;, &quot;            &lt;a href=\&quot;https://github.com/linuxmuster/sophomorix4/blob/bionic/sophomorix-samba/lang/latex/README.latextemplates\&quot;&gt;in sophomorix&#x27;s wiki&lt;/a&gt;.&quot;].join(&#x27;\n&#x27;)" class="alert alert-info">
</Translated> <table class="table">
<tbody>
<tr>
<Translated tag="td" text="<b>Template for multiple passwords entries on one page:</b>">
</Translated> <td>
<select v-model="s.templates.multiple" class="form-control">
<option v-for="(t, optionIndex) in s.templates_multiple" :key="optionIndex" :value="t">{{ t.filename }}</option>
</select>
</td>
</tr> <tr>
<Translated tag="td" text="<b>Template for one password entry per page:</b>">
</Translated> <td>
<select v-model="s.templates.individual" class="form-control">
<option v-for="(t, optionIndex) in s.templates_individual" :key="optionIndex" :value="t">{{ t.filename }}</option>
</select>
</td>
</tr>

</tbody>
</table>
</div>
</template>
