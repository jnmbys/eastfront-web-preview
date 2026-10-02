// Derived from 006: same owner queue, fingerprint lifecycle, lossless state and root publication.
import assert from 'node:assert/strict';
import {snapshotHash,bytesHash,freeze,gate,queryRecoveryEligibility,resolveService,originalRPPlan,executeOriginal} from './bindings.mjs';
import {candidate,manifestHash,assertLocalLaunch,verifyRuntime} from './config.mjs';
import {executePE} from './authority.mjs';
export {snapshotHash};
const owners=new Set();
const clone=structuredClone;
const fields=['requestId','controllerId','unitId','expectedRevision','snapshotHash','paymentMode','materialRevision','materialHash'];
const failure=(code,details=null)=>({code,details});
function valid(request) {
  return request&&typeof request==='object'&&!Array.isArray(request)&&Object.keys(request).length===fields.length&&
    fields.every(k=>Object.hasOwn(request,k))&&fields.filter(k=>!['expectedRevision','materialRevision'].includes(k)).every(k=>typeof request[k]==='string'&&request[k])&&
    ['expectedRevision','materialRevision'].every(k=>Number.isSafeInteger(request[k])&&request[k]>=0);
}
function quarantine(materials,reason) {
  if(materials.scopeStatus!=='ACTIVE') return materials;
  const next=clone(materials);next.revision++;next.scopeStatus='INVALIDATED';
  for(const lot of Object.values(next.lots)) if(lot.status==='AVAILABLE') lot.status='QUARANTINED';
  next.journal.push({event:'SCOPE_INVALIDATED',reason});return next;
}

