// Read-only UI mapping of industry-016-view.v1, not a business API.
export const FORWARD_SCHEMA='industry-016-view.v1';
export const BRANCHES={
  main:{title:'主线 · 照管 → 前送 → 恢复',note:'同一主线的五个已提交检查点。'},
  control:{title:'对照A · 无操作至E8到期',note:'从同一T8起点独立推进，未付照管、未发运；不是主线恢复后的下一步。'},
  unused:{title:'对照B · 已前送但未恢复至E9',note:'独立支付照管并前送，跳过恢复，实际推进至T10；不是已恢复主线的后续。'},
  synthetic:{title:'合成样例 · 回滚 / 拒收 / 在途隔离',note:'SYNTHETIC验证样例；不属于真实主线或真实对照，不能合并库存。'}
};
const num=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const str=x=>typeof x==='string'&&x.length>0;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const materialKeys=['P','E2:L'];
export function rational(value){
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(typeof value!=='string'||!/^[-]?\d+(?:\/\d+)?$/.test(value))return NaN;
  const [a,b='1']=value.split('/').map(Number);return b===0?NaN:a/b;
}
export function mapForwardRecord(record,archive){
  const errors=[],v=record?.view;
  const fail=message=>errors.push(message);
  const required=(obj,key,predicate,path=key)=>{
    if(obj?.[key]===undefined)fail(path+' 未提供');
    else if(!predicate(obj[key]))fail(path+' 无效');
  };
  const fields=(obj,keys,predicate,prefix='')=>keys.forEach(k=>required(obj,k,predicate,prefix+k));
  if(v?.schema!==FORWARD_SCHEMA)return {valid:false,errors:['schema 未知或未提供，拒绝展示'],readOnly:true};
  fields(v,['rootRevision','gameRevision','materialRevision','turn','globalBlockersRetained','globalBlockersClosed'],num);
  fields(v,['phase'],str);required(v,'readOnly',x=>x===true);required(v,'runtimeDefaultEnabled',x=>x===false);
  required(v,'expired',x=>typeof x==='boolean');required(v,'blockers',x=>Array.isArray(x)&&x.every(str));
  fields(v,['equipmentBudget','personnelBudget','materials','frontInventory','availableFrontInventory','rearInventory','historicalOffmapPersonnelLQ','sourceGapSP'],object);
  fields(v,['care','shipment','terminal','receiver','recovery'],x=>x===null||object(x));
  required(v,'transport',x=>x===null||Array.isArray(x));
  if(!record||!BRANCHES[record.branch]||!str(record.id)||!str(record.sourceLabel)||!str(record.sourceOrigin))fail('记录来源或分支 未提供');
  if(!archive?.sourceCommit||archive.schema!==FORWARD_SCHEMA)fail('固定来源 未提供');
  required(archive,'qPerSP',x=>num(x)&&x>0,'qPerSP');
  required(archive,'sourceAssumption',object,'sourceAssumption');
  required(archive?.sourceAssumption,'sourceKind',x=>x==='SCENARIO_INITIAL_TRAINED_RESERVE_ASSUMPTION','sourceAssumption.sourceKind');
  required(archive?.sourceAssumption,'actualTrainingReceipt',x=>x===null,'sourceAssumption.actualTrainingReceipt');
  required(record,'requestError',x=>x===null||object(x),'requestError');
  if(record?.requestError)fields(record.requestError,['error','detail'],str,'requestError.');
  if(errors.length)return {valid:false,errors,readOnly:true};
  const e=v.equipmentBudget,p=v.personnelBudget;
  fields(e,['granted','freeI','productionSpent','handoffSpent','escrow'],num,'equipmentBudget.');
  fields(p,['grantedI','availableI','acceptanceCareSpentI','escrowI','carriageSpentI'],num,'personnelBudget.');required(p,'id',str);
  fields(v.historicalOffmapPersonnelLQ,['used','remaining'],num);required(v.historicalOffmapPersonnelLQ,'reusable',x=>x===false);
  fields(v.sourceGapSP,['G','S'],num);
  const states=['REAR_AVAILABLE','REAR_QUARANTINED','FRONT_AVAILABLE','FRONT_QUARANTINED','HELD','TRANSIT_QUARANTINED','CONSUMED'];
  for(const key of materialKeys){
    required(v.materials,key,object,'materials.'+key);
    const m=v.materials[key];if(!m)continue;
    fields(m,['id','owner'],str,'materials.'+key+'.');required(m,'custody',x=>states.includes(x),'materials.'+key+'.custody');
    required(m,key==='P'?'quantityP':'quantityE2',num,'materials.'+key+'.quantity');
    fields(m,['receivedEpoch','availableFromTurn'],num,'materials.'+key+'.');
    if(m.custody==='CONSUMED')required(m,key==='P'?'consumedP016':'consumedE2016',num,'materials.'+key+'.consumed');
    for(const group of ['frontInventory','availableFrontInventory','rearInventory'])required(v[group],key,num,group+'.'+key);
  }
  if(v.care){
    fields(v.care,['id','accountId','transferId','packageId','status'],str,'care.');
    fields(v.care,['receivedI','spentI','availableI','oldEndEpoch','endEpoch'],num,'care.');
    required(v.care,'nonrefundable',x=>x===true);required(e,'careTransferOutI',num,'equipmentBudget.careTransferOutI');
  }else if(Object.hasOwn(e,'careTransferOutI')&&e.careTransferOutI!==0)fail('无照管记录却存在转出');
  if(v.shipment){
    fields(v.shipment,['id','packageId','batchId','status'],str,'shipment.');
    fields(v.shipment,['dispatchEpoch','availableFromTurn'],num,'shipment.');
    required(v.shipment,'arrivalEpoch',x=>x===null||num(x),'shipment.arrivalEpoch');
  }
  if(v.terminal){fields(v.terminal,['status','id','unitId'],str,'terminal.');fields(v.terminal,['paidW','extraRecoveryW','arrivalEpoch','availableFromTurn','expiresAfterEpoch'],num,'terminal.');}
  if(v.receiver){
    required(v.receiver,'capacity',object,'receiver.capacity');required(v.receiver,'incoming',object,'receiver.incoming');
    fields(v.receiver.capacity,materialKeys,num,'receiver.capacity.');
    for(const hold of Object.values(v.receiver.incoming??{}))fields(hold,materialKeys,num,'receiver.incoming.');
  }
  if(v.transport)for(const row of v.transport){required(row,'id',str,'transport.id');fields(row,['originalCap','spUsed','cargo','remaining','reservation','freight'],num,'transport.');}
  if(v.recovery){
    fields(v.recovery,['id','unitId'],str,'recovery.');fields(v.recovery,['beforeStep','afterStep'],num,'recovery.');
    required(v.recovery,'payment',object,'recovery.payment');fields(v.recovery.payment,['P','E2:L','RP','extraW'],num,'recovery.payment.');
  }
  if(record.origin==='REAL'){
    if(record.branch==='synthetic'||!record.sourceOrigin.startsWith('REAL_'))fail('REAL分支标签不一致');
    const l=record.ledger;required(record,'ledger',object);required(l,'step',num,'ledger.step');required(l,'RP',object,'ledger.RP');fields(l?.RP,['GERMAN','SOVIET'],num,'ledger.RP.');
    for(const key of ['equipmentBudget','personnelBudget','rootRevision','gameRevision','materialRevision','frontInventory','availableFrontInventory'])
      if(JSON.stringify(l?.[key])!==JSON.stringify(v[key]))fail('LEDGER与view不一致：'+key);
  }else if(record.origin!=='SYNTHETIC'||record.branch!=='synthetic'||!record.sourceOrigin.startsWith('SYNTHETIC_')||record.ledger!==null)fail('来源标记或合成账本无效');
  if(errors.length)return {valid:false,errors,readOnly:true};
  const transfer=v.care?e.careTransferOutI:0;
  if(e.granted!==e.freeI+e.productionSpent+e.handoffSpent+e.escrow+transfer)fail('装备账户不守恒');
  if(p.grantedI!==p.availableI+p.acceptanceCareSpentI+p.escrowI+p.carriageSpentI)fail('人员账户不守恒');
  if(v.care&&(v.care.receivedI!==transfer||v.care.receivedI!==v.care.spentI+v.care.availableI))fail('内部照管划拨不守恒');
  if(v.transport)for(const row of v.transport){
    if(row.originalCap!==row.spUsed+row.reservation+row.freight+row.remaining)fail('运力不守恒：'+row.id);
    // cargo is a specification only, never another capacity charge.
  }
  const rows=materialKeys.map(key=>{
    const m=v.materials[key],quantity=key==='P'?m.quantityP:m.quantityE2;
    const consumed=m.custody==='CONSUMED'?(key==='P'?m.consumedP016:m.consumedE2016):0;
    const rear=m.owner==='RC007-REAR-G-A10',front=m.owner==='RC009-G-C10-GI01';
    if(!rear&&!front&&m.owner!==v.shipment?.id)fail('材料归属未知：'+key);
    if(v.rearInventory[key]!== (rear?quantity:0)||v.frontInventory[key]!== (front?quantity:0))fail('实物库存重复或归属不一致：'+key);
    const quarantined=m.custody.includes('QUARANTINED')?quantity:0;
    const available=front?v.availableFrontInventory[key]:rear&&m.custody==='REAR_AVAILABLE'&&v.turn>=m.availableFromTurn?quantity:0;
    if(available>quantity||available+quarantined>quantity||((v.expired||m.custody!=='FRONT_AVAILABLE')&&front&&available!==0))fail('可用/隔离不是实物子集：'+key);
    if(quantity+consumed!==(key==='P'?1:2))fail('当前材料与已消费历史不守恒：'+key);
    if(consumed&&(!v.recovery||v.recovery.payment[key]!==consumed))fail('消费历史缺少恢复回执');
    return {key,id:m.id,owner:m.owner,state:m.custody,location:rear?'A10':front?'C10':'在途',quantity,available,quarantined,consumed,
      historicalArrival:m.receivedEpoch,historicalAvailable:m.availableFromTurn};
  });
  const incoming={P:0,'E2:L':0};
  if(v.receiver)for(const hold of Object.values(v.receiver.incoming))for(const key of materialKeys)incoming[key]+=hold[key];
  if(v.receiver)for(const key of materialKeys)if(v.frontInventory[key]+incoming[key]>v.receiver.capacity[key])fail('C10仓容超额');
  if(v.shipment){
    if(v.shipment.packageId!==v.materials.P.id||v.shipment.batchId!==v.materials['E2:L'].id)fail('运输材料ID不一致');
    if(v.shipment.arrivalEpoch===null&&(v.frontInventory.P>0||v.frontInventory['E2:L']>0))fail('未确认到账却有前线实物');
    if(v.availableFrontInventory.P>0&&(v.shipment.arrivalEpoch===null||v.turn<v.shipment.availableFromTurn))fail('本次前送尚未可用');
  }
  if(v.terminal){
    const work=v.transport?.find(r=>r.id==='W:GH2');
    if(!work||v.terminal.paidW!==work.freight||v.terminal.extraRecoveryW!==0)fail('末端W重复计费或不匹配');
  }
  if(errors.length)return {valid:false,errors,readOnly:true};
  const showImpact=record.branch==='main'&&v.shipment?.arrivalEpoch!==null&&v.shipment!=null;
  const impact=showImpact?archive.e8Impact:null;
  const e9=record.branch==='unused'?archive.e9Unused:null;
  return {valid:true,errors:[],readOnly:true,action:null,record:structuredClone(record),view:structuredClone(v),
    branch:BRANCHES[record.branch],rows,incoming,transfer,impact:impact?structuredClone(impact):null,e9:e9?structuredClone(e9):null,
    route:v.transport?v.transport.filter(r=>r.id.startsWith('rail:')).map(r=>r.id.slice(5).split('~')).reduce((nodes,edge)=>nodes.length?[...nodes,edge[1]]:edge,[]).join(' → '):null};
}
