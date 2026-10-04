"""Load private packages with original config validation and pinned live/Core bytes."""
import sys,json,hashlib,gzip,importlib
from pathlib import Path
HERE=Path(__file__).resolve().parent;OUT=HERE/'.runtime';LOADED=None
def sha(b):return hashlib.sha256(b).hexdigest()
def digest(x):return sha(json.dumps(x,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode())
def load():
    global LOADED
    if LOADED:return LOADED
    assert __debug__,'OPTIMIZED_MODE_FORBIDDEN'
    manifest=json.loads((HERE/'INPUTS.json').read_bytes())
    for p,h in manifest['runtimeFiles'].items():assert sha((OUT/p).read_bytes())==h,p
    sys.path.insert(0,str(OUT));mods={}
    for n in ['012','013','016']:
        c=importlib.import_module('stage'+n+'.config');c.BASE6=OUT/'base6/experiments/industry-integrate-006/.runtime';c.LIVE=OUT/'live'
        if n=='016':c.OUT=OUT
        mods[n]=importlib.import_module('stage'+n+'.adapter')
    LOADED=mods;return mods
def reference(n,key):return json.loads(gzip.decompress((OUT/('stage'+n)/'TRACE.json.gz').read_bytes()))[key]
