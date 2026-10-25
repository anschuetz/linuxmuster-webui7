<script setup>
import { computed, inject, onBeforeUnmount, onMounted } from 'vue';
import Field from './SettingsField.vue';
import PathSelector from '../common/PathSelector.vue';
const props = defineProps({ model: { type: Object, required: true }, customization: { type: Object, default: () => ({}) } });
const aj = inject('aj'), t = text => aj.gettext(text), s = props.model.state;
const cfg = computed(() => s.config), visible = flag => !props.customization[flag];
const help = {
    trusted_domains: t('If Ajenti is installed behind a proxy, oder reachable by a fqdn other than provided by the host,\nyou can then specify the other domains here, and by this way avoiding some resources loading problems.'),
    trusted_proxies: t('If Ajenti is installed behind one or more proxies, specify the ip of these proxies here, in order to\nget the real client ip address.'),
    certificate: t("This certificate is the default certificate used to create client certificate and to provide https connection.\nUsing a Let's Encrypt certificate here will break the client certificate generator.\nUsing a self-generated certificate is fine here."),
    fqdn: t("If you have a special certificate for your domain, like a Let's Encrypt certificate, put it there.\nIf you are not sure, just use the same certificate as the one above."),
};
const colors = ['default', 'bluegrey', 'red', 'deeporange', 'orange', 'green', 'teal', 'blue', 'purple'];
function tab(name) { s.tab = name; if (name === 'Smtp relay') void props.model.getSmtpConfig(); if (name === '2FA') void props.model.getTfaConfig(); }
function closeCertificate() { s.newClientCertificateDialogVisible = false; }
function saveClose() { void props.model.save(); closeCertificate(); s.newClientCertificate.generated = false; }
function revoke(index) { cfg.value.ssl.client_auth.certificates = cfg.value.ssl.client_auth.certificates.filter((_, i) => i !== index); }
const date = seconds => {
    const value = new Date(seconds * 1000), pad = number => String(number).padStart(2, '0');
    return `${pad(value.getDate())} ${value.toLocaleString('en-US', { month: 'long' })} ${value.getFullYear()} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
};
onMounted(props.model.start);
onBeforeUnmount(props.model.dispose);
</script>
<template>
    <div v-if="!aj.identity.isSuperuser" class="text-center root-access-blocker">{{ t('Superuser access required') }}</div>
    <div v-else>
        <div v-if="!cfg" role="progressbar" :aria-label="t('Please wait')"></div>
        <template v-else>
            <nav class="nav nav-tabs shell-settings-tabs">
                <button v-for="name in ['General', 'Security', 'Smtp relay', '2FA']" :key="name" type="button" class="nav-item nav-link btn btn-light shell-stock-button" :class="{active:s.tab === name}" :data-tab="name" :aria-selected="s.tab === name" @click="tab(name)">{{ t(name) }}</button>
            </nav>
            <section v-if="s.tab === 'General'">
                <div v-if="visible('hideMachineSettings')">
                    <Field v-if="visible('hideMachineName')" v-model="cfg.name" label="Machine name" />
                    <Field v-if="visible('hideMachineColor')" v-model="cfg.color" label="Color tag" :options="colors" />
                </div>
                <Field v-if="visible('hideLanguageSettings')" v-model="cfg.language" label="Language" :options="s.languages ?? []" />
                <div v-if="visible('hideBindingSettings')">
                    <Field v-model="cfg.bind.mode" label="Binding" :options="['tcp', 'unix']" />
                    <template v-if="cfg.bind.mode === 'tcp'">
                        <Field v-model="cfg.bind.host" label="Host / IP" /><Field v-model="cfg.bind.port" label="Port" type="number" />
                    </template>
                    <Field v-else v-model="cfg.bind.socket" label="Socket path" />
                </div>
            </section>
            <section v-if="s.tab === 'Security'">
                <div v-if="visible('hideAuthSettings')">
                    <Field v-model="cfg.auth.provider" label="Authentication provider" :options="s.authenticationProviders ?? []" @update:model-value="model.providerWarning()" />
                    <Field v-model="cfg.auth.allow_sudo" label="Allow sudo elevation for logged in users" type="checkbox" />
                </div>
                <div v-if="visible('hideProxiesSettings')">
                    <div v-for="[kind, label] in [['trusted_domains', 'Trusted domains'], ['trusted_proxies', 'Trusted proxies']]" :key="kind">
                        <label :title="help[kind]">{{ t(label) }}</label>
                        <div v-for="(_, i) in cfg[kind]" :key="i" class="input-group">
                            <Field v-model="cfg[kind][i]" :label="`${label} ${i + 1}`" />
                            <button type="button" class="btn btn-light shell-stock-button" :data-action="`delete-${kind}`" @click="model.deleteTrusted(kind, cfg[kind][i])">{{ t('Delete') }}</button>
                        </div>
                        <button type="button" class="btn btn-light shell-stock-button" :data-action="`add-${kind}`" @click="model.addTrusted(kind)">{{ t(kind === 'trusted_domains' ? 'New domain' : 'New proxy') }}</button>
                    </div>
                </div>
                <Field v-if="visible('hideSessionSettings')" v-model="cfg.session_max_time" label="Max session time" type="number" />
                <div v-if="cfg.bind.mode === 'tcp' && visible('hideSSLSettings')">
                    <Field v-model="cfg.ssl.enable" label="Enable SSL" type="checkbox" />
                    <div v-if="cfg.ssl.enable">
                        <Field v-model="cfg.ssl.force" label="Force SSL" type="checkbox" />
                        <label :title="help.certificate">{{ t('SSL certificate file') }}<PathSelector v-model="cfg.ssl.certificate" /></label>
                        <button type="button" class="btn btn-light shell-stock-button" data-action="generate-server" @click="model.createNewServerCertificate()">{{ t('Generate a self-signed certificate') }}</button>
                        <label :title="help.fqdn">{{ t('SSL FQDN certificate file') }}<PathSelector v-model="cfg.ssl.fqdn_certificate" /></label>
                        <div v-if="visible('hideSSLClientAuthSettings')">
                            <Field v-model="cfg.ssl.client_auth.enable" label="Enable client authentication" type="checkbox" />
                            <Field v-model="cfg.ssl.client_auth.force" label="Deny other means of authentication" type="checkbox" />
                            <div v-if="cfg.ssl.client_auth.enable">
                                <p v-if="cfg.ssl.client_auth.certificates.length === 0" class="alert alert-warning">{{ t('No certificates are created yet.') }}</p>
                                <div v-for="(certificate, i) in cfg.ssl.client_auth.certificates" :key="i" class="list-group-item">
                                    {{ certificate.user }} <code>{{ certificate.digest }}</code>
                                    <button type="button" class="btn btn-light shell-stock-button" data-action="revoke" @click="revoke(i)">{{ t('Revoke') }}</button>
                                </div>
                                <button type="button" class="btn btn-light shell-stock-button" data-action="new-certificate" @click="s.newClientCertificateDialogVisible = true">{{ t('New certificate') }}</button>
                                <div v-if="s.newClientCertificateDialogVisible" role="dialog" aria-modal="true" :aria-label="t('New client certificate')" class="modal-dialog">
                                    <h4>{{ t('New client certificate') }}</h4>
                                    <div v-if="s.newClientCertificate.generating" role="progressbar">{{ t('Generating certificate') }}</div>
                                    <template v-else-if="s.newClientCertificate.generated">
                                        <a class="btn btn-primary" :download="`${s.newClientCertificate.user}.p12`" :href="s.newClientCertificate.url">{{ t('Download certificate') }}</a>
                                        <button type="button" class="btn btn-light shell-stock-button" data-action="save-close" @click="saveClose">{{ t('Save and Close') }}</button>
                                    </template>
                                    <template v-else>
                                        <Field :model-value="s.newClientCertificate.user" label="Login as" :options="[...(s.availableUsers ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map(x => x.name)" @update:model-value="model.changeClientUser" />
                                        <Field v-for="[key, label] in [['c','Country'], ['st','State'], ['o','Organization'], ['cn','Common name']]" :key="key" v-model="s.newClientCertificate[key]" :label="label" />
                                        <button type="button" class="btn btn-light shell-stock-button" data-action="generate-client" @click="model.generateClientCertificate()">{{ t('Generate') }}</button>
                                        <button type="button" class="btn btn-light shell-stock-button" data-action="cancel-client" @click="closeCertificate">{{ t('Cancel') }}</button>
                                    </template>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            <section v-if="s.tab === 'Smtp relay'">
                <Field v-if="visible('hideEmailSettings')" v-model="cfg.email.enable" label="Enable email relay for notification" type="checkbox" />
                <div v-if="cfg.email.enable && visible('hideEmailSmtpSettings')">
                    <p v-if="!s.smtp_config?.smtp?.server" class="alert alert-info">{{ t("The smtp.yml config file seems to be empty. Currently it's not possible to send emails with this configuration.") }}</p>
                    <template v-if="s.smtp_config?.smtp">
                        <Field v-model="s.smtp_config.smtp.server" label="SMTP host" />
                        <Field v-model="s.smtp_config.smtp.port" label="Port" :options="[{ id: 'starttls', name: 'TLS ( port 587 )' }, { id: 'ssl', name: 'SSL ( port 465 )' }]" />
                        <Field v-model="s.smtp_config.smtp.user" label="SMTP user" />
                        <Field :key="String(s.showSMTPPassword)" v-model="s.smtp_config.smtp.password" label="SMTP password" :type="s.showSMTPPassword ? 'text' : 'password'" />
                        <button type="button" class="btn btn-light shell-stock-button" data-action="smtp-password" @click="s.showSMTPPassword = !s.showSMTPPassword">{{ t(s.showSMTPPassword ? 'Hide password' : 'Show password') }}</button>
                    </template>
                    <Field v-model="cfg.email.templates.reset_email" label="Template email reset" />
                </div>
            </section>
            <table v-if="s.tab === '2FA'" class="table">
                <thead><tr><th>{{ t('User') }}</th><th>{{ t('Description') }}</th><th>{{ t('Created') }}</th><th></th></tr></thead>
                <tbody><tr v-for="(row, i) in s.tfaList" :key="i"><td>{{ row.user }} <span class="badge">{{ row.provider }}</span></td><td>{{ row.desc }}</td><td>{{ date(row.created) }}</td><td><button type="button" class="btn btn-light shell-stock-button" data-action="delete-tfa" @click="model.deleteTfa(row)">{{ t('Delete') }}</button></td></tr></tbody>
            </table>
        </template>
        <div class="floating-toolbar">
            <button type="button" class="btn btn-light shell-stock-button" data-action="save" @click="model.save()">{{ t('Save') }}</button>
            <button type="button" class="btn btn-light shell-stock-button" data-action="restart" @click="model.restart()">{{ t('Restart panel') }}</button>
        </div>
    </div>
</template>
