"""Read saved verified evidence only. No engine startup or mutation endpoints."""
import argparse,gzip,json
from config import HERE,sha,serialized
from view import export_view
def main():
    p=argparse.ArgumentParser();group=p.add_mutually_exclusive_group()
    group.add_argument('--checkpoint',choices=['initial','funded','accepted','E5','E6','T7'],default=None)
    group.add_argument('--sample',help='Exact label from VIEWS.json (synthetic origins retained)')
    a=p.parse_args();e=json.loads((HERE/'EVIDENCE.json').read_bytes())
    if a.sample:
        views=json.loads((HERE/'VIEWS.json').read_bytes());assert sha(serialized(views).encode())==e['viewsSha256']
        matches=[x['view'] for x in views if x['label']==a.sample]
        if len(matches)!=1:p.error('unknown sample label')
        result=matches[0]
    else:
        raw=gzip.decompress((HERE/'TRACE.json.gz').read_bytes());assert sha(raw)==e['traceSha256']
        result=export_view(json.loads(raw)[a.checkpoint or 'T7'])
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
