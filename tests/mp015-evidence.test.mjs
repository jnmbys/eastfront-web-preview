import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {reserveEvidence,writeNew} from '../scripts/mp015/evidence.mjs';
function fixture(){
  const root=resolve('.mp010-build/mp015-tests');mkdirSync(root,{recursive:true});
  const ws=mkdtempSync(join(root,'fixture-')),run=join(ws,'.mp010-build/mp014/run-20261003T120000-1234abcd');
  mkdirSync(run,{recursive:true});mkdirSync(join(ws,'evidence/mp-014-public'),{recursive:true});
  writeFileSync(join(ws,'evidence/mp-014-public/anonymous-probes.json'),'OLD-EVIDENCE');return {ws,run};
}
test('MP015 stores a run only under its new evidence root and keeps old records unchanged',()=>{
  const {ws,run}=fixture(),out=reserveEvidence(run,ws);
  assert.equal(out,join(ws,'evidence/mp-015/run-20261003T120000-1234abcd'));
  writeNew(out,'anonymous-probes.json','NEW-EVIDENCE');
  assert.equal(readFileSync(join(ws,'evidence/mp-014-public/anonymous-probes.json'),'utf8'),'OLD-EVIDENCE');
});
test('MP015 rejects a repeated reservation and refuses to overwrite a result file',()=>{
  const {ws,run}=fixture(),out=reserveEvidence(run,ws);writeNew(out,'anonymous-probes.json','FIRST');
  assert.throws(()=>reserveEvidence(run,ws),{code:'EEXIST'});assert.throws(()=>writeNew(out,'anonymous-probes.json','SECOND'),{code:'EEXIST'});
  assert.equal(readFileSync(join(out,'anonymous-probes.json'),'utf8'),'FIRST');
});
test('MP015 rejects old evidence paths, traversal and invalid lifecycle names before writing',()=>{
  const {ws,run}=fixture();
  for(const invalid of [join(ws,'evidence/mp-014-public'),join(ws,'.mp010-build/mp014/../outside'),join(ws,'.mp010-build/mp014/arbitrary')])assert.throws(()=>reserveEvidence(invalid,ws));
  assert.equal(existsSync(join(ws,'evidence/mp-015')),false);
  const out=reserveEvidence(run,ws);assert.throws(()=>writeNew(out,'../mp-014-public/anonymous-probes.json','BAD'));
});
