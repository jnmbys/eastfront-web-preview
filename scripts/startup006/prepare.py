"""Extract the fixed archive into a new directory; never build or overwrite."""
from pathlib import Path
import hashlib, json, zipfile
manifest = json.loads(Path('evidence/startup-005/candidate-manifest.json').read_text())
archive = Path('../startup-005-close-diagnosis/.startup005/startup-005-candidate-380047b5dccd9cc247ac50d4fb3d81a2336df394.zip')
target = Path('.startup006/candidate').resolve()
assert not target.exists(), 'Already exists; use integrity.mjs to verify without overwriting'
assert target.is_relative_to(Path.cwd().resolve())
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['zipSha256']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    actual = {}
    for entry in z.infolist():
        assert (target / entry.filename).resolve().is_relative_to(target)
        if not entry.is_dir():
            b = z.read(entry)
            actual[entry.filename.removeprefix('./')] = (len(b), hashlib.sha256(b).hexdigest())
    assert actual == {f['path']:(f['bytes'], f['sha256']) for f in manifest['files']}
    z.extractall(target)
print(json.dumps({'sourceCommit':manifest['sourceCommit'], 'zipSha256':manifest['zipSha256'], 'files':len(actual), 'crcPass':True, 'rebuilt':False}))
