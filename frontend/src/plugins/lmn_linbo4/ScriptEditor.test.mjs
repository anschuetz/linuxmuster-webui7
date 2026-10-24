import { expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ScriptEditor from './ScriptEditor.vue';
it('binds embedded Ace verbatim, updates copied content, resizes tabs and destroys it on close',async()=>{
    let value='',change;
    const session={setUseWrapMode:vi.fn()};
    const editor={setOptions:vi.fn(),getSession:()=>session,setValue:vi.fn(v=>{value=v;}),getValue:()=>value,on:vi.fn((event,fn)=>{change=fn;}),resize:vi.fn(),destroy:vi.fn()};
    window.ace={config:{set:vi.fn()},edit:vi.fn(()=>editor)};
    const wrapper=mount(ScriptEditor,{props:{modelValue:'  initial\n',field:'reg',active:false}});
    expect(editor.setValue.mock.calls).toEqual([['  initial\n',-1]]);expect(session.setUseWrapMode.mock.calls).toEqual([[true]]);
    expect(editor.resize.mock.calls).toEqual([[]]);editor.resize.mockClear();
    value='  changed\n';change();expect(wrapper.emitted('update:modelValue')).toEqual([['  changed\n']]);
    await wrapper.setProps({modelValue:'  copied\n',active:true});expect(editor.setValue.mock.calls.at(-1)).toEqual(['  copied\n',-1]);expect(editor.resize.mock.calls).toEqual([[]]);
    await wrapper.setProps({modelValue:'  copied\n'});expect(editor.setValue.mock.calls.length).toEqual(2);
    wrapper.unmount();expect(editor.destroy.mock.calls).toEqual([[]]);delete window.ace;
});
