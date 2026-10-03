// UI-only validation/mapping of the accepted 013 v1 export; no demo/012 imports.
export const PERSONNEL_SCHEMA='industry-013-personnel-view.v1';
const statuses={NOT_APPLIED:'未申请',ACCEPTED:'已接受 · 等待发运',IN_TRANSIT:'在途',HELD:'接收受阻',RECEIVED:'已到账',AVAILABLE:'人员可用',EXPIRED:'已过期 / 隔离'};
const states={NOT_IMPORTED:'尚未导入',SOURCE_AVAILABLE:'来源池驻留',SOURCE_ESCROW:'来源池托管',IN_TRANSIT:'在途',HELD:'在途 / 接收受阻',REAR_AVAILABLE:'后方可用',REAR_RECEIVED:'后方已到账',SOURCE_QUARANTINED:'来源池隔离',TRANSIT_QUARANTINED:'在途隔离',REAR_QUARANTINED:'后方隔离',TERMINAL_QUARANTINED:'终局隔离'};
export function mapPersonnelRecord(record,sourceCommit) {
  const errors=[],v=record?.view;
  const bad=message=>errors.push(message);
  const at=path=>path.split('.').reduce((o,key)=>o?.[key],v);
  const check=(path,predicate,description)=>{
    const value=at(path);
    if(value===undefined)bad(path+' 未提供');
    else if(!predicate(value))bad(path+' '+description);
  };
  const string=x=>typeof x==='string'&&x.length>0;
  const integer=x=>Number.isSafeInteger(x)&&x>=0;
  const nullableInteger=x=>x===null||integer(x);
  if(v?.schema!==PERSONNEL_SCHEMA)return {valid:false,errors:['schema 未知或未提供，拒绝展示'],readOnly:true,action:null};
  for(const path of ['origin','phase','applicationStatus','source.kind','personnelBudget.id','custody.state','warehouse.id','warehouse.node','warehouse.coreKey','warehouse.personnelAuthority'])check(path,string,'必须为非空文字');
  for(const key of ['sourceGrantId','budgetGrantId','packageId','applicationId','batchId','shipmentId','receiptId'])check('source.ids.'+key,string,'必须为非空ID');
  for(const path of ['rootRevision','gameRevision','turn','globalBlockersRetained','globalBlockersClosed',
    ...['grantedI','availableI','acceptanceCareSpentI','escrowI','carriageSpentI'].map(k=>'personnelBudget.'+k),
    ...['granted','freeI','productionSpent','handoffSpent','escrow'].map(k=>'equipment012Budget.'+k),
    ...['sourceP','transitP','rearP','availableRearP','quarantinedP'].map(k=>'custody.'+k),
    ...['capacityP','residentP','availableP','incomingHeldP','quarantinedResidentP','capacityE2','residentE2'].map(k=>'warehouse.'+k),
    ...['quotaLQ','usedLQ','heldLQ','remainingLQ','lastReceiveEpoch'].map(k=>'service.'+k)])check(path,integer,'必须为非负整数');
  for(const path of ['receivedEpoch','availableFromTurn','careEndsAfterEpoch'])check(path,nullableInteger,'必须为整数或明确的null');
  for(const path of ['readOnly','warehouse.historical012PIsNotCurrentStock','service.independentOfSPAnd012'])check(path,x=>x===true,'必须为true');
  for(const path of ['service.renews','forwardTransportRecoveryFormationAllowed'])check(path,x=>x===false,'必须为false');
  check('source.imported',x=>typeof x==='boolean','必须为布尔值');
  check('source.actualTrainingReceipt',x=>x===null,'013来源假设不含实际训练回执');
  check('custody.owner',x=>x===null||string(x),'必须为ID或null');
  check('service.dispatchEpochs',x=>Array.isArray(x)&&x.length>0&&x.every(integer),'必须为结算数组');
  check('blockingReasons',x=>Array.isArray(x)&&x.every(string),'必须为原因码数组');
  check('lastRequestError',x=>x===null||(typeof x==='object'&&x.ok===false&&string(x.error)&&string(x.detail)),'必须为null或拒绝回执');
  if(!string(sourceCommit)||!record?.id||!record?.sourceLabel||!['CHECKPOINT','VIEWS_SAMPLE'].includes(record?.kind))bad('离线来源索引 未提供');
  if(errors.length)return {valid:false,errors,readOnly:true,action:null};
  const p=v.personnelBudget,e=v.equipment012Budget,c=v.custody,w=v.warehouse,q=v.service;
  if(v.origin!=='REAL'&&!v.origin.startsWith('SYNTHETIC_'))bad('origin 非已知来源类型');
  if(!Object.hasOwn(statuses,v.applicationStatus))bad('applicationStatus 未知');
  if(v.source.kind!=='SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION')bad('source.kind 未知来源');
  if(w.personnelAuthority!=='personnel.package')bad('人员权威来源错误');
  if(w.id!=='RC007-REAR-G-A10'||w.node!=='A10'||w.coreKey!=='0,9')bad('不是契约中的单一A10仓');
  if(p.grantedI!==p.availableI+p.acceptanceCareSpentI+p.escrowI+p.carriageSpentI)bad('人员账户不守恒');
  if(e.granted!==e.freeI+e.productionSpent+e.handoffSpent+e.escrow)bad('装备账户不守恒');
  const physicalP=c.sourceP+c.transitP+c.rearP;
  if(physicalP!==(v.source.imported?1:0))bad('互斥人员归属不守恒');
  if(c.quarantinedP>physicalP||c.availableRearP>c.rearP||w.quarantinedResidentP>w.residentP||w.availableP+w.quarantinedResidentP>w.residentP)bad('可用/隔离不是实物子集');
  if(w.residentP!==c.rearP||w.availableP!==c.availableRearP||w.quarantinedResidentP!==Math.min(c.quarantinedP,c.rearP))bad('仓库与人员归属不一致');
  if(w.residentP+w.incomingHeldP>w.capacityP||w.residentE2>w.capacityE2)bad('仓容不守恒');
  if(q.usedLQ+q.heldLQ+q.remainingLQ!==q.quotaLQ)bad('独立总LQ不守恒');
  if(v.receivedEpoch===null&&(v.availableFromTurn!==null||v.careEndsAfterEpoch!==null||w.residentP>0))bad('没有到账却存在可用起点/照管期限/后方实物');
  if(v.receivedEpoch!==null&&(v.availableFromTurn!==v.receivedEpoch+1||v.careEndsAfterEpoch!==v.receivedEpoch+1))bad('到账与有效期不一致');
  if(w.availableP>0&&(v.receivedEpoch===null||v.turn<v.availableFromTurn||v.turn>24||c.quarantinedP>0))bad('人员可用时点或隔离状态不合法');
  if(errors.length)return {valid:false,errors,readOnly:true,action:null};
  return {valid:true,errors:[],readOnly:true,action:null,sourceCommit,id:record.id,label:record.label,sourceLabel:record.sourceLabel,
    kind:record.kind,checkpoint:record.checkpoint,view:structuredClone(v),status:statuses[v.applicationStatus],
    custody:states[c.state]??c.state,physicalP,occupiedP:w.residentP+w.incomingHeldP,
    personnelSpentI:p.acceptanceCareSpentI+p.carriageSpentI,equipmentSpentI:e.productionSpent+e.handoffSpent,
    originDescription:v.origin==='REAL'?'REAL：已完成的隔离实验记录，非实时连接。':'SYNTHETIC：合成验证 / 对照样例，不是主路径的真实推进，不能合并为真实库存。'};
}

