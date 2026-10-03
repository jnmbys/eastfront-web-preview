"""Flatten private build paths for Windows; preserve original 016 Transactions bytes."""
import io,os,subprocess,sys,tarfile,json,shutil,difflib
from paths import *
ROOT=HERE.parents[1];RULE='4a351226741457f57629963bfba99736807456b1'
def git(*args):return subprocess.check_output(['git',*args],cwd=ROOT)
def main():
    OUT.mkdir(exist_ok=True);P16.mkdir(exist_ok=True);target=OUT/'base6';target.mkdir(exist_ok=True);prefix='experiments/industry-integrate-006'
    if '--reuse-base6' not in sys.argv:
        with tarfile.open(fileobj=io.BytesIO(git('archive','4ba4867862d54c3f436b7395fff3b52d38da7848',prefix))) as t:t.extractall(target,filter='data')
        env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(target),INDUSTRY_PYTHON=sys.executable)
        subprocess.run([sys.executable,str(target/prefix/'prepare.py')],env=env,check=True)
    base6=target/prefix/'.runtime'
    for p,h in json.loads((base6/'manifest.json').read_bytes())['files'].items():assert sha((base6/p).read_bytes())==h
    source=[];restored=[]
    def restore(ref,path,dest):
        raw=git('show',ref+':'+path);p=OUT/dest;p.parent.mkdir(exist_ok=True,parents=True);p.write_bytes(raw);restored.append(p)
        source.append(dict(commit=ref,path=path,destination=dest,sha256=sha(raw)));return raw
    for name in ['adapter.py','config.py','audit.py','query.mjs','view.py','APPROVAL.json','launch.json','TRACE.json.gz','RUN.json','LEDGER.json']:
        restore(BASE,'experiments/industry-integrate-016/'+name,'owner/'+name)
    restore(BASE,'experiments/industry-integrate-013/personnel.py','industry-integrate-013/personnel.py')
    for name in ['candidate.json','SOURCES.json','VALIDATION.json']:restore(RULE,'docs/rule-campaign-009/'+name,name)
    for i,item in enumerate(json.loads((OUT/'SOURCES.json').read_bytes())['inputs']):
        assert sha(restore(item['commit'],item['path'],'sources/'+str(i)+'-'+Path(item['path']).name))==item['sha256']
    for ref,exp,names in [('2d04264a3f4ba6d38f76a99ae76821cc0a55abdb','013',['TRACE.json.gz','EVIDENCE.json']),('9dcad639239ed7ed4081a473d78e9512cd212197','014',['PLAN.json.gz']),('fef6d57f8169fe981d3d13b16774b2503eb6dd9e','015',['RESULT.json.gz'])]:
        for n in names:restore(ref,'experiments/industry-integrate-'+exp+'/'+n,exp+'-'+n)
    shutil.copytree(base6/'live/experiments/supply-exp-005',OUT/'live',dirs_exist_ok=True)
    pe='bad006249b81d07c6f63f8df4010ce4fcec51871';patch=restore(pe,'experiments/industry-integrate-007/PE-SEAM.patch','PE-SEAM.patch')
    subprocess.run(['git','apply','--directory=experiments/industry-integrate-017/.runtime/live','-'],input=patch,cwd=ROOT,check=True)
    subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import {stripTypeScriptTypes} from 'node:module';const d=process.argv[1];for(const n of ['rules/recovery','engine/RulesEngine'])fs.writeFileSync(d+'/core/dist/'+n+'.js',stripTypeScriptTypes(fs.readFileSync(d+'/core/src/'+n+'.ts','utf8'),{mode:'transform'}));",str(OUT/'live')],check=True)
    pinned=json.loads(git('show',pe+':experiments/industry-integrate-007/SEAM-HASHES.json'));assert sha(patch)==pinned['patchSha256']
    for c in pinned['changes']:
        assert sha((OUT/'live'/c['path']).read_bytes())==c['afterSha256']
        if c['compiledSha256']:assert sha((OUT/'live'/c['path'].replace('core/src/','core/dist/').replace('.ts','.js')).read_bytes())==c['compiledSha256']
    for n,d in [('experiment.py','reference009.py'),('solver_audit.py','solver_audit.py')]:restore('b5bc3e6f4400c6a91152d9170e420aa31dc51dcb','experiments/industry-integrate-009/'+n,'audit/'+d)
    before=(P16/'query.mjs').read_text(encoding='utf8');assert before.count('./.runtime/base6/')==3
    after=before.replace('./.runtime/base6/','../base6/');(P16/'query.mjs').write_bytes(after.encode())
    (HERE/'QUERY-PATH.patch').write_bytes(''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/query.mjs',tofile='b/query.mjs')).encode())
    for name in ['FORWARD-DEPENDENCIES.md','UI004-VALIDATION.json']:restore(UI,'experiments/industry-ui-001/'+name,'UI004-'+name)
    files={str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for p in restored}
    for folder in ['base6','live']:
        files.update({str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for p in (OUT/folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts})
    (P16/'INPUTS.json').write_bytes((json.dumps(dict(files=files),indent=2)+'\n').encode())
    files['owner/INPUTS.json']=sha((P16/'INPUTS.json').read_bytes())
    manifest=dict(base016=BASE,ui004=UI,source=source,runtimeFiles=files,transactionsUnchanged=True,relocatedConfigConstants=['OUT','LIVE','BASE6'],queryImportsOnly=dict(before=sha(before.encode()),after=sha(after.encode())))
    (HERE/'INPUTS.json').write_bytes((json.dumps(manifest,indent=2)+'\n').encode())
    load_adapter().load();print('017_PREPARED_UNCHANGED_016_OWNER_NO_REPLAY')
if __name__=='__main__':main()
