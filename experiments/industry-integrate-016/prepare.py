"""Restore pinned inputs; derive only the already-reviewed PE seam. No replay/solve."""
import io,os,sys,subprocess,tarfile,shutil,json
from config import *
ROOT=HERE.parents[1]
def git(*a):return subprocess.check_output(['git',*a],cwd=ROOT)
def main():
    OUT.mkdir(exist_ok=True);target=OUT/'base6';target.mkdir(exist_ok=True);prefix='experiments/industry-integrate-006'
    if '--check-existing' not in sys.argv:
        with tarfile.open(fileobj=io.BytesIO(git('archive','4ba4867862d54c3f436b7395fff3b52d38da7848',prefix))) as tf:tf.extractall(target,filter='data')
        env=dict(os.environ,GIT_DIR=git('rev-parse','--absolute-git-dir').decode().strip(),GIT_WORK_TREE=str(target),INDUSTRY_PYTHON=sys.executable)
        subprocess.run([sys.executable,str(target/prefix/'prepare.py')],env=env,check=True)
    for p,h in json.loads((BASE6/'manifest.json').read_bytes())['files'].items():assert sha((BASE6/p).read_bytes())==h,p
    inputs=[]
    def restore(ref,path,dest):
        b=git('show',ref+':'+path);(OUT/dest).parent.mkdir(parents=True,exist_ok=True);(OUT/dest).write_bytes(b)
        inputs.append(dict(commit=ref,path=path,destination=dest,sha256=sha(b)));return b
    for n in ['candidate.json','SOURCES.json','VALIDATION.json']:
        restore(RULE,'docs/rule-campaign-009/'+n,n)
    sources=read('SOURCES.json')
    for i,item in enumerate(sources['inputs']):
        raw=restore(item['commit'],item['path'],'sources/'+str(i)+'-'+Path(item['path']).name)
        assert sha(raw)==item['sha256'],item
    for ref,exp,names in [(BASE,'013',['TRACE.json.gz','EVIDENCE.json']),('9dcad639239ed7ed4081a473d78e9512cd212197','014',['PLAN.json.gz']),(FIXED,'015',['RESULT.json.gz'])]:
        for n in names:restore(ref,'experiments/industry-integrate-'+exp+'/'+n,exp+'-'+n)
    shutil.copytree(BASE6/'live/experiments/supply-exp-005',LIVE,dirs_exist_ok=True)
    pe='bad006249b81d07c6f63f8df4010ce4fcec51871'
    patch=restore(pe,'experiments/industry-integrate-007/PE-SEAM.patch','PE-SEAM.patch')
    subprocess.run(['git','apply','--directory=experiments/industry-integrate-016/.runtime/live','-'],input=patch,cwd=ROOT,check=True)
    subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import {stripTypeScriptTypes} from 'node:module';const d=process.argv[1];for(const n of ['rules/recovery','engine/RulesEngine'])fs.writeFileSync(d+'/core/dist/'+n+'.js',stripTypeScriptTypes(fs.readFileSync(d+'/core/src/'+n+'.ts','utf8'),{mode:'transform'}));",str(LIVE)],check=True)
    pinned=json.loads(git('show',pe+':experiments/industry-integrate-007/SEAM-HASHES.json'))
    assert sha(patch)==pinned['patchSha256']
    for c in pinned['changes']:
        assert sha((LIVE/c['path']).read_bytes())==c['afterSha256']
        if c['compiledSha256']:assert sha((LIVE/c['path'].replace('core/src/','core/dist/').replace('.ts','.js')).read_bytes())==c['compiledSha256']
    (HERE/'PE-SEAM.patch').write_bytes(patch);(HERE/'PE-SEAM-HASHES.json').write_bytes((json.dumps(pinned,indent=2)+'\n').encode())
    for n,d in [('experiment.py','reference009.py'),('solver_audit.py','solver_audit.py')]:
        restore('b5bc3e6f4400c6a91152d9170e420aa31dc51dcb','experiments/industry-integrate-009/'+n,'audit/'+d)
    root=start_root()
    approval=dict(task='INDUSTRY-INTEGRATE-016',authority='Explicit Leader approval in user task; trusted local startup only',
        scope='ONE_SINGLE_PROCESS_INSTANCE_T8_CARE_E8_FIXED015_FREIGHT_T9_PE_E9_CLOSURE',ruleCommit=RULE,fixed015Commit=FIXED,base013Commit=BASE,
        rootHash=START_SHA,candidateSha256=sha((OUT/'candidate.json').read_bytes()),permanentP=root['personnel']['package']['id'],permanentE2=root['industry']['batch']['id'],
        careI=1,careDeadlineEndEpoch=9,route=['A10','B10','C10'],nullControlExceptionKeys=['0,9','1,9','2,8'],cargo=CARGO,
        target='G-I-01',controller='G-HUMAN-1',dispatchE=8,receiveE=8,availableT=9,recoveryT=9,maxShipments=1,maxRecoveries=1,
        noNewGrant=True,globalBlockersRetained=35,globalBlockersClosed=0,sourceGapSP={'G':9,'S':14},HTTP=False,crashDurability=False)
    # An explicit file generated solely from this committed preparer's fixed approval,
    # never a request, remote response, or candidate's empty approval fields.
    (HERE/'APPROVAL.json').write_bytes((json.dumps(approval,indent=2)+'\n').encode())
    (HERE/'launch.json').write_bytes((json.dumps(dict(approvalSha256=sha((HERE/'APPROVAL.json').read_bytes())),indent=2)+'\n').encode())
    files={str(p.relative_to(OUT)).replace('\\','/'):sha(p.read_bytes()) for p in OUT.rglob('*') if p.is_file() and '__pycache__' not in p.parts}
    (HERE/'INPUTS.json').write_bytes((json.dumps(dict(inputs=inputs,files=files,originalCoreUnchanged=True,settlementSeam='Owner wraps original live.logistics_transaction and model.solve for exact fixed E8 only; no model source edits'),indent=2)+'\n').encode())
    load();print('PREPARED_016_ALL_009_SOURCE_HASHES_VERIFIED_NO_REPLAY_NO_SOLVE')
if __name__=='__main__':main()
