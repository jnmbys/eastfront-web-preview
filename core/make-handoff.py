"""Package the reproducible Core and evidence, excluding dependencies and Git metadata."""
from pathlib import Path
import zipfile, hashlib
root=Path(__file__).resolve().parents[1]
out=root/'core/archives/CORE-FIX-001-handoff.zip'
files=[]
for folder in ['core','docs/corefix001','evidence/corefix001']:
 for p in (root/folder).rglob('*'):
  if p.is_file() and 'node_modules' not in p.parts and p!=out and p.name!='HANDOFF-SHA256.txt':files.append(p)
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(files):
  info=zipfile.ZipInfo(str(p.relative_to(root)),date_time=(2026,9,28,0,0,0))
  info.compress_type=zipfile.ZIP_DEFLATED
  z.writestr(info,p.read_bytes())
hash=hashlib.sha256(out.read_bytes()).hexdigest()
(root/'core/archives/HANDOFF-SHA256.txt').write_text(hash+'  CORE-FIX-001-handoff.zip\n')
print(hash,len(files),out.stat().st_size)
