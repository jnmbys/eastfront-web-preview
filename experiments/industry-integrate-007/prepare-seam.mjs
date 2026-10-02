import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const here=new URL('./',import.meta.url);
const original=new URL('./.runtime/base/experiments/industry-integrate-006/.runtime/live/experiments/supply-exp-005/',here);
const target=new URL('./.runtime/pe-live/',here);
fs.cpSync(original,target,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const changes=[];
function edit(name,transform){
  const before=fs.readFileSync(new URL(name,original),'utf8');
  const after=transform(before);
  assert.notEqual(before,after);
  fs.writeFileSync(new URL(name,target),after);
  let compiledSha256=null;
  if(name.endsWith('.ts')) {
    const js=stripTypeScriptTypes(after,{mode:'transform'});compiledSha256=sha(js);
    fs.writeFileSync(new URL(name.replace('core/src/','core/dist/').replace(/\.ts$/,'.js'),target),js);
  }
  changes.push({path:name,beforeSha256:sha(before),afterSha256:sha(after),compiledSha256});
}
function replace(s,from,to){assert.equal(s.split(from).length,2,'SEAM_ANCHOR_DRIFT');return s.replace(from,to);}
edit('core/src/rules/recovery.ts',s=>s+`
/** 007 isolated PE effect: eligibility stays in the engine; material debit is root-owned. */
export function applyPERecoveryAction(state:GameState,action:RepairUnitAction):void {
  const unit=state.units[action.unitId]!;
  unit.step=(unit.step-1) as UnitState['step'];
}
`);
edit('core/src/engine/RulesEngine.ts',s=>{
  s=replace(s,'import { applyRecoveryAction, validateRecoveryAction }','import { applyRecoveryAction, applyPERecoveryAction, validateRecoveryAction }');
  s=replace(s,'constructor(public readonly rules:GameRules, public readonly scenario:ScenarioConfig) {}',
    "constructor(public readonly rules:GameRules, public readonly scenario:ScenarioConfig, private readonly recoveryPaymentMode:'RP'|'PE'='RP') {}");
  s=replace(s,'issues=validateRecoveryAction(next,this.rules,this.scenario,action);',
    `issues=validateRecoveryAction(next,this.rules,this.scenario,action);
        if (this.recoveryPaymentMode==='PE') issues=issues.filter(issue=>!(issue.code==='INVALID_SUPPORT'&&issue.details?.reason==='INSUFFICIENT_RP'));`);
  return replace(s,'applyRecoveryAction(next,this.rules,action);',
    "if (this.recoveryPaymentMode==='PE') applyPERecoveryAction(next,action);\n        else applyRecoveryAction(next,this.rules,action);");
});
edit('core-bridge.mjs',s=>replace(s,'new c.RulesEngine(rules,scenario)',
  "new c.RulesEngine(rules,scenario,process.env.INDUSTRY007_PAYMENT_MODE==='PE'?'PE':'RP')"));
// Reviewable patch contains only the three explicitly derived sources, never logs or prices.
const paths=changes.map(c=>c.path);
const script=`import difflib,json,pathlib,sys\na,b=map(pathlib.Path,sys.argv[1:3])\nprint(''.join(''.join(difflib.unified_diff((a/n).read_text().splitlines(True),(b/n).read_text().splitlines(True),fromfile='a/'+n,tofile='b/'+n)) for n in json.loads(sys.argv[3])),end='')`;
const {fileURLToPath}=await import('node:url');
const patch=execFileSync(process.env.INDUSTRY_PYTHON??'python',['-c',script,fileURLToPath(original),fileURLToPath(target),JSON.stringify(paths)]).toString('utf8').replace(/\r\n/g,'\n');
fs.writeFileSync(new URL('PE-SEAM.patch',here),patch);
fs.writeFileSync(new URL('SEAM-HASHES.json',here),JSON.stringify({runtime:'813b4072568352e95d0726fe5fe04060c889c554',changes,patchSha256:sha(patch)},null,2)+'\n');
// Trace the owner/queue extension against 006 without modifying the fixed file.
const adapterScript=`import difflib,pathlib,sys\na,b=map(pathlib.Path,sys.argv[1:3])\nprint(''.join(difflib.unified_diff(a.read_text().splitlines(True),b.read_text().splitlines(True),fromfile='006/adapter.mjs',tofile='007/adapter.mjs')),end='')`;
const adapterPatch=execFileSync(process.env.INDUSTRY_PYTHON??'python',['-c',adapterScript,
  fileURLToPath(new URL('./.runtime/base/experiments/industry-integrate-006/adapter.mjs',here)),fileURLToPath(new URL('adapter.mjs',here))]).toString('utf8').replace(/\r\n/g,'\n');
fs.writeFileSync(new URL('ADAPTER-FROM-006.patch',here),adapterPatch);
