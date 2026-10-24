import { afterEach, expect, it, vi } from 'vitest';
import { h, nextTick, onUnmounted, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { presentationOracle } from '../../test-fixtures/shell/presentation.mjs';
import { createPresentation, ShellServices } from './presentation.mjs';

const cleanups = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) close(); await flushPromises(); document.body.innerHTML = ''; vi.useRealTimers(); vi.restoreAllMocks(); });
function harness(options = {}) {
    const http = { post: vi.fn().mockResolvedValue({ data: null }) }, navigate = vi.fn(), reload = vi.fn();
    const identity = reactive({ profile: { schoolname: 'Demo School' }, color: 'blue' });
    const services = createPresentation({ http, identity, navigate, browserLocation: { reload }, ...options });
    const wrapper = mount(ShellServices, { props: { services }, attachTo: document.body });
    cleanups.push(() => wrapper.unmount());
    return { services, wrapper, http, navigate, reload, identity };
}
function oracle() { const old = presentationOracle(); cleanups.push(old.close); return old; }
const button = (w, label) => w.findAll('button').find(b => b.text() === label);

it('matches notify levels, supports click navigation and dismisses toasts, sticky/timeout and hover pause', async () => {
    vi.useFakeTimers(); const old = oracle(), { services: s, wrapper: w, navigate } = harness();
    for (const level of ['success', 'info', 'warning', 'error']) {
        old.notify[level]('Title', 'Text'); s.notify[level]('Title', 'Text');
        expect(w.exists()).toBe(true);
    }
    await nextTick();
    expect(w.findAll('.toast').map(x => x.attributes('class').match(/toast-(success|info|warning|error)/)[1]).reverse()).toEqual(old.toasts.map(x => x[0]));
    await vi.advanceTimersByTimeAsync(5000); expect(w.findAll('.toast')).toHaveLength(0);
    s.notify.info('Sticky', '<b>text</b>', { sticky: true, timeout: 10 });
    s.notify.warning('Short', '', { timeout: 20 }); await nextTick();
    expect(w.find('.toast-message').find('b').exists()).toBe(false);
    await vi.advanceTimersByTimeAsync(20); expect(w.findAll('.toast')).toHaveLength(1);
    await w.find('.toast').trigger('click'); expect(w.findAll('.toast')).toHaveLength(0);
    s.notify.custom('info', 'Go', 'Body', '/view/next'); old.notify.custom('info', 'Go', 'Body', '/view/next'); await nextTick();
    await w.find('.toast').trigger('mouseenter'); await vi.advanceTimersByTimeAsync(6000);
    expect(w.findAll('.toast')).toHaveLength(1);
    await w.find('.toast').trigger('mouseleave'); await vi.advanceTimersByTimeAsync(4999);
    expect(w.findAll('.toast')).toHaveLength(1);
    await w.find('.toast').trigger('click'); old.toasts.at(-1)[5]();
    expect(navigate.mock.calls.map(([url]) => url)).toEqual(old.redirects);
    s.notify.error('zero', '', { timeout: 0 }); await vi.advanceTimersByTimeAsync(10000);
    expect(w.findAll('.toast')).toHaveLength(1);
});
it('preserves messagebox positive/negative payload, prompt type/default and close-only behavior against core', async () => {
    const old = oracle(), { services: s, wrapper: w } = harness();
    const options = { title: 'Question', text: '<b>literal</b>', positive: 'Yes', negative: 'No' };
    const legacy = old.messagebox.show({ ...options }); let legacyResult;
    legacy.then(value => { legacyResult = value; });
    const result = s.messagebox.show(options); await nextTick();
    expect(w.find('b').exists()).toBe(false);
    await button(w, 'Yes').trigger('click');
    const message = old.messagebox.messages[0]; message.q.resolve(message); old.messagebox.close(message); old.flush();
    expect(await result).toMatchObject({ ...options, visible: false }); expect(legacyResult).toMatchObject(options);
    expect(options).not.toHaveProperty('visible');
    const rejected = s.messagebox.show(options); const rejection = rejected.catch(value => value); await nextTick();
    await button(w, 'No').trigger('click'); expect(await rejection).toMatchObject(options);
    const prompt = s.messagebox.prompt('Secret', null, 'password'); await nextTick();
    expect(w.find('input').attributes('type')).toBe('password'); expect(w.find('input').element.value).toBe('');
    old.messagebox.prompt('Secret', null, 'password'); expect(old.messagebox.messages.at(-1).value).toBe('');
    await w.find('input').setValue('answer'); await w.find('input').trigger('keydown', { key: 'Enter' });
    expect(await prompt).toMatchObject({ value: 'answer' });
    let settled = false; const hidden = s.messagebox.show(options); hidden.then(() => { settled = true; }, () => {}); await nextTick();
    hidden.close(); legacy.close(); old.flush(); await nextTick(); expect(settled).toBe(false); expect(w.find('dialog').exists()).toBe(false);
});
it('trims prompt input like the original directive while preserving password whitespace', async () => {
    const old = oracle(), legacyView = old.mountMessageboxes(), { services: s, wrapper: w } = harness();
    let legacyResult;
    old.messagebox.prompt('Name').then(value => { legacyResult = value; });
    const result = s.messagebox.prompt('Name');
    old.flush(); await nextTick();
    const input = legacyView.querySelector('input');
    input.value = ' foo ';
    input.dispatchEvent(new input.ownerDocument.defaultView.Event('input', { bubbles: true }));
    legacyView.querySelector('.positive').click(); old.flush();
    await w.find('input').setValue(' foo '); await button(w, 'OK').trigger('click');
    expect(legacyResult.value).toBe('foo');
    expect((await result).value).toBe(legacyResult.value);
    const password = s.messagebox.prompt('Secret', '', 'password'); await nextTick();
    await w.find('input').setValue(' foo '); await button(w, 'OK').trigger('click');
    expect((await password).value).toBe(' foo ');
});
it('does not dismiss core messageboxes with Escape or backdrop and rejects open/hidden handles on unmount', async () => {
    const { services: s, wrapper: w } = harness();
    const result = s.messagebox.show({ title: 'Progress', progress: true }); const caught = result.catch(error => error);
    await nextTick(); expect(w.find('[role=progressbar]').exists()).toBe(true);
    await w.find('dialog').trigger('click'); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await nextTick();
    expect(w.find('dialog').exists()).toBe(true); result.close();
    const second = s.messagebox.prompt('Name', 'initial'); const caughtSecond = second.catch(error => error);
    w.unmount(); expect(await caught).toBeInstanceOf(Error); expect(await caughtSecond).toBeInstanceOf(Error);
    expect(() => s.messagebox.show({})).toThrow('disposed');
});
it('renders the server error data without Angular templates', async () => {
    const { services: s, wrapper: w } = harness();
    const promise = s.messagebox.show({ title: 'Server error', negative: 'Close', template: '/core:resources/partial/serverErrorMessage.html', data: { data: { message: 'failure', traceback: '<script>no</script>' } }, scrollable: true });
    const caught = promise.catch(value => value); await nextTick();
    expect(w.text()).toContain('failure'); expect(w.text()).toContain('<script>no</script>'); expect(w.find('script').exists()).toBe(false);
    expect(w.find('.scrollable').exists()).toBe(true); await button(w, 'Close').trigger('click'); await caught;
});

