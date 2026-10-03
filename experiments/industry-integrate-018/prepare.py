"""Restore pinned implementations privately; emit every namespace/path/constructor seam."""
import os,sys,json,subprocess,shutil,hashlib,difflib,argparse,tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[1];OUT=HERE/'.runtime'
REFS={'012':'e64c0e11fb16b05cfe725240193e8590b4eefd88','013':'2d04264a3f4ba6d38f76a99ae76821cc0a55abdb','016':'15e4d13fa9423ddb474432719468a8a8409823e9','017':'afdde93c8b7bbbc5c5974f11e18bd275324e88a7','UI005':'5dc9e51c090a3c9b269e9bb0e7c54afbc3465289'}
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--runtime-source',type=Path);args=parser.parse_args()
    manifest=json.loads(git('show',REFS['017']+':experiments/industry-integrate-017/INPUTS.json'))
    src=args.runtime_source;temporary=None
    if src is None:
        # A short private build path avoids Windows' legacy archive path limit.
        temporary=tempfile.TemporaryDirectory(prefix='i18-',dir=Path.home())
        seed=Path(temporary.name).resolve()
        assert seed.parent==Path.home().resolve() and seed.name.startswith('i18-')
        prefix='experiments/industry-integrate-017';dest=seed/prefix;dest.mkdir(parents=True,exist_ok=True)
        for p in git('ls-tree','-r','--name-only',REFS['017'],prefix).decode().splitlines():
            if '/' in p[len(prefix)+1:]:continue
            (dest/Path(p).name).write_bytes(git('show',REFS['017']+':'+p))
        env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(seed))
        subprocess.run([sys.executable,str(dest/'prepare.py')],env=env,check=True);src=dest/'.runtime'
    OUT.mkdir(exist_ok=True)
    for p,h in manifest['runtimeFiles'].items():
        raw=(src/p).read_bytes();assert sha(raw)==h,('ORIGINAL_RUNTIME_HASH',p)
        target=OUT/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
    if temporary:temporary.cleanup()
    files=dict(manifest['runtimeFiles']);sources=[];patches=[]
    def restore(ref,path,dest,transform=lambda s:s):
        raw=git('show',ref+':'+path);after=transform(raw.decode()).encode() if path.endswith(('.py','.mjs')) else raw
        target=OUT/dest;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(after);files[dest]=sha(after)
        sources.append(dict(commit=ref,path=path,destination=dest,originalSha256=sha(raw),preparedSha256=sha(after)))
        if raw!=after:patches.append(''.join(difflib.unified_diff(raw.decode().splitlines(True),after.decode().splitlines(True),fromfile=path,tofile=dest,n=0)))
    def transform(n,name,s):
        if name=='adapter.py':s=s.replace('deadline=began+3;',"deadline=min(began+3,getattr(self,'_outer_deadline',began+3));")
        s=s.replace('from config import','from .config import').replace('from audit import','from .audit import').replace('from view import','from .view import')
        s=s.replace('import production\n','from . import production\n').replace('import personnel\n','from . import personnel\n')
        s=s.replace('./.runtime/base6/','../base6/')
        if n=='013' and name=='adapter.py':
            s=s.replace("def __init__(self,instance_id='013-main',", "def __init__(self,current_root,instance_id='013-main',")
            s=s.replace('base=start_root();','base=deepcopy(current_root);assert digest(base)==START_SHA;')
            s=s.replace("            assert match not in _MATCH_OWNERS,'MATCH_ALREADY_HAS_OWNER_NO_REIMPORT_BY_INSTANCE_RENAME'\n",'')
            s=s.replace('            _MATCH_OWNERS[match]=self\n','')
        if n=='016' and name=='adapter.py':
            s=s.replace('def __init__(self,*,test_label=None):','def __init__(self,current_root,*,test_label=None):')
            s=s.replace("self.base=deepcopy(self.config['root'])","self.base=deepcopy(current_root);assert digest(self.base)==START_SHA")
            s=s.replace("            assert key not in OWNERS,'SAME_MATCH_ALREADY_OWNED_NO_REIMPORT'\n",'').replace('            OWNERS.add(key);','            ')
            start="            import importlib.util\n            spec=importlib.util.spec_from_file_location('old_personnel013',HERE.parent/'industry-integrate-013/personnel.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)"
            assert start in s;s=s.replace(start,'            from stage013 import personnel as mod')
        return s
    for n,names in {'012':['adapter.py','config.py','production.py','view.py','eligibility.mjs','APPROVAL.json','launch.json','TRACE.json.gz','EVIDENCE.json'],
                    '013':['adapter.py','config.py','personnel.py','view.py','eligibility.mjs','next-action.mjs','APPROVAL.json','launch.json','TRACE.json.gz','EVIDENCE.json'],
                    '016':['adapter.py','config.py','audit.py','view.py','query.mjs','APPROVAL.json','launch.json','TRACE.json.gz','RUN.json']}.items():
        package='stage'+n;(OUT/package).mkdir(exist_ok=True);(OUT/package/'__init__.py').write_bytes(b'');files[package+'/__init__.py']=sha(b'')
        for name in names:restore(REFS[n],'experiments/industry-integrate-'+n+'/'+name,package+'/'+name,lambda s,n=n,name=name:transform(n,name,s))
    for n,ref in [('012','90758efccda736e3524348d8876b892be3d7938f'),('013','b3c18fa6daf0cf7409e0821918e7ffdd1dac4a51')]:
        restore(ref,'docs/rule-campaign-00'+('7' if n=='012' else '8')+'/candidate.json','stage'+n+'/.runtime/candidate.json')
    # Original config validation still reads the pinned reference evidence, never as new state.
    for srcname,dst in [('stage012/TRACE.json.gz','stage013/.runtime/012-TRACE.json.gz'),('stage012/EVIDENCE.json','stage013/.runtime/012-EVIDENCE.json'),('owner/INPUTS.json','stage016/INPUTS.json')]:
        (OUT/dst).parent.mkdir(parents=True,exist_ok=True);(OUT/dst).write_bytes((OUT/srcname).read_bytes());files[dst]=sha((OUT/dst).read_bytes())
    for name in ['LOCAL-TRANSACTIONS.md','backend-017-lock.json']:restore(REFS['UI005'],'experiments/industry-ui-001/'+name,'UI005-'+name)
    (OUT/'compat017').mkdir(exist_ok=True);(OUT/'compat017/__init__.py').write_bytes(b'');files['compat017/__init__.py']=sha(b'')
    for name in ['bridge.py','paths.py','local_http.py','app.mjs','styles.css','index.html']:
        restore(REFS['017'],'experiments/industry-integrate-017/'+name,'compat017/'+name,
            lambda s:s.replace('from paths import','from .paths import').replace('from bridge import','from .bridge import'))
    (HERE/'SEAMS.patch').write_text('\n'.join(patches),encoding='utf-8',newline='\n')
    (HERE/'INPUTS.json').write_text(json.dumps(dict(refs=REFS,sources=sources,runtimeFiles=files),indent=2)+'\n',encoding='utf-8',newline='\n')
    print('018_PINNED_RUNTIME_READY_NO_CAMPAIGN_REPLAY')
if __name__=='__main__':main()
