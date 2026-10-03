"""Read saved verified evidence only; no engine startup, grants or writes."""
import argparse,gzip,json
from config import HERE,sha,serialized
from view import export_view

def main():
    p=argparse.ArgumentParser();g=p.add_mutually_exclusive_group()
    g.add_argument('--checkpoint',choices=['initial','imported','accepted','preE7','E7','T8','noApplicationT8'])
    g.add_argument('--sample',help='Exact VIEWS.json label; synthetic origin is preserved')
    a=p.parse_args();e=json.loads((HERE/'EVIDENCE.json').read_bytes())
    if a.sample:
        views=json.loads((HERE/'VIEWS.json').read_bytes());assert sha(serialized(views).encode())==e['viewsSha256']
        matches=[x['view'] for x in views if x['label']==a.sample]
        if len(matches)!=1:p.error('unknown sample label')
        result=matches[0]
    else:
        raw=gzip.decompress((HERE/'TRACE.json.gz').read_bytes());assert sha(raw)==e['traceSha256']
        result=export_view(json.loads(raw)[a.checkpoint or 'T8'])
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
