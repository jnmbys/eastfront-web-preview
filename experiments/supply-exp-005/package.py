from pathlib import Path
import hashlib,json,zipfile,shutil
root=Path(__file__).parent.resolve();dest=root.parent
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
files=[p for p in sorted(root.rglob('*')) if p.is_file() and '__pycache__' not in p.parts and p.name!='SHA256.json']
(root/'SHA256.json').write_text(json.dumps({str(p.relative_to(root)):sha(p) for p in files},indent=2))
report=dest/'SUPPLY_EXP_005_REPORT_2026-09-28.md';checkpoint=dest/'SUPPLY_EXP_005_CHECKPOINT_2026-09-28_v1.zip';shutil.copyfile(root/'REPORT.md',report)
with zipfile.ZipFile(checkpoint,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in [*files,root/'SHA256.json']:z.write(p,str(p.relative_to(root)))
with zipfile.ZipFile(checkpoint) as z:
 assert z.testzip() is None
 for name,h in json.loads(z.read('SHA256.json')).items():assert hashlib.sha256(z.read(name)).hexdigest()==h
manifest={'task':'SUPPLY-EXP-005','version':'2026-09-28-v1','baseline':'db183c7733ae59d2f5a3bcb8f3f384357b7d59e6','production':'no merge / push / deployment; online version unknown','files':[dict(name=p.name,bytes=p.stat().st_size,sha256=sha(p)) for p in [report,checkpoint]]}
(dest/'SUPPLY_EXP_005_DELIVERY.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest,indent=2))