export class RecoveryTransactions {
  #root; #tail=Promise.resolve(); #python; #fault; #testMode; #launch;
  constructor(bundleJSON,{launch,instanceId,python,testMode=false,testFault=null}={}) {
    verifyRuntime();assertLocalLaunch(launch);
    assert.equal(typeof bundleJSON,'string');
    assert.equal(bytesHash(bundleJSON),candidate.checkpoint.serializedSnapshotSha256,'EXACT_INITIAL_CHECKPOINT_REQUIRED');
    const bundle=JSON.parse(bundleJSON);
    assert.equal(snapshotHash(bundle),candidate.checkpoint.industry006FullValueHashReference);
    assert.ok(typeof instanceId==='string'&&instanceId&&!owners.has(instanceId),'NEW_ISOLATED_INSTANCE_ID_REQUIRED');
    if(testFault&&!testMode)throw Error('FAULT_INJECTION_REQUIRES_TEST_MODE');
    owners.add(instanceId);this.#launch=launch;this.#python=python;this.#fault=testFault;this.#testMode=testMode;
    this.#root=freeze({bundle,bundleJSON,records:Object.create(null),materials:{revision:0,instanceId,
      experimentId:candidate.scope.experimentId,scopeStatus:'ACTIVE',imports:{},lots:{},journal:[]}});
  }
  snapshot(){return clone(this.#root.bundle);}
  serializedSnapshot(){return this.#root.bundleJSON;}
  materials(){return clone(this.#root.materials);}
  metadata(){return clone(this.#root.records);}
  #enqueue(work){const run=this.#tail.then(work);this.#tail=run.catch(()=>{});return run;}
  #reply(data){return clone({...data,currentRevision:this.#root.bundle.revision,currentHash:snapshotHash(this.#root.bundle),
    currentSerializedHash:bytesHash(this.#root.bundleJSON),materialRevision:this.#root.materials.revision,materialHash:snapshotHash(this.#root.materials),
    runtimeGate:{allowed:false,blockers:gate.blockers},localSliceApproved:this.#launch.approved,
    executionScope:'ISOLATED_INITIAL_PE_SLICE_ONLY'});}
  #record(id,value){this.#root=freeze({...this.#root,records:{...this.#root.records,[id]:value}});}
  #scope(root,request) {
    const issues=[];const s=candidate.scope,b=root.bundle,u=b.core.units[request.unitId];
    if(!this.#launch.approved)issues.push('LOCAL_APPROVAL_REQUIRED');
    if(root.materials.scopeStatus!=='ACTIVE'||bytesHash(root.bundleJSON)!==candidate.checkpoint.serializedSnapshotSha256||b.revision!==109)issues.push('EXPERIMENT_SCOPE_EXPIRED');
    if(request.unitId!==s.unitId||request.controllerId!==s.controllerId||u?.templateId!==s.templateId||u?.side!==s.coreSide||
       b.core.turn!==s.turn||b.core.phase!==s.phase||u?.hex.q!==2||u?.hex.r!==8)issues.push('TARGET_OR_TIME_OUTSIDE_SCOPE');
    const service=resolveService(b,{unitId:request.unitId,receiverId:candidate.service.receiverId});
    if(service.materialService.sameHex!==true||service.materialService.control!==null||service.materialService.occupiedByEnemy!==false||service.materialService.enemyZoc!==false)issues.push('NULL_CONTROL_OR_ACCESS_SCOPE_FAILED');
    return issues;
  }
  #plan(root,request) {
    if(!valid(request))return {ok:false,errors:['INVALID_REQUEST_SCHEMA'],common:null,debits:null};
    const errors=[];
    if(request.expectedRevision!==root.bundle.revision||request.snapshotHash!==snapshotHash(root.bundle))errors.push('STALE_GAME_CONTEXT');
    if(request.materialRevision!==root.materials.revision||request.materialHash!==snapshotHash(root.materials))errors.push('STALE_MATERIAL_CONTEXT');
    const query={controllerId:request.controllerId,unitId:request.unitId,paymentMode:request.paymentMode,
      expectedRevision:request.expectedRevision,snapshotHash:request.snapshotHash};
    // Always call actual original Core checks, including after scope expires. Never use R004 receipts.
    const common=queryRecoveryEligibility(root.bundle,query);
    let debits=null;
    if(request.paymentMode==='RP') {
      const plan=originalRPPlan(root.bundle,query);errors.push(...plan.payment.errors);
      debits=plan.payment.plan?.debits??null;
    } else if(request.paymentMode==='PE') {
      errors.push(...this.#scope(root,request));
      const m=root.materials,manifest=candidate.initialManifest;
      if(m.imports[manifest.manifestId]?.manifestHash!==manifestHash)errors.push('INITIAL_MANIFEST_NOT_IMPORTED');
      const proposed=[];
      for(const expected of manifest.lots) {
        const lot=m.lots[expected.lotId];
        if(!lot||lot.status!=='AVAILABLE'||lot.material!==expected.material||lot.quantity!==expected.quantity||lot.manifestId!==manifest.manifestId)errors.push('MATERIAL_UNAVAILABLE:'+expected.lotId);
        else proposed.push({lotId:expected.lotId,material:expected.material,quantity:expected.quantity});
      }
      debits=proposed;
    } else errors.push('EXPLICIT_PAYMENT_MODE_REQUIRED');
    const ok=common.commonEligible&&errors.length===0;
    return {ok,errors,common,debits:ok?debits:null,requirements:request.paymentMode==='PE'?candidate.payment.recipe:null,
      runtimeGate:{allowed:false,blockers:gate.blockers}};
  }
  plan(request){const before=bytesHash(JSON.stringify(this.#root));const r=clone(this.#plan(this.#root,request));
    assert.equal(bytesHash(JSON.stringify(this.#root)),before);return r;}

  importInitial(manifest=candidate.initialManifest) {
    const captured=clone(manifest);
    return this.#enqueue(async()=>{
      const current=this.#root,m=current.materials;
      if(!this.#launch.approved)return this.#reply({ok:false,error:failure('LOCAL_APPROVAL_REQUIRED')});
      const digest=snapshotHash(captured),prior=m.imports[captured?.manifestId];
      if(prior) return this.#reply(digest===prior.manifestHash?{ok:true,replayed:true,status:'ALREADY_IMPORTED_NO_CREDIT',receipt:prior}:
        {ok:false,error:failure('MANIFEST_ID_CONFLICT')});
      if(digest!==manifestHash)return this.#reply({ok:false,error:failure('MANIFEST_CONTENT_MISMATCH')});
      const issues=this.#scope(current,{unitId:candidate.scope.unitId,controllerId:candidate.scope.controllerId});
      if(issues.length)return this.#reply({ok:false,error:failure('IMPORT_SCOPE_INVALID',issues)});
      if(m.revision!==0||Object.keys(m.lots).length||Object.keys(m.imports).length)return this.#reply({ok:false,error:failure('INITIAL_LEDGER_NOT_EMPTY')});
      const materials=clone(m);materials.revision=1;
      const receipt={experimentId:candidate.scope.experimentId,instanceId:m.instanceId,manifestId:captured.manifestId,
        manifestHash:digest,baseSnapshotSha256:candidate.checkpoint.serializedSnapshotSha256,retired:false};
      materials.imports[captured.manifestId]=receipt;
      for(const lot of captured.lots) materials.lots[lot.lotId]={...lot,initialQuantity:lot.quantity,status:'AVAILABLE',manifestId:captured.manifestId};
      materials.journal.push({event:'INITIAL_MANIFEST_IMPORTED',...receipt,origin:captured.origin,sourceId:captured.originSourceId});
      const nextRoot=freeze({...current,materials});
      try{await this.#fault?.('before_import_commit');}catch(e){return this.#reply({ok:false,error:failure('PRECOMMIT_FAILURE',String(e))});}
      assert.equal(this.#root,current);this.#root=nextRoot;
      await this.#fault?.('after_import_commit_before_reply');
      return this.#reply({ok:true,replayed:false,status:'IMPORTED',receipt});
    });
  }
  submit(request){const captured=clone(request);return this.#enqueue(()=>this.#submit(captured));}
  async #submit(request) {
    if(!valid(request))return this.#reply({ok:false,error:failure('INVALID_REQUEST_SCHEMA')});
    const id=request.requestId,fingerprint=snapshotHash(request);
    const prior=Object.hasOwn(this.#root.records,id)?this.#root.records[id]:null;
    if(prior){
      if(prior.fingerprint!==fingerprint)return this.#reply({ok:false,error:failure('REQUEST_ID_CONFLICT')});
      if(prior.status==='COMMITTED')return this.#reply({ok:true,replayed:true,receipt:prior.receipt});
      if(prior.status==='REJECTED')return this.#reply({ok:false,replayed:true,error:prior.error});
    }
    const bound={fingerprint,request:clone(request),status:'RETRYABLE',receipt:null};this.#record(id,bound);
    const reject=error=>{this.#record(id,{...bound,status:'REJECTED',error});return this.#reply({ok:false,error});};
    const current=this.#root;
    if(Object.hasOwn(current.bundle.seen,id))return reject(failure('LEGACY_REQUEST_ID_COLLISION'));
    const plan=this.#plan(current,request);
    if(!plan.ok)return reject(failure(plan.common&&!plan.common.commonEligible?'RECOVERY_NOT_ELIGIBLE':'PLAN_BLOCKED',plan));
    const command={id,revision:current.bundle.revision,action:{type:'REPAIR_UNIT',controllerId:request.controllerId,unitId:request.unitId}};
    let nextRoot,receipt;
    try{
      await this.#fault?.('before_execute');
      const result=await (request.paymentMode==='PE'?executePE:executeOriginal)(current.bundleJSON,command,this.#python);
      if(!result.ok)return reject(failure('ENGINE_REJECTED',result.error));
      assert.ok(!result.duplicate);assert.equal(result.state.revision,current.bundle.revision+1);
      assert.deepEqual(JSON.parse(result.stateJSON),result.state);
      let materials=clone(current.materials);
      if(request.paymentMode==='PE') {
        for(const debit of plan.debits){const lot=materials.lots[debit.lotId];lot.quantity-=debit.quantity;lot.status='SPENT';}
        materials.imports[candidate.initialManifest.manifestId].retired=true;
        materials.scopeStatus='CONSUMED';materials.revision++;
        materials.journal.push({event:'PE_MATERIAL_SPENT',requestId:id,debits:plan.debits});
        assert.deepEqual(result.state.core.rp,current.bundle.core.rp);
      } else materials=quarantine(materials,'OTHER_ACCEPTED_GAME_ACTION:RP_RECOVERY');
      await this.#fault?.('after_execute');
      assert.equal(this.#root,current);assert.deepEqual(this.#plan(current,request),plan);
      receipt={requestId:id,fingerprint,paymentMode:request.paymentMode,command,debits:plan.debits,
        beforeRevision:current.bundle.revision,beforeHash:snapshotHash(current.bundle),beforeSerializedHash:bytesHash(current.bundleJSON),
        committedRevision:result.state.revision,committedHash:snapshotHash(result.state),committedSerializedHash:bytesHash(result.stateJSON),
        beforeMaterialRevision:current.materials.revision,beforeMaterialHash:snapshotHash(current.materials),
        committedMaterialRevision:materials.revision,committedMaterialHash:snapshotHash(materials)};
      nextRoot=freeze({bundle:result.state,bundleJSON:result.stateJSON,materials,records:{...current.records,[id]:{...bound,status:'COMMITTED',receipt}}});
      await this.#fault?.('before_commit');
    }catch(e){this.#record(id,{...bound,status:'RETRYABLE',error:failure('PRECOMMIT_FAILURE',String(e))});return this.#reply({ok:false,retryable:true,error:failure('PRECOMMIT_FAILURE',String(e))});}
    this.#root=nextRoot;
    await this.#fault?.('after_commit_before_reply');
    return this.#reply({ok:true,replayed:false,receipt});
  }
  advancePhaseForTest(){
    if(!this.#testMode)throw Error('TEST_MODE_REQUIRED');
    return this.#enqueue(async()=>{
      const current=this.#root;
      const command={id:'007-test-phase-'+current.bundle.revision,revision:current.bundle.revision,
        action:{type:'END_PHASE',controllerId:current.bundle.core.controllers[candidate.scope.controllerId].id}};
      const result=await executeOriginal(current.bundleJSON,command,this.#python);
      assert.ok(result.ok&&!result.duplicate,result.error);
      this.#root=freeze({...current,bundle:result.state,bundleJSON:result.stateJSON,materials:quarantine(current.materials,'OTHER_ACCEPTED_GAME_ACTION:END_PHASE')});
      return clone(command);
    });
  }
}
