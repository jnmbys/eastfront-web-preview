import assert from 'node:assert/strict';
import {isDeepStrictEqual} from 'node:util';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {RecoveryTransactions} from './adapter.mjs';
import {candidate,manifestHash,loadLaunch,verifyRuntime} from './config.mjs';
import {executePE} from './authority.mjs';
import {snapshotHash,bytesHash,gate,savedCheckpointJSON,loadActions,loadCheckpoints,executeOriginal} from './bindings.mjs';

const python=process.env.INDUSTRY_PYTHON??'python', launch=loadLaunch();
assert.ok(launch.approved,JSON.stringify(launch.errors));
const initialJSON=savedCheckpointJSON('german_recovery_T5'),initial=JSON.parse(initialJSON);
const checkpoints=loadCheckpoints(),actions=loadActions(),rows=[];
let index=0;
const store=options=>new RecoveryTransactions(initialJSON,{python,launch,instanceId:'007-test-'+(++index),...options});
const request=(s,id,mode='PE')=>{const b=s.snapshot(),m=s.materials();return {requestId:id,paymentMode:mode,
  unitId:'G-I-01',controllerId:'G-HUMAN-1',expectedRevision:b.revision,snapshotHash:snapshotHash(b),materialRevision:m.revision,materialHash:snapshotHash(m)};};
const full=s=>({bundleJSON:s.serializedSnapshot(),materials:s.materials()});
const counts=b=>b.core.actionLog.filter(a=>a.accepted&&a.turn===5&&a.phase==='GERMAN_RECOVERY'&&a.action.type==='REPAIR_UNIT').length;
const quantities=s=>Object.fromEntries(Object.values(s.materials().lots).map(l=>[l.material,l.quantity]));
const sp=b=>({units:b.logistics.units.map(u=>({id:u.id,stock:u.stock,debt:u.debt,B:u.B,cap:u.cap})),
  hubs:b.logistics.hubs,sources:b.logistics.sources,done:b.logistics.done,T:b.logistics.T,spent:b.logistics.action_spent});
const summary=s=>({gameRevision:s.snapshot().revision,gameHash:snapshotHash(s.snapshot()),serializedHash:bytesHash(s.serializedSnapshot()),
  materialRevision:s.materials().revision,materialHash:snapshotHash(s.materials()),step:s.snapshot().core.units['G-I-01'].step,
  RP:s.snapshot().core.rp,recoveryCount:counts(s.snapshot()),RNG:s.snapshot().core.random,SPHash:snapshotHash(sp(s.snapshot())),
  materials:s.materials(),transactionMetadata:s.metadata()});
const record=(name,s,detail={},origin='REAL_T5_TARGETED_CHECK')=>rows.push({name,origin,...summary(s),detail});
const unchanged=(s,before)=>assert.ok(isDeepStrictEqual(full(s),before),'GAME_OR_MATERIAL_CHANGED_ON_REJECTION');
const has=(plan,reason)=>plan.common.commonIssues.some(i=>i.details?.reason===reason||i.code===reason);
function assertPE(s){
  const b=s.snapshot();assert.equal(b.revision,110);assert.equal(b.core.units['G-I-01'].step,0);
  assert.deepEqual(b.core.rp,{GERMAN:8,SOVIET:12});assert.equal(counts(b),1);
  assert.equal(s.materials().revision,2);assert.deepEqual(quantities(s),{P:0,'E2:L':0});
  assert.deepEqual(b.core.random,initial.core.random);assert.deepEqual(sp(b),sp(initial));
  assert.equal(b.logistics.units.find(u=>u.id==='G-I-01').strength,3);
  assert.equal(b.core.actionLog.at(-1).action.type,'REPAIR_UNIT');assert.equal(b.core.actionLog.at(-1).accepted,true);
  assert.ok(Object.values(s.materials().lots).every(l=>l.status==='SPENT'&&l.initialQuantity>0));
  assert.equal(s.materials().imports[candidate.initialManifest.manifestId].retired,true);
}
async function imported(options){const s=store(options);assert.equal((await s.importInitial()).status,'IMPORTED');return s;}

