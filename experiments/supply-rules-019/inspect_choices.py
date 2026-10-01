"""Read saved legal checkpoints and legal move options; no parameter mutation."""
import sys,json,gzip
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'experiments/supply-exp-005'))
import live
def read(name):
 d=json.load(gzip.open(ROOT/'experiments/supply-exp-005/evidence'/name,'rt',encoding='utf-8'))
 assert live.hash_bundle(d['state'])==d['hash']
 return d['state']
if __name__=='__main__':
 b=read('campaign011-final/checkpoint-75.json.gz')
 r=live.execute(b,live.auto_command(b,'END_PHASE'));assert r['ok'],r.get('error');b=r['state']
 options=live.node(b['core'],b['mode'],b['logistics'],'options',side='G',unit='G-PZ-01')['options']
 print(json.dumps(options,ensure_ascii=False))
