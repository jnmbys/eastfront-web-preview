import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {bytesHash,snapshotHash,freeze,gate} from './bindings.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=n=>fs.readFileSync(path.join(here,n));
export const CANDIDATE_SHA='a80e32622ea28dc01472ca75a7c9d6ccb8cb9b03eed50e293a45f31fd4087038';
const candidateBytes=read('.runtime/rule/candidate.json');
assert.equal(bytesHash(candidateBytes),CANDIDATE_SHA);
export const candidate=freeze(JSON.parse(candidateBytes));
const ruleValidation=JSON.parse(read('.runtime/rule/VALIDATION.json'));
export const manifestHash=snapshotHash(candidate.initialManifest);
assert.equal(manifestHash,ruleValidation.manifestValueDigest);
const blockers=JSON.parse(read('.runtime/rule/BLOCKERS.json'));
assert.deepEqual(blockers.rows.map(r=>r.blocker),gate.blockers);
const localBlockers=blockers.rows.filter(r=>r.sliceDisposition==='PROPOSED_FOR_REVIEW_NOT_RESOLVED').map(r=>r.blocker);
const trusted=new WeakSet();

/** Host-only startup API, never request fields. Local files are the explicit trust boundary. */
export function loadLaunch(configFile=path.join(here,'launch.json')) {
  const errors=[];let approval=null,approvalHash=null;
  try {
    const cfg=JSON.parse(fs.readFileSync(configFile));
    assert.deepEqual(Object.keys(cfg).sort(),['approvalFile','candidateFile']);
    const location=path.dirname(path.resolve(configFile));
    const bytes=fs.readFileSync(path.resolve(location,cfg.candidateFile));
    assert.equal(bytesHash(bytes),CANDIDATE_SHA,'CANDIDATE_HASH_MISMATCH');
    const raw=fs.readFileSync(path.resolve(location,cfg.approvalFile));
    approval=JSON.parse(raw);approvalHash=bytesHash(raw);
    assert.equal(approval.decisionRef,'LEADER-RULE-CAMPAIGN-004-20261002');
    assert.equal(approval.ruleCommit,'24afa379ad98b8a62470f79bd65a210fd0df61ce');
    assert.equal(approval.candidateSha256,CANDIDATE_SHA);
    assert.equal(approval.candidateValueDigest,snapshotHash(candidate));
    assert.equal(approval.manifestValueDigest,manifestHash);
    assert.equal(approval.experimentId,candidate.scope.experimentId);
    assert.equal(approval.baseSnapshotSha256,candidate.checkpoint.serializedSnapshotSha256);
    assert.equal(approval.grantProposalId,candidate.service.proposalId);
    assert.equal(approval.scope,candidate.scope.instanceScope);
    assert.deepEqual(approval.approvedLocalBlockers,localBlockers);
    assert.equal(approval.globalBlockersResolved,0);
    assert.equal(approval.productionRuntimeApproval,false);
  } catch(e) { errors.push('LOCAL_APPROVAL_INVALID:'+String(e)); }
  const launch=freeze({approved:errors.length===0,errors,approval,approvalHash,candidateSha256:CANDIDATE_SHA});
  trusted.add(launch);return launch;
}
export function assertLocalLaunch(launch) { assert.ok(trusted.has(launch),'UNTRUSTED_CALLER_APPROVAL'); }
export function verifyRuntime() {
  const m=JSON.parse(read('.runtime/manifest.json'));
  assert.equal(m.base,'4ba4867862d54c3f436b7395fff3b52d38da7848');
  assert.equal(m.rule,'24afa379ad98b8a62470f79bd65a210fd0df61ce');
  for(const [name,sha] of Object.entries(m.files)) assert.equal(bytesHash(read('.runtime/'+name)),sha,name);
  assert.equal(bytesHash(read('.runtime/base/experiments/industry-integrate-006/.runtime/planner/experiments/industry-integrate-005/.runtime/fixtures/CHECKPOINTS.json.gz')),candidate.checkpoint.archiveSha256);
  return m;
}
