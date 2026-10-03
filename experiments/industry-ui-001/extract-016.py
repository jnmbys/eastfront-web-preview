"""Offline reading only: original view.export_view, TRACE, LEDGER and saved views. No experiment replay."""
import argparse
import gzip
import hashlib
import importlib
import json
import sys
from pathlib import Path

SOURCE_COMMIT = '15e4d13fa9423ddb474432719468a8a8409823e9'
UI_BASE_COMMIT = '1519ab5138acbca7f5c3ee9f1e8f3e9ab84bc59d'
SOURCE_BLOBS = {
    "LEDGER.json": "f490db1a1b0e5d3d291ed354dc8796d5d1d843f6",
    "README.md": "9792b1df31cce70d3498604f13d5ec4d0e371dab",
    "RUN.json": "fe437ef639805e7c75ec9fe387ea3340cc00adef",
    "SYNTHETIC-VIEWS.json": "b216dbabe4a2b28a583df74688641a5adbb1b813",
    "TRACE.json.gz": "e8ff97e4e2dc6d3431e782113477bb26c1fbdb38",
    "VERIFICATION.json": "216c4187994fb5cb4123641e62bf89e824d4dbdd",
    "VIEWS.json": "28d2bb7f9971e35347c4168e51250d0b2a9d9c47",
    "config.py": "b007c81e6d02634f9d76184957241a971c26784c",
    "report.py": "415dee782bad8be68759e596b3e45d6f120a78af",
    "view.py": "3d2be4bff4ec7abd9f6fc008a749fcdc514e9d8b"
}

