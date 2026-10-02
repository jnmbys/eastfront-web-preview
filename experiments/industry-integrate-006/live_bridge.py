"""One unchanged original live.execute call on JSON input; no field patching."""
import hashlib, json, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUNTIME = HERE / '.runtime'
manifest = json.loads((RUNTIME / 'manifest.json').read_bytes())
for name, expected in manifest['files'].items():
    if hashlib.sha256((RUNTIME / name).read_bytes()).hexdigest() != expected:
        raise RuntimeError('FIXED_RUNTIME_CHANGED:' + name)
sys.path.insert(0, str(RUNTIME / 'live/experiments/supply-exp-005'))
from live import execute

payload = json.load(sys.stdin)
# Preserve original 3-second live transaction budget. Interpreter/import startup is separate.
result = execute(json.loads(payload['bundleJSON']), payload['command'])
# Sidecar transport only. Original state, inventory, counters and journal remain untouched.
result['stateJSON'] = json.dumps(result['state'], ensure_ascii=False)
json.dump(result, sys.stdout, ensure_ascii=False)