const Dialog = { props: ['value'], emits: ['close', 'cancel'], setup(props, { emit }) { return () => h('div', [h('button', { onClick: () => emit('close', props.value) }, 'Done'), h('button', { onClick: () => emit('cancel') }, 'Cancel')]); } };
it('opens Vue modals with aj injection, size, result and component cleanup', async () => {
    const { services: s } = harness(); const unmounted = vi.fn();
    const Component = { setup() { onUnmounted(unmounted); return () => h(Dialog, { value: 42, onClose: value => Component.finish(value) }); } };
    // Use the normal component close emission, including inherited props.
    const result = s.modal.open({ extends: Dialog, setup(props, ctx) { onUnmounted(unmounted); return Dialog.setup(props, ctx); } }, { value: 42 }, { size: 'lg' });
    expect(document.querySelector('.modal-dialog.modal-lg')).not.toBeNull();
    document.querySelector('.modal-content button').click(); await expect(result).resolves.toBe(42);
    expect(unmounted).toHaveBeenCalledOnce(); expect(document.querySelector('.modal')).toBeNull();
});
it.each(['cancel', 'escape', 'backdrop', 'dispose'])('rejects Vue modals and clears body/listeners on %s', async action => {
    const { services: s, wrapper: w } = harness(); const result = s.modal.open(Dialog); const caught = result.catch(error => error);
    if (action === 'cancel') document.querySelectorAll('.modal-content button')[1].click();
    if (action === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    if (action === 'backdrop') document.querySelector('.modal').click();
    if (action === 'dispose') w.unmount();
    expect(await caught).toBeInstanceOf(Error); expect(document.querySelector('.modal')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
});
it('honors independent static backdrop/keyboard options and only dismisses the top modal', async () => {
    const { services: s } = harness();
    const first = s.modal.open(Dialog, {}, { backdrop: 'static', keyboard: false }); const caught = first.catch(error => error);
    document.querySelector('.modal').click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await flushPromises();
    expect(document.querySelectorAll('.modal')).toHaveLength(1);
    const second = s.modal.open(Dialog); const secondCaught = second.catch(error => error);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await secondCaught;
    expect(document.querySelectorAll('.modal')).toHaveLength(1);
    s.dispose(); await caught;
});
it('rejects render errors and a synchronous close during mount leaves no modal behind', async () => {
    const { services: s } = harness(); const error = Error('broken');
    await expect(s.modal.open({ setup() { throw error; } })).rejects.toBe(error);
    await expect(s.modal.open({ emits: ['close'], setup(props, { emit }) { emit('close', 'mounted'); return () => null; } })).resolves.toBe('mounted');
    expect(document.querySelector('.modal')).toBeNull();
});
it('updates raw page title plus school name like the LM shell, and stops its watcher on disposal', async () => {
    const old = oracle(), { services: s, identity } = harness();
    old.pageTitle.set('Devices'); s.pageTitle.set('Devices'); await nextTick();
    expect(s.state.pageTitle).toBe(old.root.pageTitle); expect(document.title).toBe('Devices | Demo School');
    identity.profile = { schoolname: 'Other' }; await nextTick(); expect(document.title).toBe('Devices | Other');
    s.pageTitle.set(''); await nextTick(); expect(document.title).toBe('Other');
    s.dispose(); identity.profile = { schoolname: 'Late' }; await nextTick(); expect(document.title).toBe('Other');
});
it('aborts restart without HTTP like the original, then confirms and reloads after the original delays', async () => {
    vi.useFakeTimers(); const old = oracle(), { services: s, wrapper: w, http, reload } = harness();
    const cancel = s.restart(); const caught = cancel.catch(value => value); const legacyCancel = old.core.restart(); legacyCancel.catch(() => {});
    await nextTick(); await button(w, 'No').trigger('click'); old.messagebox.messages[0].q.reject('no'); old.flush();
    await caught; expect(http.post).not.toHaveBeenCalled(); expect(old.requests).toHaveLength(0);
    const confirmed = s.restart(); const legacy = old.core.restart(); await nextTick();
    await button(w, 'Yes').trigger('click'); old.messagebox.messages.at(-1).q.resolve('yes'); old.flush();
    let oldResult = 'pending'; legacy.then(value => { oldResult = value; }); old.flush();
    expect(await confirmed).toBe(oldResult); expect(http.post).toHaveBeenCalledExactlyOnceWith('/api/core/restart-master');
    expect(old.requests).toEqual([['POST', '/api/core/restart-master']]);
    await vi.advanceTimersByTimeAsync(4999); expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(w.text()).toContain('Restarted');
    await vi.advanceTimersByTimeAsync(1); expect(reload).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(5000); expect(reload).toHaveBeenCalledTimes(2);
});
it('reports restart HTTP failure and disposes pending restart timers/toast timers', async () => {
    vi.useFakeTimers(); const { services: s, wrapper: w, http, reload } = harness();
    http.post.mockRejectedValueOnce(new Error('offline'));
    const failed = s.restart(); await nextTick(); await button(w, 'Yes').trigger('click'); await failed; await flushPromises(); await nextTick();
    expect(w.text()).toContain('Could not restart'); expect(w.text()).toContain('offline');
    const pending = s.restart(); await nextTick(); await button(w, 'Yes').trigger('click'); await pending;
    w.unmount(); await vi.advanceTimersByTimeAsync(10000); expect(reload).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('ignores a restart response arriving after unmount', async () => {
    vi.useFakeTimers(); const { services: s, wrapper: w, http, reload } = harness();
    let finish; http.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const confirmed = s.restart(); await nextTick(); await button(w, 'Yes').trigger('click'); await confirmed;
    w.unmount(); finish({}); await flushPromises(); await vi.advanceTimersByTimeAsync(10000);
    expect(reload).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('provides the same aj/gettext to modal components, including reactive translations', async () => {
    const language = reactive({ de: false });
    const { services: s } = harness({ gettext: text => language.de ? 'Fertig' : text });
    const { inject } = await import('vue');
    const component = { emits: ['close'], setup(props, { emit }) {
        const aj = inject('aj');
        return () => h('button', { onClick: () => emit('close', aj.identity.profile.schoolname) }, aj.gettext('Done'));
    } };
    const result = s.modal.open(component); expect(document.querySelector('.modal button').textContent).toBe('Done');
    language.de = true; await nextTick(); expect(document.querySelector('.modal button').textContent).toBe('Fertig');
    document.querySelector('.modal button').click(); expect(await result).toBe('Demo School');
});
