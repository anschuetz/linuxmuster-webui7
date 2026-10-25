<script setup>
import { computed, inject, ref } from 'vue';
import Welcome from './Welcome.vue';
import LmLog from '../../common/LmLog.vue';
import { redirect, setupURL } from './browser.mjs';

const { step } = defineProps({ step: { type: String, required: true } });
const aj = inject('aj');
// Keep the original HTML entity in the msgid until the catalog lookup.
const serverDomainTitle = 'Server &amp; Domain Information';
const ini = ref(step === 'school' ? { schoolname: '', domainname: '', servername: '' } : {});
const languages = ref();
const confirmation = ref();
const errors = ref({});
const isWorking = ref(true);
let target;
aj.pageTitle.set(aj.gettext(step === 'done' ? 'Setup Done' : 'Setup Wizard'));
const schoolFields = ['schoolname', 'domainname', 'servername'];
// These are the wizard's own regexps, narrower than lmn_common validation.
const patterns = { servername: /^[a-zA-Z0-9\-]+$/, domainname: /^[a-zA-Z\-\.]+\.[a-zA-Z\-\.]+$/ };
const validChars = password => /^[a-zA-Z0-9!@#§+\-%&*{}()\]\[]+$/.test(password);
const strong = password => /(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#§+\-%&*{}()\]\[]|(?=.*\d)).{7,}/.test(password);
const samePW = computed(() => ini.value.adminpw === confirmation.value);
const validPW = computed(() => validChars(ini.value.adminpw) && !!ini.value.adminpw && !ini.value.adminpw.includes('#'));
const strongPW = computed(() => strong(ini.value.adminpw));
const checkPW = computed(() => validPW.value && strongPW.value && samePW.value);
const summaryReady = computed(() => ini.value.servername !== undefined && ini.value.servername !== null);
const schoolValue = field => {
    const value = ini.value[field];
    return patterns[field] && value && !patterns[field].test(value) ? undefined : value;
};
const inputStyle = field => errors.value[field] ? { background: 'rgba(255, 178, 178, 0.29)', borderColor: 'red' } : {};
function resetColor(field) { errors.value = { ...errors.value, [field]: false }; }

async function load(url, assign) {
    try { const { data } = await aj.http.get(url); assign(data); } catch {
        // Retain the original loading/form state. The adapter displays HTTP errors.
    }
}
if (step === 'school') load('/api/core/languages', data => { languages.value = data; });
if (['school', 'externalservices', 'summary'].includes(step)) load('/api/lmn/setup-wizard/setup', data => { ini.value = data ?? {}; });
if (step === 'done') load('/api/lmn/read-config-setup', data => { target = setupURL(data.setup); });

async function save(data, next) {
    try {
        await aj.http.post('/api/lmn/setup-wizard/setup', data);
        aj.navigate('/view/lmn/init/' + next);
    } catch {
        // Do not navigate on failure, matching the original HTTP interceptor policy.
    }
}
function applySchool() {
    const values = schoolFields.map(field => schoolValue(field));
    errors.value = Object.fromEntries(schoolFields.map((field, index) => [field, values[index] === '' || values[index] == null]));
    if (values.some(value => value === '')) { aj.notify.error('Required data missing'); return; }
    if (values.some(value => value === null || value === undefined)) { aj.notify.error('Malformed input'); return; }
    return save({ ...ini.value }, 'account');
}
function applyAccount() {
    if (!samePW.value) { aj.notify.error('Administrator password missmatch'); return; }
    if (!validChars(ini.value.adminpw)) { aj.notify.error('Password contains invalid characters'); return; }
    if (!strongPW.value) { aj.notify.error('Password too weak'); return; }
    // Original discrepancy retained: the hint forbids #, Apply accepts it.
    return save({ ...ini.value }, 'externalservices');
}
function applyExternal() {
    // The current template exposes only skipfw: all three service toggles are unset.
    return save({ ...ini.value, opsiip: 'null', dockerip: 'null', mailip: 'null', smtprelay: 'null', smtpuser: 'null', smtppw: 'null' }, 'summary');
}
async function provision() {
    try {
        await aj.http.post('/api/lmn/setup-wizard/provision', { start: 'setup' });
        isWorking.value = false;
        aj.notify.success(aj.gettext('Setup complete'));
    } catch (error) {
        isWorking.value = false;
        aj.notify.error(error.data?.message || aj.gettext('Setup failed'));
    }
}
if (step === 'setup') provision();
async function restartUI() {
    const message = aj.messagebox.show({ progress: true, title: aj.gettext('Restarting') });
    // A progress dialog can be dismissed; the old caller doesn't wait for its result.
    message.catch(() => {});
    try {
        await aj.http.post('/api/core/restart-master');
        setTimeout(() => {
            message.close();
            aj.messagebox.show({ title: aj.gettext('Restarted'), text: aj.gettext('Please wait') }).catch(() => {});
            setTimeout(() => {
                redirect(target);
                setTimeout(() => redirect(target), 5000);
            }, 0);
        }, 5000);
    } catch (error) {
        message.close();
        aj.notify.error(aj.gettext('Could not restart'), error.message);
    }
}
</script>

<template>
    <div data-wizard role="dialog" class="block-element animate-modal">
        <div class="modal" style="z-index:1049"><div class="modal-dialog" :class="['summary', 'done'].includes(step) ? 'modal-lv' : 'modal-lg'"><div class="modal-content">
            <Welcome v-if="step === 'welcome'" />
            <template v-else-if="step === 'school'">
                <div class="modal-header"><h3>{{ aj.gettext('School Information') }}</h3></div>
                <div style="height:550px" class="modal-body scrollable">
                    <div class="c14-field"><label>{{ aj.gettext('School name') }}</label><input id="schoolname-input" v-model.trim="ini.schoolname" type="text" class="form-control" :placeholder="aj.gettext('e.g.: Linuxmuster-Example School')" :style="inputStyle('schoolname')" @input="resetColor('schoolname')"></div>
                    <table class="lm-table lm-table-padded"><tbody><tr>
                        <td width="40%"><div class="c14-field"><label>{{ aj.gettext('Location') }}</label><input id="location-input" v-model.trim="ini.location" type="text" class="form-control" :placeholder="aj.gettext('e.g.: Guetenbach')"></div></td>
                        <td width="40%"><div class="c14-field"><label>{{ aj.gettext('State') }}</label><input id="state-input" v-model.trim="ini.state" type="text" class="form-control" :placeholder="aj.gettext('e.g.: Baden-Wuerttemberg')"></div></td>
                        <td width="20%"><div class="c14-field"><label>{{ aj.gettext('Language') }}</label><select id="country-input" v-model="ini.country" class="form-control form-select c14-select"><option v-for="language in languages" :key="language" :value="language">{{ language }}</option></select></div></td>
                    </tr></tbody></table>
                    <h3 v-html="aj.gettext(serverDomainTitle)"></h3>
                    <table class="lm-table lm-table-padded"><tbody><tr>
                        <td width="40%"><div class="c14-field"><label>{{ aj.gettext('Server name') }}</label><input id="servername-input" v-model.trim="ini.servername" type="text" pattern="^[a-zA-Z0-9\-]+$" class="form-control" :placeholder="aj.gettext('e.g.: server')" :style="inputStyle('servername')" @input="resetColor('servername')"></div></td>
                        <td width="60%"><div class="c14-field"><label>{{ aj.gettext('Domain name') }}</label><input id="domainname-input" v-model.trim="ini.domainname" type="text" pattern="^[a-zA-Z\-\.]+\.[a-zA-Z\-\.]+$" class="form-control" :placeholder="aj.gettext('e.g.: linuxmuster.lan')" :style="inputStyle('domainname')" @input="resetColor('domainname')"></div></td>
                    </tr></tbody></table>
                    <div class="alert alert-info"><i class="fa fa-info-circle"></i> <span v-html="aj.gettext('Note: The first part (up to the first dot) of the domain name will be used as the SAMBA domain and has a maximal length of 15 characters. We suggest to use &quot;linuxmuster&quot; or &quot;lmn&quot; and prepend it to your domain.')"></span><br><span>{{ aj.gettext('Valid characters are: a-z') }}</span></div>
                    <div class="c14-field"><label>{{ aj.gettext('Server FQDN') }}</label><input type="text" class="form-control" disabled :value="`${schoolValue('servername') ?? ''}.${schoolValue('domainname') ?? ''}`"></div>
                </div>
                <div class="modal-footer"><a href="/view/lmn/init/welcome" class="btn btn-light c14-button btn-flat float-start" @click.prevent="aj.navigate('/view/lmn/init/welcome')">{{ aj.gettext('Back') }}</a><a href="#" class="btn btn-light c14-button btn-flat" @click.prevent="applySchool">{{ aj.gettext('Next') }}</a></div>
            </template>
            <template v-else-if="step === 'account'">
                <div class="modal-header"><h3>{{ aj.gettext('Account Information') }}</h3></div>
                <div style="height:400px" class="modal-body scrollable">
                    <div class="alert alert-info"><i class="fa fa-info-circle"></i> <span>{{ aj.gettext('Note: Minimal length is 7 characters. Use upper, lower and special characters or numbers. (e.g. mUster!)') }}</span><br><span>{{ aj.gettext('Valid characters are:') }}</span><span> a-z A-Z 0-9 ?!§+-@%&amp;*( )[ ]{ } </span></div>
                    <div class="c14-field"><label>Global-Admin and root password</label><input v-model="ini.adminpw" type="password" class="form-control" placeholder="Password"><input v-model="confirmation" type="password" class="form-control" placeholder="Confirmation"></div>
                    <div v-show="ini.adminpw && !checkPW" class="alert alert-danger"><span>Please correct the following point(s) :</span><ul><li v-show="!samePW">{{ aj.gettext('The two given passwords differ') }}</li><li v-show="!validPW">{{ aj.gettext('Password contains invalid characters') }}</li><li v-show="!strongPW">{{ aj.gettext('Password too weak') }}</li></ul></div><br>
                </div>
                <div class="modal-footer"><a href="/view/lmn/init/school" class="btn btn-light c14-button btn-flat float-start" @click.prevent="aj.navigate('/view/lmn/init/school')">{{ aj.gettext('Back') }}</a><a href="#" :disabled="!checkPW" class="btn btn-light c14-button btn-flat" @click.prevent="applyAccount">{{ aj.gettext('Next') }}</a></div>
            </template>
            <template v-else-if="step === 'externalservices'">
                <div class="modal-header"><h3>{{ aj.gettext('External Services') }}</h3></div>
                <div class="modal-body"><div class="c14-field"><label>{{ aj.gettext('Skip Firewall Configuration') }}</label> <span checkbox :class="{ active: !!ini.skipfw }" @click="ini = { ...ini, skipfw: !ini.skipfw }"><i class="fa fa-square-o off"></i><i class="fa fa-check-square on"></i></span><br></div></div>
                <div class="modal-footer"><a href="/view/lmn/init/account" class="btn btn-light c14-button btn-flat float-start" @click.prevent="aj.navigate('/view/lmn/init/account')">{{ aj.gettext('Back') }}</a><a href="#" class="btn btn-light c14-button btn-flat" @click.prevent="applyExternal">{{ aj.gettext('Next') }}</a></div>
            </template>
            <template v-else-if="step === 'summary'">
                <div class="modal-header"><h3>{{ aj.gettext('Summary') }}</h3></div>
                <div style="height:550px" class="modal-body scrollable"><div class="c14-field">
                    <h4>{{ aj.gettext('Almost done...') }}</h4><div v-html="aj.gettext('We got all information needed for the provisioning proccess.<br>Before proceeding please check your data <b>carefully</b>!')"></div><br>
                    <component :is="'progress-spinner'" v-if="!summaryReady" class="progress-spinner"><div><div class="one"></div><div class="two"></div></div></component>
                    <div v-else>
                        <div class="c14-field"><label>{{ aj.gettext('School Information') }}</label><br><table><tbody><tr v-for="[field, label] in [['schoolname', 'School Name:'], ['location', 'Location'], ['state', 'State'], ['country', 'Country']]" :key="field" class="leaders"><td class="summary"><span>{{ aj.gettext(label) }}</span><span><b>{{ ini[field] }} </b></span></td><td></td></tr></tbody></table></div>
                        <div class="c14-field"><label v-html="aj.gettext(serverDomainTitle)"></label><br><table><tbody><tr v-for="[field, label] in [['servername', 'Server name'], ['domainname', 'Domain name'], ['fqdn', 'Server FQDN']]" :key="field" class="leaders"><td class="summary"><span>{{ aj.gettext(label) }}</span><span><b>{{ field === 'fqdn' ? `${ini.servername}.${ini.domainname}` : ini[field] }} </b></span></td><td :class="field === 'fqdn' ? 'check' : undefined"></td></tr></tbody></table></div>
                        <div class="c14-field"><label>{{ aj.gettext('External Services') }}</label><br><table><tbody><tr class="leaders"><td class="summary"><span>{{ aj.gettext('Firewall') }}</span> <span v-html="aj.gettext(ini.skipfw === 'True' ? 'Configuration will be <b>skipped </b>' : 'Firewall will be <b>configured!</b>')"></span></td><td class="check"></td></tr></tbody></table></div>
                    </div>
                </div></div><div class="modal-body"></div>
                <div v-if="summaryReady"><div class="modal-footer"><a href="/view/lmn/init/externalservices" class="btn btn-light c14-button btn-flat float-start" @click.prevent="aj.navigate('/view/lmn/init/externalservices')">{{ aj.gettext('Back') }}</a><a href="#" class="btn btn-light c14-button btn-flat" @click.prevent="save({ ...ini }, 'setup')">{{ aj.gettext('Start provisioning') }}</a></div></div>
            </template>
            <template v-else-if="step === 'setup'">
                <div class="modal-header"><h3>{{ aj.gettext('Setup') }}</h3></div>
                <div class="modal-body scrollable"><component :is="'progress-spinner'" v-show="isWorking" class="progress-spinner"><div><div class="one"></div><div class="two"></div></div></component><LmLog path="/tmp/linuxmuster-setup.log" /></div>
                <div v-if="!isWorking" class="modal-footer"><a href="#" class="btn btn-light c14-button btn-flat" @click.prevent="aj.navigate('/view/lmn/init/done')">{{ aj.gettext('Finish') }}</a></div>
            </template>
            <template v-else-if="step === 'done'">
                <div class="modal-header"><h3>{{ aj.gettext('Setup complete') }}</h3></div>
                <div style="height:300px" class="modal-body scrollable"><div class="c14-field"><h4>{{ aj.gettext('Information') }}</h4><div>{{ aj.gettext('The setup was completed.') }}</div><br>
                    <div>{{ aj.gettext('If you hit the close button you will be forwarded to a ssl encrypted version of LinuxMuster Webui. Unless you install a trusted certificate you will be asked to confirm the untrusted, just created, certificate. Confirm this certificate to proceed') }}</div><br>
                    <div>Keep in mind <b>not</b> to login as root user. Login using the <b>global-admin</b> credentials you specified during the setup.</div><br>
                    <div class="modal-footer"><a class="btn btn-light c14-button btn-flat" @click="restartUI">{{ aj.gettext('Close') }}</a></div>
                </div></div>
            </template>
        </div></div></div>
    </div>
</template>
