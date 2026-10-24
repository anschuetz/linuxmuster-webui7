"""Execute unmodified endpoint method bodies with fixture-only globals; no OS/network writes."""
import ast
import json
import sys
from types import SimpleNamespace as NS
from contextlib import contextmanager

request = json.load(sys.stdin)
class Status(Exception):
    pass
@contextmanager
def authorize(permission):
    if permission not in request['permissions']:
        raise Status(403)
    yield
writes = []
def stored(name):
    return NS(data=request.get(name, {}), save=lambda *args: writes.append([name, *args]),
              delete_user_totp=lambda data: writes.append(['tfa', data]))
class Popen:
    returncode = 0
    def __init__(self, args, stdin):
        assert args == ['chpasswd']
    def communicate(self, content):
        writes.append(['passwd', content.decode()])

config = stored('config')
userconfig = stored('userconfig')
namespace = {'os': NS(getuid=lambda: request['uid']), 'authorize': authorize,
    'EndpointReturn': Status, 'json': json,
    'aj': NS(config=config, smtp_config=stored('smtp'), tfa_config=stored('tfa')),
    'UserConfigService': NS(get=lambda context: NS(get_provider=lambda: userconfig)),
    'pwd': NS(getpwall=lambda: [NS(pw_uid=0, pw_gid=0, pw_name='root', pw_gecos='', pw_dir='/root', pw_shell='/bin/sh')]),
    'subprocess': NS(Popen=Popen, PIPE='fixture')}
source = 'passwd.py' if request['kind'] == 'passwd' else 'config.py'
from pathlib import Path
module = ast.parse(Path(__file__).with_name(source).read_text())
handler = next(node for node in module.body if isinstance(node, ast.ClassDef))
handler.decorator_list = []
handler.bases = []
for node in handler.body:
    if isinstance(node, ast.FunctionDef):
        node.decorator_list = []
exec(compile(ast.Module(body=[handler], type_ignores=[]), source, 'exec'), namespace)
context = NS(identity=request['user'], worker=NS(reload_master_config=lambda: None))
http = NS(body=json.dumps(request.get('data')).encode(), json_body=lambda: request.get('data'),
          respond_forbidden=lambda: (_ for _ in ()).throw(Status(403)),
          respond_bad_request=lambda: (_ for _ in ()).throw(Status(400)))
try:
    value = getattr(namespace['Handler'](context), request['method'])(http)
    result = {'status': 200, 'data': value, 'writes': writes}
except Status as error:
    result = {'status': error.args[0], 'writes': writes}
except KeyError as error:
    result = {'status': 500, 'error': 'KeyError:' + str(error), 'writes': writes}
json.dump(result, sys.stdout)