const s=store();const beforeImport=s.serializedSnapshot();
const importedReply=await s.importInitial();assert.equal(importedReply.status,'IMPORTED');
assert.equal(s.serializedSnapshot(),beforeImport);assert.equal(s.snapshot().revision,109);
assert.equal(s.materials().revision,1);assert.deepEqual(quantities(s),{P:1,'E2:L':2});
record('initial_import_game_byte_identical',s,{reply:importedReply,manifestHash});
let before=full(s);const duplicateImport=await s.importInitial();unchanged(s,before);
assert.equal(duplicateImport.status,'ALREADY_IMPORTED_NO_CREDIT');record('duplicate_import',s,{reply:duplicateImport});
const changedManifest=structuredClone(candidate.initialManifest);changedManifest.lots[0].quantity=99;
const conflictImport=await s.importInitial(changedManifest);assert.equal(conflictImport.error.code,'MANIFEST_ID_CONFLICT');unchanged(s,before);
record('conflicting_import',s,{reply:conflictImport},'SYNTHETIC_TAMPER_REQUEST');
const peRequest=request(s,'007-pe-once');const readOnly=s.plan(peRequest);unchanged(s,before);
assert.equal(readOnly.ok,true);assert.deepEqual(readOnly.debits.map(x=>x.quantity),[1,2]);
record('read_only_material_plan',s,{plan:readOnly});
const pe=await s.submit(peRequest);assert.equal(pe.ok,true,JSON.stringify(pe));assertPE(s);
assert.equal(pe.runtimeGate.allowed,false);assert.deepEqual(pe.runtimeGate.blockers,gate.blockers);
record('PE_success',s,{reply:pe,extraSPOrRNG:false});
before=full(s);const replay=await s.submit(peRequest);unchanged(s,before);assert.equal(replay.replayed,true);
const afterSpendImport=await s.importInitial();unchanged(s,before);assert.equal(afterSpendImport.status,'ALREADY_IMPORTED_NO_CREDIT');
record('spent_tombstones_and_retries_do_not_refill',s,{replay,afterSpendImport});
const conflict=await s.submit({...peRequest,paymentMode:'RP'});assert.equal(conflict.error.code,'REQUEST_ID_CONFLICT');unchanged(s,before);
record('request_ID_conflict',s,{reply:conflict});

// Existing RP remains the complete 006/Core control, even alongside an imported ledger.
const rpStore=await imported();
const historical=actions.find(a=>a.label==='actual_RP_repair');
const direct=await executeOriginal(initialJSON,historical.command,python);assert.equal(direct.ok,true,direct.error);
const rp=await rpStore.submit(request(rpStore,historical.command.id,'RP'));assert.equal(rp.ok,true,JSON.stringify(rp));
assert.ok(isDeepStrictEqual(rpStore.snapshot(),direct.state));
assert.ok(isDeepStrictEqual(rpStore.snapshot(),checkpoints.repaired));
assert.equal(rpStore.serializedSnapshot(),savedCheckpointJSON('repaired'));
assert.deepEqual(quantities(rpStore),{P:1,'E2:L':2});
assert.ok(Object.values(rpStore.materials().lots).every(l=>l.status==='QUARANTINED'));
record('unchanged_full_RP_control_and_quarantine',rpStore,{fullOriginalAndSavedEquality:true});
for(const [label,owner,mode,execute] of [['RP_then_PE',rpStore,'PE',executePE],['PE_then_RP',s,'RP',executeOriginal]]) {
  const req=request(owner,'007-'+label,mode),saved=full(owner);
  const plan=owner.plan(req);
  assert.ok(has(plan,'UNIT_ALREADY_RECOVERED_THIS_TURN'));assert.ok(has(plan,'RECOVERY_UNIT_LIMIT_REACHED'));
  const denied=await owner.submit(req);assert.equal(denied.error.code,'RECOVERY_NOT_ELIGIBLE');unchanged(owner,saved);
  // Real engine execution rejection as well as the pure original validator, not only scope.
  const rejected=await execute(owner.serializedSnapshot(),{id:'engine-negative-'+label,revision:owner.snapshot().revision,
    action:{type:'REPAIR_UNIT',controllerId:'G-HUMAN-1',unitId:'G-I-01'}},python);
  assert.equal(rejected.ok,false);assert.ok(isDeepStrictEqual(rejected.state,owner.snapshot()));
  const issues=JSON.parse(rejected.error.slice(rejected.error.indexOf('[')));
  assert.deepEqual(issues,plan.common.recoveryIssues);
  record(label+'_shared_Core_limit',owner,{plan,reply:denied,actualEngineIssues:issues},'REAL_POST_ACTION_CORE_REJECTION');
}

