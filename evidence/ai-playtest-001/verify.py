from pathlib import Path
import hashlib,json,gzip,subprocess
root=Path(__file__).resolve().parents[2];out=root/'evidence/ai-playtest-001'
base='06b364195bce7ea8ae1cb3ee0b80925cf36d4360'
def git(*args):return subprocess.check_output(['git',*args],cwd=root)
protected=[]
for row in git('ls-tree','-r',base).decode().splitlines():
 meta,path=row.split('\t',1);sha=meta.split()[2]
 if not path.startswith(('ai/fair/','ai/authority/','ai/local/LocalMatch','ai/local/worker','ai/local/scenarios','src/player-view/','src/core-adapter/','vendor/','server/')):continue
 p=root/path
 if not p.is_file():continue
 b=p.read_bytes();actual=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest();assert actual==sha,(path,sha,actual)
 protected.append({'path':path,'gitBlob':sha})
artifacts=[]
for p in sorted(out.glob('*.gz')):
 raw=gzip.decompress(p.read_bytes());expected=p.with_suffix('')
 if expected.exists():assert raw==expected.read_bytes()
 json.loads(raw) if p.name.endswith('.json.gz') else [json.loads(x) for x in raw.splitlines()]
 artifacts.append({'path':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'expandedBytes':len(raw),'expandedSha256':hashlib.sha256(raw).hexdigest()})
report={'sourceBase':base,'strategyHostCoreRulesRngUnchanged':True,'protectedFiles':protected,'artifactRoundTrips':artifacts,'games':[]}
for side in ['GERMAN','SOVIET']:
 r=json.loads((out/(side+'.record.json')).read_text());replay=json.loads(gzip.decompress((out/(side+'.replay.json.gz')).read_bytes()))
 end=replay['end']
 assert r['status']=='GAME_OVER' and r['replay'] and end['turn']==16 and end['phase']=='GAME_OVER'
 report['games'].append({'humanSide':side,'terminal':r['status'],'accepted':r['accepted'],'rejected':r['rejected'],'replay':r['replay'],'maxPhaseMs':max(x['ms'] for x in r['phases']),'maxActionMs':max(x['maxActionMs'] for x in r['phases']),'limitations':'Unmoved units or unused resources alone do not prove a strategy/process defect; no new causal strategy audit.'})
(out/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'protectedFiles':len(protected),'gzipArtifacts':len(artifacts),'games':report['games']}))
