"""Verify/copy the exact 018 private runtime; never substitute an approximate solver."""
from pathlib import Path
import json,hashlib,shutil,sys,subprocess
root=Path(__file__).resolve().parents[2]
back=root/'experiments/industry-integrate-018';dest=back/'.runtime'
manifest=json.loads((back/'INPUTS.json').read_bytes())['runtimeFiles']
source=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root.parent/'industry-integrate-018/experiments/industry-integrate-018/.runtime'
missing=[name for name in manifest if not (dest/name).is_file()]
if missing and source.is_dir():
 for name,expected in manifest.items():
  raw=(source/name).read_bytes();assert hashlib.sha256(raw).hexdigest()==expected,('SOURCE_HASH_MISMATCH',name)
  p=dest/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(raw)
elif missing:
 subprocess.run([sys.executable,str(back/'prepare.py')],cwd=root,check=True)
for name,expected in manifest.items():assert hashlib.sha256((dest/name).read_bytes()).hexdigest()==expected,('RUNTIME_HASH_MISMATCH',name)
print('Verified exact industry018 runtime:',len(manifest),'files; no solver or rule changes')