for(const [label,change] of [
  ['stale_material_hash',{materialHash:'stale'}],['stale_material_revision',{materialRevision:0}],
  ['stale_game_hash',{snapshotHash:'stale'}],['caller_authorization',{verifiedLocalApproval:true}],
  ['caller_free_quote',{quotedPrice:{P:0,'E2:L':0}}],['wrong_side',{controllerId:'S-AI-1'}]]) {
  const owner=await imported(),saved=full(owner);const reply=await owner.submit({...request(owner,'007-'+label),...change});
  assert.equal(reply.ok,false);unchanged(owner,saved);record(label,owner,{reply},'SYNTHETIC_REQUEST_NEGATIVE');
}
const empty=store();const unavailable=await empty.submit(request(empty,'007-no-import'));
assert.equal(unavailable.ok,false);assert.equal(empty.materials().revision,0);assert.equal(empty.serializedSnapshot(),initialJSON);
record('PE_requires_real_initial_import',empty,{reply:unavailable});

for(const stage of ['before_import_commit','after_import_commit_before_reply']) {
  let armed=true;const owner=store({testMode:true,testFault:p=>{if(armed&&p===stage){armed=false;throw Error('SYNTHETIC:'+stage);}}});
  if(stage==='before_import_commit'){
    const saved=full(owner);const r=await owner.importInitial();assert.equal(r.ok,false);unchanged(owner,saved);
    assert.equal((await owner.importInitial()).status,'IMPORTED');
  }else{
    await assert.rejects(owner.importInitial(),/SYNTHETIC/);assert.equal((await owner.importInitial()).status,'ALREADY_IMPORTED_NO_CREDIT');
  }
  assert.equal(owner.serializedSnapshot(),initialJSON);assert.equal(owner.materials().revision,1);
  assert.deepEqual(quantities(owner),{P:1,'E2:L':2});record(stage,owner,{},'SYNTHETIC_IMPORT_FAULT');
}
for(const stage of ['before_execute','after_execute','before_commit']) {
  let armed=true;const owner=await imported({testMode:true,testFault:p=>{if(armed&&p===stage){armed=false;throw Error('SYNTHETIC:'+stage);}}});
  const req=request(owner,'007-fault-'+stage),saved=full(owner);
  const fail=await owner.submit(req);assert.equal(fail.error.code,'PRECOMMIT_FAILURE');unchanged(owner,saved);
  record(stage+'_no_partial_commit',owner,{reply:fail},'SYNTHETIC_FAULT');
  assert.equal((await owner.submit(req)).ok,true);assertPE(owner);before=full(owner);
  assert.equal((await owner.submit(req)).replayed,true);unchanged(owner,before);
  record(stage+'_retry_once',owner,{},'SYNTHETIC_FAULT');
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
for(const identical of [false,true]) {
  const arrived=deferred(),release=deferred();let calls=0;
  const owner=await imported({testMode:true,testFault:async stage=>{
    if(stage==='before_execute')calls++;
    if(stage==='after_execute'){arrived.resolve();await release.promise;}
  }});
  const a=request(owner,'007-race-A'),b=request(owner,identical?'007-race-A':'007-race-B'),saved=full(owner);
  const pa=owner.submit(a);await arrived.promise;const pb=owner.submit(b);unchanged(owner,saved);release.resolve();
  const replies=await Promise.all([pa,pb]);assert.equal(replies[0].ok,true);assert.equal(calls,1);assertPE(owner);
  if(identical)assert.equal(replies[1].replayed,true);
  else {assert.equal(replies[1].ok,false);assert.ok(replies[1].error.details.errors.includes('STALE_MATERIAL_CONTEXT'));}
  record(identical?'concurrent_same_request':'two_requests_one_version',owner,{calls,replies},'SYNTHETIC_CONCURRENCY');
}
const imports=store();const importReplies=await Promise.all([imports.importInitial(),imports.importInitial()]);
assert.deepEqual(importReplies.map(r=>r.status),['IMPORTED','ALREADY_IMPORTED_NO_CREDIT']);assert.equal(imports.materials().revision,1);
record('concurrent_import_once',imports,{},'SYNTHETIC_CONCURRENCY');

let lose=true;const lost=await imported({testMode:true,testFault:stage=>{if(lose&&stage==='after_commit_before_reply'){lose=false;throw Error('SYNTHETIC_ACK_LOST');}}});
const lostReq=request(lost,'007-lost');await assert.rejects(lost.submit(lostReq),/SYNTHETIC_ACK_LOST/);assertPE(lost);
assert.equal((await lost.submit(lostReq)).replayed,true);
record('lost_reply_replays_without_debit',lost,{},'SYNTHETIC_ACK_LOSS');
await lost.advancePhaseForTest();const newer=full(lost);
const late=await lost.submit(lostReq);unchanged(lost,newer);assert.equal(late.currentRevision,111);assert.equal(late.receipt.committedRevision,110);
assert.equal((await lost.importInitial()).status,'ALREADY_IMPORTED_NO_CREDIT');unchanged(lost,newer);
record('late_retry_and_import_preserve_newer_state',lost,{reply:late},'SYNTHETIC_REQUEST_ORDER_ORIGINAL_PHASE_ADVANCE');

const expired=await imported({testMode:true});await expired.advancePhaseForTest();const expiredBefore=full(expired);
assert.ok(Object.values(expired.materials().lots).every(l=>l.status==='QUARANTINED'));
assert.deepEqual(quantities(expired),{P:1,'E2:L':2});
const invalid=await expired.submit(request(expired,'007-expired'));assert.equal(invalid.ok,false);unchanged(expired,expiredBefore);
record('other_action_invalidates_scope_and_quarantines_unspent',expired,{reply:invalid});
const noImportExpired=store({testMode:true});await noImportExpired.advancePhaseForTest();before=full(noImportExpired);
assert.equal((await noImportExpired.importInitial()).ok,false);unchanged(noImportExpired,before);
record('import_after_other_action_rejected',noImportExpired);

// Missing/altered approval and altered candidate are local test startup files, never request grants.
const testDir=new URL('./.runtime/test-inputs/',import.meta.url);fs.mkdirSync(testDir,{recursive:true});
const approval=JSON.parse(fs.readFileSync(new URL('./APPROVAL.json',import.meta.url)));
const candidatePath=fileURLToPath(new URL('./.runtime/rule/candidate.json',import.meta.url));
for(const kind of ['unapproved','candidate_tampered','manifest_tampered_first_import']) {
  const approvalPath=new URL(kind+'-approval.json',testDir),candidateFile=new URL(kind+'-candidate.json',testDir),configFile=new URL(kind+'-launch.json',testDir);
  fs.writeFileSync(approvalPath,JSON.stringify(kind==='unapproved'?{...approval,decisionRef:null}:approval));
  const tampered=structuredClone(candidate);tampered.payment.recipe.P=99;
  fs.writeFileSync(candidateFile,JSON.stringify(tampered));
  fs.writeFileSync(configFile,JSON.stringify({approvalFile:fileURLToPath(approvalPath),candidateFile:kind==='candidate_tampered'?fileURLToPath(candidateFile):candidatePath}));
  const local=loadLaunch(fileURLToPath(configFile)),owner=store({launch:local}),saved=full(owner);
  const r=await owner.importInitial(kind==='manifest_tampered_first_import'?changedManifest:undefined);
  assert.equal(r.ok,false);unchanged(owner,saved);assert.equal(owner.materials().revision,0);
  record(kind,owner,{reply:r,localApprovalAccepted:local.approved},'SYNTHETIC_LOCAL_CONFIG_OR_MANIFEST_TAMPER');
}
assert.throws(()=>new RecoveryTransactions(initialJSON,{launch:{approved:true},instanceId:'forged'}),/UNTRUSTED_CALLER_APPROVAL/);
assert.throws(()=>new RecoveryTransactions(lost.serializedSnapshot(),{launch,instanceId:'lost-ledger-restart'}),/EXACT_INITIAL_CHECKPOINT_REQUIRED/);
assert.equal(bytesHash(initialJSON),candidate.checkpoint.serializedSnapshotSha256);
verifyRuntime();
const files=['adapter.mjs','authority.mjs','bindings.mjs','config.mjs','pe_bridge.py','prepare.py','prepare-seam.mjs','verify.mjs','APPROVAL.json','launch.json','PE-SEAM.patch','ADAPTER-FROM-006.patch','SEAM-HASHES.json'];
const evidence={status:'PASS',cases:rows.length,decisionRef:approval.decisionRef,candidateSha256:launch.candidateSha256,
  approvalFileHash:launch.approvalHash,manifestHash,originalBlockers:gate.blockers,globallyResolved:0,
  allInitialGameBytesPreserved:true,onlyLocalSingleOwner:true,rows,
  implementation:Object.fromEntries(files.map(n=>[n,bytesHash(fs.readFileSync(new URL(n,import.meta.url)))])),
  sourceManifestHash:bytesHash(fs.readFileSync(new URL('./.runtime/manifest.json',import.meta.url)))};
const serialized=JSON.stringify(evidence,null,2)+'\n';
if(process.argv.includes('--write'))fs.writeFileSync(new URL('./EVIDENCE.json',import.meta.url),serialized);
else assert.equal(bytesHash(fs.readFileSync(new URL('./EVIDENCE.json',import.meta.url))),bytesHash(serialized),'EVIDENCE_DIFFERS');
console.log(JSON.stringify({status:'PASS',cases:rows.length,PE:{step:[1,0],P:[1,0],E2:[2,0],RP:[8,12],count:[0,1],gameRevision:[109,110],materialRevision:[1,2]},globalBlockers:35}));
