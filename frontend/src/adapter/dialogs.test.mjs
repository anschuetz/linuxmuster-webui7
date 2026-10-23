import { afterEach, expect, it, vi } from 'vitest';
import { defineComponent, h, inject, onMounted } from 'vue';
import { createAjentiAdapter } from './ajenti.mjs';
import { createMockAj } from './mock.mjs';
import { mountBridge } from '../bridge/mount.mjs';

const base = () => ({ identity: {}, gettext: (text) => text });
const dialog = defineComponent({
    props: ['value'], emits: ['close'],
    setup(props, { emit }) {
        const aj = inject('aj');
        return () => h('button', { onClick: () => emit('close', props.value) }, aj.gettext('Done'));
    },
});
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });

it('delegates pageTitle in the Angular digest and preserves service errors', () => {
    const queue = [];
    const pageTitle = { set: vi.fn() };
    const aj = createAjentiAdapter({ ...base(), pageTitle, $rootScope: { $evalAsync: (fn) => queue.push(fn) } });
    aj.pageTitle.set('Devices');
    expect(pageTitle.set).not.toHaveBeenCalled();
    queue.shift()();
    expect(pageTitle.set).toHaveBeenCalledWith('Devices');
    const error = new Error('title failed');
    pageTitle.set.mockImplementation(() => { throw error; });
    aj.pageTitle.set('Again');
    expect(() => queue.shift()()).toThrow(error);
});

it.each(['show', 'prompt'])('adapts the core %s thenable, including rejection and close', async (method) => {
    let resolve, reject;
    const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
    // Ajenti show.then accepts only the fulfillment callback.
    const handle = { then: (fn) => pending.then(fn), catch: (fn) => pending.catch(fn), close: vi.fn() };
    const service = { [method]: vi.fn(() => handle) };
    const queue = [];
    const aj = createAjentiAdapter({ ...base(), messagebox: service, $rootScope: { $evalAsync: (fn) => queue.push(fn) } });
    const args = method === 'show' ? [{ title: 'Title', text: 'Text', positive: 'OK', negative: 'Cancel' }] : ['Name', 'initial'];
    const result = aj.messagebox[method](...args);
    expect(result).toBeInstanceOf(Promise);
    expect(service[method]).not.toHaveBeenCalled();
    queue.shift()();
    expect(service[method]).toHaveBeenCalledWith(...args);
    const value = { value: 'answer' };
    resolve(value);
    expect(await result).toBe(value);
    if (method === 'show') {
        result.close(); queue.shift()();
        expect(handle.close).toHaveBeenCalledOnce();
        expect(args[0]).toEqual({ title: 'Title', text: 'Text', positive: 'OK', negative: 'Cancel' });
    }
    const failed = new Promise((yes, no) => { reject = no; });
    service[method].mockReturnValue({ catch: (fn) => failed.catch(fn) });
    const cancelled = aj.messagebox[method](...args);
    queue.shift()();
    reject(value);
    await expect(cancelled).rejects.toBe(value);
    service[method].mockImplementation(() => { throw new Error('unavailable'); });
    const unavailable = aj.messagebox[method](...args);
    queue.shift()();
    await expect(unavailable).rejects.toThrow('unavailable');
});

it('renders the Bootstrap modal, injects aj, resolves close and removes listeners', async () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const aj = createAjentiAdapter(base());
    const result = aj.modal.open(dialog, { value: { saved: true } });
    expect(document.querySelector('.modal-backdrop.in')).not.toBeNull();
    expect(document.querySelector('.modal-dialog .modal-content button').textContent).toBe('Done');
    document.querySelector('.modal-content button').click();
    await expect(result).resolves.toEqual({ saved: true });
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(document.body.classList.contains('modal-open')).toBe(false);
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function));
});

it('uses the component footer and rejects when the component emits cancel', async () => {
    const ownFooter = defineComponent({
        emits: ['cancel'],
        setup(props, { emit }) {
            return () => h('div', { class: 'modal-footer' }, [
                h('button', { onClick: () => emit('cancel') }, 'Abbrechen'),
            ]);
        },
    });
    const aj = createAjentiAdapter(base());
    const result = aj.modal.open(ownFooter);
    expect(document.querySelectorAll('.modal-footer')).toHaveLength(1);
    expect([...document.querySelectorAll('.modal-content button')].map((button) => button.textContent)).toEqual(['Abbrechen']);
    document.querySelector('.modal-footer button').click();
    await expect(result).rejects.toThrow('Modal cancelled');
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
});

