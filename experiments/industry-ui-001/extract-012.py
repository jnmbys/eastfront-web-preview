"""Offline, pinned 012 exports only. Never starts Core or modifies source files."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

SOURCE_COMMIT = 'e64c0e11fb16b05cfe725240193e8590b4eefd88'
UI_BASE_COMMIT = '00a97635d882509675fe4d5f6e789cdbc791fdc0'
SOURCE_BLOBS = {
    'VIEW-CONTRACT.md': '8176af7c9a62f8580f7aa4894fbd5b25cd4f9912',
    'export_view.py': '70a913f4dcc41148130c0b415ef7f31be6d02164',
    'view.py': 'f1655bac70df7c12b4d5faecf5586ea556ed3cf4',
    'config.py': '5ae5e31a5a2710aa477aa872b7c3cde12ebd6d33',
    'VIEWS.json': 'e86d26133832659573dc0c1e2099225280abec4f',
    'EVIDENCE.json': '9d5b38b108abc96494e819d70ffe31e719662534',
    'TRACE.json.gz': '8119699e2942b2ecbb9f4a6e89dd73ae61e1a3f6',
    'README.md': '8cb25ade74f82a6d623d6cf011753ce3950a4750',
    'FINANCE-VERIFICATION.json': '82e96dc8885dc07a9d7c622d8bf69782bfbd9e52',
}

def verify(source):
    out = {}
    for name, expected in SOURCE_BLOBS.items():
        raw = (source / name).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        if actual != expected:
            raise ValueError('Pinned source mismatch: ' + name)
        out[name] = {'gitBlob': actual, 'sha256': hashlib.sha256(raw).hexdigest()}
    return out

def extract(source):
    hashes = verify(source)
    # -B prevents __pycache__ writes; exporter only imports config/view (verified above).
    env = {**os.environ, 'PYTHONDONTWRITEBYTECODE': '1', 'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'}
    def read(kind, label):
        return json.loads(subprocess.check_output([sys.executable, '-B', str(source/'export_view.py'), kind, label], env=env))
    views = json.loads((source/'VIEWS.json').read_bytes())
    by_label = {item['label']: item['view'] for item in views}
    evidence = json.loads((source/'EVIDENCE.json').read_bytes())
    checkpoints = {'initial': None, 'funded': None, 'accepted': 'accepted_waiting_E5',
                   'E5': 'E5_one_of_two_waiting', 'E6': 'E6_received_T7_available', 'T7': 'T7_German_recovery_success'}
    records = []
    for checkpoint, saved_label in checkpoints.items():
        view = read('--checkpoint', checkpoint)
        if view['origin'] != 'REAL' or (saved_label and view != by_label[saved_label]):
            raise ValueError('Checkpoint differs from saved view: ' + checkpoint)
        records.append({'label': checkpoint, 'sourceLabel': saved_label, 'checkpoint': checkpoint, 'view': view})
    for item in views:
        if item['view']['origin'] != 'REAL':
            view = read('--sample', item['label'])
            if view != item['view']: raise ValueError('Sample mismatch')
            records.append({'label': item['label'], 'sourceLabel': item['label'], 'checkpoint': None, 'view': view})
    if records[5]['view'] != evidence['final']: raise ValueError('Final evidence mismatch')
    if verify(source) != hashes: raise ValueError('Source changed during export')
    return {'sourceCommit': SOURCE_COMMIT, 'uiBaseCommit': UI_BASE_COMMIT, 'schema': 'industry-012-view.v1',
            'extraction': 'Original export_view.py; six --checkpoint and ten --sample reads; no Core startup',
            'sources': hashes, 'evidenceSummary': {
                'status': evidence['status'], 'traceSha256': evidence['traceSha256'], 'viewsSha256': evidence['viewsSha256'],
                'onlySingleProcessGuarantee': evidence['onlySingleProcessGuarantee'],
                'cases': [{k: c[k] for k in ('name','origin','passed')} for c in evidence['cases']]}, 'records': records}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path, help='Pinned experiments/industry-integrate-012 directory')
    parser.add_argument('--check', action='store_true', help='Verify the existing static module, without writing')
    args = parser.parse_args()
    data = extract(args.source.resolve())
    text = '// Generated offline by extract-012.py; unmodified v1 view values.\nexport const RECORDS_012 = ' + json.dumps(data, ensure_ascii=False, indent=2) + ';\n'
    dest = Path(__file__).parent/'records-012.mjs'
    if args.check:
        if dest.read_text(encoding='utf-8') != text: raise ValueError('Static data differs from pinned exports')
    else: dest.write_text(text, encoding='utf-8')
    print(json.dumps({'sourceCommit': SOURCE_COMMIT, 'uiBaseCommit': UI_BASE_COMMIT, 'verifiedSourceFiles': len(data['sources']),
                      'records': len(data['records']), 'REAL': sum(r['view']['origin']=='REAL' for r in data['records']),
                      'synthetic': sum(r['view']['origin']!='REAL' for r in data['records']), 'checkOnly': args.check}))

if __name__ == '__main__': main()
