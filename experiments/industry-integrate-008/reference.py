"""Independent unchanged original live.execute control; targeted commands only."""
import os,sys,json
from pathlib import Path
os.environ['OPENBLAS_NUM_THREADS']='1'
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'.runtime/base6/experiments/industry-integrate-006/.runtime/live/experiments/supply-exp-005'))
def main():
    sys.stdin.reconfigure(encoding='utf8');sys.stdout.reconfigure(encoding='utf8')
    import live,bounded
    bounded.warm_start()
    payload=json.load(sys.stdin);bundle=json.loads(payload['bundleJSON']);states=[]
    for command in payload['commands']:
        result=live.execute(bundle,command)
        assert result['ok'],result
        bundle=result['state'];states.append(json.dumps(bundle,ensure_ascii=False))
    json.dump(dict(states=states,final=json.dumps(bundle,ensure_ascii=False)),sys.stdout,ensure_ascii=False)
if __name__=='__main__':main()