def sha(b): return hashlib.sha256(b).hexdigest()
def digest(v): return sha(json.dumps(v, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode())

def verify(source):
    hashes = {}
    for name, expected in SOURCE_BLOBS.items():
        raw = (source/name).read_bytes()
        blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        if blob != expected: raise ValueError('Pinned source mismatch: ' + name)
        hashes[name] = {'gitBlob': blob, 'sha256': sha(raw)}
    return hashes

def extract(source):
    hashes = verify(source)
    # Only config declarations and the pure view projection are imported. No adapter/report/run imports.
    sys.dont_write_bytecode = True
    sys.path.insert(0, str(source))
    exporter = importlib.import_module('view').export_view
    read = lambda name: json.loads((source/name).read_bytes())
    raw = gzip.decompress((source/'TRACE.json.gz').read_bytes())
    trace, ledger, views, synthetic, run, verification = json.loads(raw), read('LEDGER.json'), read('VIEWS.json'), read('SYNTHETIC-VIEWS.json'), read('RUN.json'), read('VERIFICATION.json')
    if not sha(raw) == run['traceSha256'] == ledger['traceSha256'] == verification['traceSha256']: raise ValueError('TRACE digest mismatch')
    if digest(synthetic) != verification['syntheticViewsHash']: raise ValueError('Synthetic digest mismatch')
    if digest(trace['start']) != run['startHash'] or digest(trace['recovered']) != run['recoveredHash']: raise ValueError('Root hash mismatch')
    boundaries = [r for r in trace['records'] if r['result'].get('boundary')]
    if len(boundaries) != 1 or boundaries[0]['result']['boundary']['epoch'] != 8: raise ValueError('Expected actual E8 boundary')
    boundary = boundaries[0]
    specs = [
        ('start','T8起点','main','T8_START',trace['start'],'start'),
        ('carePaid','照管付款','main','T8_CARE_PAID',trace['care'],'carePaid'),
        ('received','E8到账 · T9开始','main','E8_ARRIVED_T9_BEGIN',boundary['afterBoundary'],None),
        ('preRecovery','T9恢复前','main','T9_RECOVERY_BEFORE',trace['preRecovery'],'received'),
        ('recovered','恢复后','main','T9_RECOVERY_AFTER',trace['recovered'],'recovered'),
        ('controlExpired','无操作 · E8到期','control','NO_OPERATION_END_E8',trace['control']['root'],'controlExpired'),
        ('unusedExpired','未恢复 · E9到期','unused','UNUSED_END_E9',trace['unusedEndE9']['root'],'unusedExpired')]
    origins = {'main':trace['origin'], 'control':trace['control']['origin'], 'unused':trace['unusedEndE9']['origin']}
    records = []
    for key, title, branch, checkpoint, root, saved in specs:
        before = digest(root)
        view = exporter(root)
        if digest(root) != before: raise ValueError('Exporter modified root')
        if saved and view != views[saved]: raise ValueError('Saved VIEWS differs: '+key)
        row = next(r for r in ledger['checkpoints'] if r['checkpoint']==checkpoint)
        if row['rootHash'] != before: raise ValueError('Ledger root mismatch')
        for field in ('rootRevision','gameRevision','materialRevision','equipmentBudget','personnelBudget','care','frontInventory','availableFrontInventory','expired'):
            if row[field] != view[field]: raise ValueError('Ledger/view mismatch: '+field)
        if row['P'] != view['materials']['P'] or row['E2'] != view['materials']['E2:L']: raise ValueError('Material ledger mismatch')
        if row['RP'] != root['bundle']['core']['rp'] or row['step'] != root['bundle']['core']['units']['G-I-01']['step']: raise ValueError('Core ledger mismatch')
        records.append({'id':key,'title':title,'branch':branch,'origin':'REAL','sourceOrigin':origins[branch],
                        'sourceLabel':checkpoint,'savedViewKey':saved,'tracePath':{'start':'start','carePaid':'care','received':'records['+str(trace['records'].index(boundary))+'].afterBoundary','preRecovery':'preRecovery','recovered':'recovered','controlExpired':'control.root','unusedExpired':'unusedEndE9.root'}[key],
                        'rootHash':before,'view':view,'ledger':row,'requestError':None})
    if len(views)!=6 or len(synthetic)!=5 or len(ledger['checkpoints'])!=7: raise ValueError('Unexpected evidence count')
    for key, item in synthetic.items():
        if not item['origin'].startswith('SYNTHETIC_'): raise ValueError('Missing synthetic provenance')
        records.append({'id':key,'title':key,'branch':'synthetic','origin':'SYNTHETIC','sourceOrigin':item['origin'],
                        'sourceLabel':key,'tracePath':None,'rootHash':None,'view':item['view'],'ledger':None,'requestError':item.get('error')})
    if ledger['capacity'] != boundary['afterBoundary']['forward']['capacity']: raise ValueError('E8 capacity mismatch')
    e9 = next(r['result']['boundary'] for r in trace['unusedEndE9']['records'] if (r['result'].get('boundary') or {}).get('epoch')==9)
    if ledger['actualE9UnusedMaintenance'] != e9['results']: raise ValueError('E9 ledger mismatch')
    receipt = trace['start']['personnel']['importReceipt']
    if verify(source) != hashes: raise ValueError('Source changed')  # original source bytes remain unchanged
    return {'schema':'industry-016-view.v1','sourceCommit':SOURCE_COMMIT,'uiBaseCommit':UI_BASE_COMMIT,'sources':hashes,
        'traceSha256':sha(raw),'sourceAssumption':{k:receipt[k] for k in ('sourceKind','actualTrainingReceipt','P','personnelI')},
        'verification':{k:verification[k] for k in ('status','singleProcess','crashDurability','globalBlockersRetained','globalBlockersClosed')},
        'checks':[{k:c[k] for k in ('name','origin','passed')} for c in verification['checks']],
        'qPerSP':ledger['qPerSP'],'records':records,
        'e8Impact':{'source':'LEDGER.unitComparison; actual E8 vs fixed 015 reference','epoch':8,
            'units':[u for u in ledger['unitComparison'] if u['id'] in ('G-I-01','G-REC-02','G-PZ-01')],
            'conservation':ledger['conservation']},
        'e9Unused':{'source':'LEDGER.actualE9UnusedMaintenance','epoch':9,'interpretation':ledger['E9Interpretation'],
            'sides':[{'side':r['side'],'units':r['units']} for r in ledger['actualE9UnusedMaintenance']]},
        'recoveryComparison':ledger['recovery']}

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',type=Path,required=True)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    source_dir=args.source.resolve()
    data=extract(source_dir)
    content='// Offline extraction only; original 016 v1 view values are unchanged.\nexport const RECORDS_016 = '+json.dumps(data,ensure_ascii=False,indent=2)+';\n'
    dest=Path(__file__).parent/'records-016.mjs'
    if args.check:
        if dest.read_text(encoding='utf-8')!=content: raise ValueError('Static module differs from pinned evidence')
    else: dest.write_text(content,encoding='utf-8',newline='\n')
    print(json.dumps({'sourceCommit':SOURCE_COMMIT,'sourceFiles':len(data['sources']),'realCheckpoints':7,'syntheticSamples':5,
        'originalChecks':len(data['checks']),'checkOnly':args.check,'experimentReplayed':False}))
