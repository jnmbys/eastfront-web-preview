"""Verify the committed public geometry against the pinned 018 trace; never export a unit root."""
import argparse,gzip,hashlib,json
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--backend',type=Path,required=True);a=p.parse_args()
here=Path(__file__).resolve().parents[1]
data=json.loads((here/'map-data.json').read_bytes());raw=(a.backend/'TRACE.json.gz').read_bytes()
assert hashlib.sha256(raw).hexdigest()==data['source']['sha256']
t=json.loads(gzip.decompress(raw));initial=t['initial']['root']['bundle']['core'];final=t['final']['root']['bundle']['core']
assert data['hexes']==[{'coord':h['coord'],'terrain':h['terrain']} for h in initial['hexes'].values()]
assert data['edges']==list(initial['edges'].values())
assert initial['hexes']==final['hexes'] and initial['edges']==final['edges']
assert initial['units']['G-I-01']['hex']==final['units']['G-I-01']['hex']==data['target']['hex']=={'q':2,'r':8}
assert data['counters']==[] and len(data['hexes'])==640 and len(data['edges'])==257
print('PASS: 640 terrain cells, 257 edges, fixed C10 target position; no runtime map mutation.')
