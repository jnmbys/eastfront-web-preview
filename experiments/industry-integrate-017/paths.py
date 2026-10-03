"""017 owns only its directory. The pinned 016 adapter runs unchanged in a private copy."""
from pathlib import Path
import hashlib,json,sys
HERE=Path(__file__).resolve().parent
OUT=HERE/'.runtime'
P16=OUT/'owner'
BASE='15e4d13fa9423ddb474432719468a8a8409823e9'
UI='a1158b3acf730f47704463c59248c779e76d8a7a'
def sha(b):return hashlib.sha256(b).hexdigest()
def digest(x):return sha(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode())
def load_adapter():
    if not __debug__:raise RuntimeError('Use ordinary Python; optimized mode disables upstream assertions.')
    manifest=json.loads((HERE/'INPUTS.json').read_bytes())
    for p,h in manifest['runtimeFiles'].items():
        if sha((OUT/p).read_bytes())!=h:raise RuntimeError('PINNED_RUNTIME_CHANGED:'+p)
    sys.path.insert(0,str(P16)) if str(P16) not in sys.path else None
    import config
    # Only paths relocate; the original transaction implementation is unchanged.
    config.OUT=OUT;config.LIVE=OUT/'live';config.BASE6=OUT/'base6/experiments/industry-integrate-006/.runtime'
    import adapter
    return adapter
