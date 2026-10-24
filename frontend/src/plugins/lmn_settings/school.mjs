import { computed, reactive } from 'vue';
import { createValidation } from '../../common/validation.mjs';
import { openFileBackups } from '../../common/fileBackups.mjs';
import ApplyDialog from '../lmn_quotas/ApplyDialog.vue';
import { openUsersCheck as openLegacyUsersCheck } from './shell.mjs';

const classes = ['lower', 'upper', 'digit', 'special'];
function ruleForm(rules) {
    return rules.reduce((form, rule) => {
        if (rule.type === 'min_length') return { ...form, minLength: rule.value };
        if (rule.type === 'require_classes') return { ...form, classes: { ...form.classes, ...Object.fromEntries(rule.classes.map(c => [c, true])) }, count: rule.count };
        return form;
    }, { minLength: null, classes: Object.fromEntries(classes.map(c => [c, false])), count: null });
}
function rulesFromForm(form) {
    const selected = Object.keys(form.classes).filter(key => form.classes[key]);
    return [
        ...(form.minLength ? [{ type: 'min_length', value: form.minLength }] : []),
        ...(selected.length ? [{ type: 'require_classes', classes: selected, ...(form.count ? { count: form.count } : {}) }] : []),
    ];
}

/** HTTP domain state for the original LMSettingsController. */
export function createSchoolSettings(aj, { openUsersCheck = openLegacyUsersCheck } = {}) {
    const validation = createValidation(aj);
    const gettext = aj.gettext;
    const notifySaved = () => aj.notify.success(gettext('Saved'));
    // HTTP failures are reported by the shared Ajenti interceptor, as in Angular.
    const handled = promise => promise.catch(() => undefined);
    const state = reactive({
        activetab: 0, settings: undefined, encoding: undefined, holidays: undefined,
        templates_individual: undefined, templates_multiple: undefined,
        custom: undefined, customMulti: undefined, customDisplay: undefined, proxyAddresses: undefined,
        templates: undefined, passwordTemplates: undefined, currentSchool: undefined,
        passwordConstraints: undefined, passwordConstraintsForm: undefined,
        trans: { remove: gettext('Remove') },
        custom_fields_role_selector: 'students',
        isGlobalAdmin: computed(() => aj.identity.profile.sophomorixRole === 'globaladministrator'),
        passwordConstraintsRoles: ['student', 'teacher', 'parent', 'staff', 'schooladministrator', 'globaladministrator'],
        passwordConstraintsRole: 'student', passwordRuleClasses: classes,
        passwordRuleClassLabels: { lower: gettext('Lowercase letter'), upper: gettext('Uppercase letter'), digit: gettext('Digit'), special: gettext('Special character') },
        logLevels: [{ name: gettext('Minimal'), value: 0 }, { name: gettext('Average'), value: 1 }, { name: gettext('Maximal'), value: 2 }],
        unit: 'MiB', encodings: ['auto', 'ASCII', 'ISO_8859-1', 'ISO_8859-15', 'WIN-1252', 'UTF8'],
        customDisplayOptions: ['', 'proxyAddresses', ...[1, 2, 3, 4, 5].map(n => `sophomorixCustom${n}`), ...[1, 2, 3, 4, 5].map(n => `sophomorixCustomMulti${n}`)],
    });
    const validPrinter = () => {
        const valid = validation.isValidDomain(state.settings.school.PRINTSERVER);
        if (valid !== true) aj.notify.error(valid);
        return valid === true;
    };
    Object.assign(state, {
        checkedClassCount: form => form ? Object.values(form.classes).filter(Boolean).length : 0,
        clampRequiredCount(form) {
            if (!form) return;
            const max = state.checkedClassCount(form);
            if (form.count && form.count > max) form.count = max || null;
        },
        filterscriptNotEmpty() {
            for (const role of ['students', 'teachers', 'extrastudents']) {
                const key = `userfile.${role}.csv`;
                if (state.settings[key].FILTERSCRIPT === '') state.settings = { ...state.settings, [key]: { ...state.settings[key], FILTERSCRIPT: '---' } };
            }
        },
        addHoliday() { state.holidays = [...state.holidays, { name: '', start: '', end: '' }]; },
        removeHoliday(holiday) {
            return handled(aj.messagebox.show({ text: gettext('Are you sure you want to delete permanently these holidays ?'), positive: gettext('Delete'), negative: gettext('Cancel') })
                .then(() => { state.holidays = state.holidays.filter(entry => entry !== holiday); }));
        },
        save() {
            if (!validPrinter()) return;
            return handled(aj.http.post('/api/lmn/schoolsettings', state.settings).then(notifySaved));
        },
        saveAndCheck() {
            if (!validPrinter()) return;
            return handled(aj.http.post('/api/lmn/schoolsettings', state.settings).then(() => { handled(openUsersCheck()); notifySaved(); }));
        },
        saveApplyQuota() {
            handled(aj.http.post('/api/lmn/schoolsettings', state.settings).then(notifySaved));
            return handled(aj.modal.open(ApplyDialog, {}, { backdrop: 'static' }));
        },
        saveApplyHolidays() {
            if (document.getElementsByClassName('has-error').length > 0) {
                aj.notify.error(gettext('Please first correct the mal formated fields.')); return;
            }
            return handled(aj.http.post('/api/lmn/holidays', state.holidays).then(notifySaved));
        },
        validateDate: date => validation.isValidDate(date) !== true ? 'has-error' : undefined,
        backups: () => handled(openFileBackups(aj, '/etc/linuxmuster/sophomorix/default-school/school.conf')),
        saveCustom() {
            const config = { custom: state.custom, customMulti: state.customMulti, customDisplay: state.customDisplay, proxyAddresses: state.proxyAddresses,
                passwordTemplates: { multiple: state.templates.multiple.path, individual: state.templates.individual.path } };
            return handled(aj.http.post('/api/lmn/config/customfields', { config }).then(notifySaved));
        },
        hasSchoolOverride: role => Boolean(state.passwordConstraintsForm?.schools[state.currentSchool]?.[role]),
        toggleSchoolOverride(role) {
            const schools = state.passwordConstraintsForm.schools;
            const school = { ...schools[state.currentSchool] };
            if (state.hasSchoolOverride(role)) delete school[role];
            else school[role] = ruleForm([]);
            const next = { ...schools, [state.currentSchool]: school };
            if (Object.keys(school).length === 0) delete next[state.currentSchool];
            state.passwordConstraintsForm = { ...state.passwordConstraintsForm, schools: next };
        },
        savePasswordConstraints() {
            const forms = state.passwordConstraintsForm;
            const config = {
                ...(state.isGlobalAdmin ? { default: Object.fromEntries(state.passwordConstraintsRoles.map(role => [role, rulesFromForm(forms.default[role])])) } : {}),
                schools: Object.fromEntries(Object.entries(forms.schools).map(([school, roles]) => [school, Object.fromEntries(Object.entries(roles).map(([role, form]) => [role, rulesFromForm(form)]))])),
            };
            return aj.http.post('/api/lmn/config/passwordconstraints', { config }).then(() => { state.passwordConstraints = config; notifySaved(); })
                .catch(error => aj.notify.error(error.data?.message || gettext('Could not save password constraints')));
        },
        // The original template calls an undefined load_custom_config on two tabs;
        // its initial load is the sole actual request. Keep the click a no-op.
        load_custom_config() {},
    });
    state.ready = Promise.all([
        handled(aj.http.get('/api/lmn/schoolsettings').then(({ data }) => {
            state.encoding = {};
            // Preserve the duplicate extrastudents request and the fixed school.
            for (const file of ['userfile.students.csv', 'userfile.extrastudents.csv', 'userfile.teachers.csv', 'userfile.extrastudents.csv']) {
                if (data[file].ENCODING === 'auto') handled(aj.http.post('/api/lmn/schoolsettings/determine-encoding', { path: `/etc/linuxmuster/sophomorix/default-school/${file.substring(file.indexOf('.') + 1)}`, file })
                    .then(response => { state.encoding = { ...state.encoding, [file]: response.data }; }));
            }
            state.settings = data;
        })),
        handled(aj.http.get('/api/lmn/schoolsettings/latex-templates').then(async ({ data }) => {
            [state.templates_individual, state.templates_multiple] = data;
            const { data: config } = await aj.http.get('/api/lmn/config/customfields/');
            Object.assign(state, { custom: config.custom, customMulti: config.customMulti, customDisplay: config.customDisplay, proxyAddresses: config.proxyAddresses, passwordTemplates: config.passwordTemplates });
            state.templates = { individual: data[0].find(t => t.path === config.passwordTemplates.individual) || '', multiple: data[1].find(t => t.path === config.passwordTemplates.multiple) || '' };
        })),
        handled(aj.http.get('/api/lmn/holidays').then(({ data }) => { state.holidays = data; })),
        handled(aj.http.get('/api/lmn/activeschool').then(async ({ data }) => {
            state.currentSchool = data;
            const { data: config } = await aj.http.get('/api/lmn/config/passwordconstraints');
            state.passwordConstraints = config;
            state.passwordConstraintsForm = {
                default: Object.fromEntries(state.passwordConstraintsRoles.map(role => [role, ruleForm(config.default[role] || [])])),
                schools: Object.fromEntries(Object.entries(config.schools).map(([school, roles]) => [school, Object.fromEntries(Object.entries(roles).map(([role, rules]) => [role, ruleForm(rules)]))])),
            };
        })),
    ]);
    return state;
}
