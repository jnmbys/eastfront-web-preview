from pathlib import Path
import tarfile,hashlib,json,io
root=Path(__file__).resolve().parent
with tarfile.open(fileobj=io.BytesIO(b''.join(p.read_bytes() for p in sorted((root/'fixture-parts').glob('*.part'))))) as archive:
    archive.extractall(root,filter='data')
for name,expected in json.loads((root/'fixtures-sha256.json').read_text()).items():
    assert hashlib.sha256((root/name).read_bytes()).hexdigest()==expected,name
print('All fixture and font hashes verified')