it.each(['escape', 'backdrop'])('rejects and cleans up modal on %s', async (action) => {
    const aj = createAjentiAdapter(base());
    const result = aj.modal.open(dialog);
    if (action === 'escape') document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    if (action === 'backdrop') document.querySelector('.modal').click();
    await expect(result).rejects.toBeInstanceOf(Error);
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
});

it('destroys an open modal with its bridge scope', async () => {
    const listeners = new Set();
    const $scope = { $on: (event, fn) => { listeners.add(fn); return () => listeners.delete(fn); } };
    let aj;
    const unmount = vi.fn();
    mountBridge($scope, document.createElement('div'), { mount: (host, adapter) => { aj = adapter; return unmount; } }, base());
    const result = aj.modal.open(dialog);
    [...listeners].forEach((fn) => fn());
    await expect(result).rejects.toBeInstanceOf(Error);
    expect(unmount).toHaveBeenCalledOnce();
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
    expect(listeners.size).toBe(0);
});

it('provides configurable mock dialog services, preserving results and failures', async () => {
    const title = vi.fn();
    const close = vi.fn();
    const promise = Object.assign(Promise.resolve('yes'), { close });
    const messagebox = { show: vi.fn(() => promise), prompt: vi.fn().mockResolvedValue({ value: 'name' }) };
    const modal = { open: vi.fn().mockResolvedValue('saved') };
    const aj = createMockAj({ pageTitle: { set: title }, messagebox, modal });
    aj.pageTitle.set('Title'); expect(title).toHaveBeenCalledWith('Title');
    const result = aj.messagebox.show({ title: 'Question' });
    expect(await result).toBe('yes'); result.close(); expect(close).toHaveBeenCalledOnce();
    expect(await aj.messagebox.prompt('Name', 'initial')).toEqual({ value: 'name' });
    expect(await aj.modal.open(dialog, { value: 1 })).toBe('saved');
    expect(modal.open).toHaveBeenCalledWith(dialog, { value: 1 });
    const error = new Error('cancel');
    title.mockImplementation(() => { throw error; });
    expect(() => aj.pageTitle.set('Title')).toThrow(error);
    for (const service of [messagebox.show, messagebox.prompt, modal.open]) service.mockRejectedValue(error);
    await expect(aj.messagebox.show({})).rejects.toBe(error);
    await expect(aj.messagebox.prompt('Name', '')).rejects.toBe(error);
    await expect(aj.modal.open(dialog)).rejects.toBe(error);
});

it('supplies deterministic mock defaults for the three services', async () => {
    const aj = createMockAj();
    expect(aj.pageTitle.set('Title')).toBeUndefined();
    const result = aj.messagebox.show({ title: 'Question' });
    expect(typeof result.close).toBe('function');
    result.close();
    expect(await result).toEqual({ title: 'Question' });
    expect(await aj.messagebox.prompt('Name', 'initial')).toEqual({ value: 'initial' });
    expect(await aj.modal.open(dialog, {})).toBeUndefined();
});

it('cleans up and rejects when the modal component fails to render', async () => {
    const error = new Error('render failed');
    const broken = defineComponent({ setup() { throw error; } });
    const aj = createAjentiAdapter(base());
    await expect(aj.modal.open(broken)).rejects.toBe(error);
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.querySelector('.modal-backdrop')).toBeNull();
});

it('handles a close emitted during component mounting and restores focus', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const immediate = defineComponent({
        emits: ['close'],
        setup(props, { emit }) {
            onMounted(() => emit('close', 'ready'));
            return () => h('p', 'Ready');
        },
    });
    const aj = createAjentiAdapter(base());
    await expect(aj.modal.open(immediate)).resolves.toBe('ready');
    expect(document.querySelector('.modal')).toBeNull();
    expect(document.activeElement).toBe(opener);
});
