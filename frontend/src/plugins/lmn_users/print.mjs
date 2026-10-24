import { createCustomFields } from '../../common/users/customFields.mjs';

export const initialPrintOptions = (schoolclass, user, adminClass) => ({
    format: 'pdf', one_per_page: false, pdflatex: true, schoolclass,
    user: user === 'root' ? 'global-admin' : user, adminClass,
    template_one_per_page: '', template_multiple: '',
});
export const printTitle = (schoolclass, school, gettext) => schoolclass !== ''
    ? gettext('Class') + ': ' + schoolclass.join(',') : gettext('All users ' + school);
export function printDownload(options) {
    const prefix = options.schoolclass.length === 1 ? options.schoolclass[0] || 'add' : 'multiclass';
    return `/api/lmn/users/passwords/download/${prefix}-${options.user}.${options.format}`;
}

export function createPrint(aj, { download = url => { window.location.href = url; } } = {}) {
    async function request(url, payload, success, failure, filename) {
        const wait = aj.messagebox.show({ progress: true });
        wait.catch(() => {}); // Dismissing progress does not cancel printing in the original.
        try {
            const { data } = await aj.http.post(url, payload);
            if (data === 'success') {
                aj.notify.success(aj.gettext(success));
                download(filename());
            } else aj.notify.error(failure(data));
            return true;
        } catch {
            // Original closes progress, retains options, and leaves HTTP errors to core.
            return false;
        } finally { wait.close(); }
    }
    return {
        async templates(options, publish = () => {}) {
            if (!options.adminClass.includes('admins')) return;
            const { data: [individual, multiple] } = await aj.http.get('/api/lmn/schoolsettings/latex-templates');
            const defaults = { individual, multiple, template_one_per_page: individual[0], template_multiple: multiple[0] };
            publish(defaults); // Original displays first choices before custom config resolves.
            const { passwordTemplates } = await createCustomFields(aj).loadConfig();
            return {
                ...defaults,
                template_one_per_page: individual.find(t => t.path === passwordTemplates.individual) || individual[0],
                template_multiple: multiple.find(t => t.path === passwordTemplates.multiple) || multiple[0],
            };
        },
        print: (options, currentOptions = () => options) => request('/api/lmn/users/print', options, 'Created password pdf',
            data => aj.gettext('Could not create password pdf: ') + data, () => printDownload(currentOptions())),
        csv(schoolclass, all = false) {
            const user = aj.identity.user;
            return request('/api/lmn/users/print_csv', { user, schoolclass }, 'Created password csv',
                data => aj.gettext(all ? 'Could not create password csv' : 'Could not create password csv: ') + (all ? '' : data),
                () => `/api/lmn/users/passwords/download/${all ? 'add' : schoolclass}-${aj.identity.user}.csv`);
        },
    };
}
