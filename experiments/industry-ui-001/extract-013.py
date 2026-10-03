"""Offline wrapper around the pinned, unchanged 013 exporter. No Core startup."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

SOURCE_COMMIT = '2d04264a3f4ba6d38f76a99ae76821cc0a55abdb'
UI_BASE_COMMIT = 'aeeceb9be390ec3a1c8d0f0711f4f63a66aa2f73'
SOURCE_BLOBS = {
    "EVIDENCE.json": "02deb9b71a8fda0c68e5d9e642903e2182b947b8",
    "README.md": "fa3c98ede92d1f557952dfb6891b0450ce7f9e0d",
    "TRACE.json.gz": "b96b11ce9938703192ba1ebe18430638d89daadf",
    "VIEW-CONTRACT.md": "47f68e33651356d4a848d3ab5550be7b51f3cb2d",
    "VIEWS.json": "696a8c8955766ee550bafa80be10a66e48be02c5",
    "config.py": "adb8af970597534f012f125325f9094cbdf20e71",
    "export_view.py": "0099d96fb7526cba3778c702e626f9a3a2a49a51",
    "personnel.py": "66c7082330f135add8673de3f449da6f84968d91",
    "view.py": "c35db699d8ef6feda1b6a2e9b9eec406857f12bc"
}

def verify(source):
    hashes = {}
    for name, expected in SOURCE_BLOBS.items():
        raw = (source/name).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        if actual != expected: raise ValueError('Pinned source mismatch: ' + name)
        hashes[name] = {'gitBlob': actual, 'sha256': hashlib.sha256(raw).hexdigest()}
    return hashes

def extract(source):
    hashes = verify(source)
    # All imports are pinned above. -B prevents writing __pycache__ in 013.
    env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'}
    def read(kind, label):
        return json.loads(subprocess.check_output([sys.executable, '-B', str(source/'export_view.py'), kind, label], env=env))
    views = json.loads((source/'VIEWS.json').read_bytes())
    evidence = json.loads((source/'EVIDENCE.json').read_bytes())
    if len(views) != 18 or len({r['label'] for r in views}) != 18: raise ValueError('Expected 18 distinct original samples')
    by_label = {r['label']: r['view'] for r in views}
    checkpoints = {'initial': None, 'imported': 'T7_pool_assumption_imported', 'accepted': 'T7_accepted_waiting',
                   'preE7': None, 'E7': 'E7_received_T8_available', 'T8': 'T8_German_recovery_success', 'noApplicationT8': None}
    records = []
    for checkpoint, sample in checkpoints.items():
        view = read('--checkpoint', checkpoint)
        if sample and view != by_label[sample]: raise ValueError('Checkpoint/sample mismatch: ' + checkpoint)
        records.append({'id': 'checkpoint:'+checkpoint, 'kind': 'CHECKPOINT', 'label': checkpoint,
                        'sourceLabel': checkpoint, 'checkpoint': checkpoint, 'view': view})
    # Keep all 18, including the four REAL samples duplicated by checkpoint exports.
    for sample in views:
        view = read('--sample', sample['label'])
        if view != sample['view']: raise ValueError('Sample mismatch: ' + sample['label'])
        records.append({'id': 'sample:'+sample['label'], 'kind': 'VIEWS_SAMPLE', 'label': sample['label'],
                        'sourceLabel': sample['label'], 'checkpoint': None, 'view': view})
    if records[5]['view'] != evidence['final']: raise ValueError('Final evidence mismatch')
    if any(r['view']['schema'] != 'industry-013-personnel-view.v1' for r in records): raise ValueError('Unknown schema')
    if verify(source) != hashes: raise ValueError('Source changed during export')
    return {'sourceCommit': SOURCE_COMMIT, 'uiBaseCommit': UI_BASE_COMMIT, 'schema': 'industry-013-personnel-view.v1',
            'extraction': 'Original export_view.py: 7 checkpoints and all 18 original VIEWS samples; no Core startup',
            'sources': hashes, 'evidenceSummary': {k: evidence[k] for k in
                ('status', 'traceSha256', 'viewsSha256', 'singleProcessOnly', 'crashPersistence', 'globalBlockersRetained', 'globalBlockersClosed')},
            'evidenceCases': [{k: c[k] for k in ('name','origin','passed')} for c in evidence['cases']], 'records': records}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path, help='Pinned experiments/industry-integrate-013 directory')
    parser.add_argument('--check', action='store_true', help='Compare with saved static module without writing')
    args = parser.parse_args()
    data = extract(args.source.resolve())
    text = '// Generated offline by extract-013.py; unchanged v1 views and source labels.\nexport const RECORDS_013 = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
    dest = Path(__file__).parent/'records-013.mjs'
    if args.check:
        if dest.read_text(encoding='utf-8') != text: raise ValueError('Static data differs from pinned exports')
    else:
        dest.write_text(text, encoding='utf-8', newline='\n')
    print(json.dumps({'sourceCommit': SOURCE_COMMIT, 'uiBaseCommit': UI_BASE_COMMIT, 'verifiedSourceFiles': len(data['sources']),
                      'checkpoints': 7, 'originalSamples': 18, 'records': len(data['records']), 'checkOnly': args.check}))

if __name__ == '__main__': main()

