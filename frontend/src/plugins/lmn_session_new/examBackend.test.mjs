// @vitest-environment node
// Execute only the unchanged Python stop handler with a fake LDAP/command boundary.
// No backend imports, network, files or exam accounts are touched by the handler.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
it('backend derives EXAM target and foreign/base exam CNs from ENDED_FROM and group payloads',()=>{
    const source=fileURLToPath(new URL('../../../../usr/lib/linuxmuster-webui/plugins/lmn_session_new/views.py',import.meta.url));
    const result=execFileSync('python3',['-c',`
import ast,json,sys,types
module=ast.parse(open(sys.argv[1]).read())
handler=next(n for n in ast.walk(module) if isinstance(n,ast.FunctionDef) and n.name=='handle_api_stop_exam')
handler.decorator_list=[]
commands=[]
namespace={'_':lambda v:v,'strftime':lambda *a:'2026-10-24_12h34m56','localtime':lambda:None,'lmn_getSophomorixValue':lambda cmd,key:commands.append([cmd,key])}
exec(compile(ast.fix_missing_locations(ast.Module(body=[handler],type_ignores=[])),sys.argv[1],'exec'),namespace)
ctx=types.SimpleNamespace(context=types.SimpleNamespace(identity='p95-teacher',ldapreader=types.SimpleNamespace(getval=lambda *a:'teacher')))
for session in [
 {'members':[{'cn':'p95-foreign','examMode':True}],'name':'p95-class_p95-foreign_ENDED_FROM_p95-teacher','type':''},
 {'members':[{'cn':'p95-own-exam','examMode':True},{'cn':'p95-off','examMode':False}],'name':'p95','type':'group'}]:
 namespace['handle_api_stop_exam'](ctx,types.SimpleNamespace(json_body=lambda: {'session':session}))
print(json.dumps(commands))
`,source],{encoding:'utf8'});
    expect(JSON.parse(result)).toEqual([
        [['sophomorix-exam-mode','--unset','--subdir','transfer/collected/EXAM__p95-class_p95-foreign_ENDED_FROM_p95-teacher_2026-10-24_12h34m56','-j','--participants','p95-foreign-exam'],'COMMENT_EN'],
        [['sophomorix-exam-mode','--unset','--subdir','transfer/collected/EXAM_group_p95_2026-10-24_12h34m56','-j','--participants','p95-own-exam'],'COMMENT_EN'],
    ]);
});
