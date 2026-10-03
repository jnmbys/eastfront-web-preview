// Maps the accepted industry-012-view.v1 export. No demo imports or write commands.
export const VIEW_SCHEMA = 'industry-012-view.v1';
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const integer = x => Number.isSafeInteger(x) && x >= 0;
const text = x => typeof x === 'string' && x.length > 0;
const nullableInteger = x => x === null || integer(x);
const nullableText = x => x === null || text(x);
export function validateView(v) {
  const errors = [];
  const require = (ok, path) => { if (!ok) errors.push(path); };
  if (!object(v)) return ['view 未提供或不是对象'];
  require(v.schema === VIEW_SCHEMA, 'schema 未知或未提供');
  require(v.readOnly === true, 'readOnly 必须为 true');
  require(['REAL','SYNTHETIC_FIXTURE','SYNTHETIC_FAULT_ON_REAL_REPLAY'].includes(v.origin), 'origin 未知或未提供');
  for (const k of ['rootRevision','gameRevision','industryRevision','turn','globalBlockersRetained','globalBlockersClosed']) require(integer(v[k]), k+' 未提供或无效');
  require(text(v.phase), 'phase 未提供或无效');
  require(object(v.budget), 'budget 未提供');
  for (const k of ['availableI','escrowI','productionPaidI','handoffPaidI','grantedI']) require(integer(v.budget?.[k]), 'budget.'+k+' 未提供或无效');
  require(object(v.equipment), 'equipment 未提供');
  for (const k of ['producedE2','productionStoreE2','inTransitOrHeldE2','rearE2','availableRearE2','P','productionReservedE2','incomingReservedE2']) require(integer(v.equipment?.[k]), 'equipment.'+k+' 未提供或无效');
  require(v.equipment?.materialType === 'E2:L', 'equipment.materialType 未知或未提供');
  require(['NOT_CREATED','PRODUCTION_STORE','IN_TRANSIT','HELD','REAR_UNAVAILABLE','REAR_AVAILABLE'].includes(v.equipment?.custody), 'equipment.custody 未知或未提供');
  if (v.order !== null) {
    require(object(v.order), 'order 未提供');
    require(text(v.order?.id), 'order.id 未提供');
    require(['WORKING','WAITING_HANDOFF','HELD','AVAILABLE'].includes(v.order?.status), 'order.status 未知或未提供');
    for (const k of ['workCompleted','workRequired','expectedCompletionEpoch']) require(integer(v.order?.[k]), 'order.'+k+' 未提供或无效');
    require(Array.isArray(v.order?.workEpochs) && v.order.workEpochs.every(integer), 'order.workEpochs 未提供或无效');
    require(v.order?.expectedCompletionIsConditional === true, 'order.expectedCompletionIsConditional 未提供或非条件预测');
    require(nullableInteger(v.order?.completedEpoch), 'order.completedEpoch 未提供或无效');
  }
  if (v.arrival !== null) {
    require(object(v.arrival), 'arrival 未提供');
    for (const k of ['batchId','shipmentId']) require(text(v.arrival?.[k]), 'arrival.'+k+' 未提供');
    for (const k of ['receivedEpoch','availableFromTurn']) require(nullableInteger(v.arrival?.[k]), 'arrival.'+k+' 未提供或无效');
    require(nullableText(v.arrival?.receiptId), 'arrival.receiptId 未提供或无效');
  }
  require(Array.isArray(v.externalCapacity), 'externalCapacity 未提供');
  for (const [i, r] of (Array.isArray(v.externalCapacity) ? v.externalCapacity : []).entries()) {
    require(object(r) && text(r.resourceId), `externalCapacity[${i}].resourceId 未提供`);
    for (const k of ['epoch','cap','usedByAllCommittedTraffic','reserved','remaining']) require(integer(r?.[k]), `externalCapacity[${i}].${k} 未提供或无效`);
    require(typeof r?.epochClosed === 'boolean', `externalCapacity[${i}].epochClosed 未提供`);
    require(r?.carryForward === false && r?.independentOfSP === true, `externalCapacity[${i}] 窗口或SP隔离标识无效`);
  }
  require(Array.isArray(v.blockingReasons) && v.blockingReasons.every(text), 'blockingReasons 未提供或无效');
  if (v.lastRequestError !== null) require(object(v.lastRequestError) && v.lastRequestError.ok === false && text(v.lastRequestError.error) && text(v.lastRequestError.detail), 'lastRequestError 未提供或无效');
  if (errors.length) return errors;
  const b=v.budget, e=v.equipment, o=v.order, a=v.arrival;
  require(b.grantedI === b.availableI+b.escrowI+b.productionPaidI+b.handoffPaidI, '预算守恒不符');
  require(e.producedE2 === e.productionStoreE2+e.inTransitOrHeldE2+e.rearE2 && e.availableRearE2 <= e.rearE2, '实物守恒或可用数量不符');
  if (o) require(o.workRequired>0 && o.workCompleted<=o.workRequired && new Set(o.workEpochs).size===o.workEpochs.length && o.workEpochs.length===o.workCompleted, '生产进度不符');
  for (const r of v.externalCapacity) require(r.cap === r.usedByAllCommittedTraffic+r.reserved+r.remaining, '外部容量守恒不符');
  if (e.availableRearE2>0) require(a?.receiptId && a.receivedEpoch !== null && a.availableFromTurn !== null && v.turn>=a.availableFromTurn, '可用装备缺少已确认收货及回合依据');
  if (a) require((a.receivedEpoch===null)===(a.receiptId===null) && (a.receivedEpoch===null)===(a.availableFromTurn===null), '收货凭证不一致');
  return errors;
}
const STATUS={WORKING:'生产中',WAITING_HANDOFF:'等待交接',HELD:'接收受阻',AVAILABLE:'可用'};
const CUSTODY={NOT_CREATED:'未产出',PRODUCTION_STORE:'生产暂存',IN_TRANSIT:'在途',HELD:'在途 / 接收受阻',REAR_UNAVAILABLE:'A10 已到账未可用',REAR_AVAILABLE:'A10 可用库存'};
export function mapRecord(record, sourceCommit) {
  const view=record?.view;
  const errors=validateView(view);
  if (!text(record?.label)) errors.push('检查点标签未提供');
  if (typeof sourceCommit!=='string' || !/^[a-f0-9]{40}$/.test(sourceCommit)) errors.push('来源提交未提供或无效');
  if (errors.length) return {valid:false,errors,sourceCommit,readOnly:true,action:null};
  const v=structuredClone(view);
  return {valid:true,readOnly:true,action:null,sourceCommit,label:record.label,checkpoint:record.checkpoint,
    sourceLabel:record.sourceLabel,view:v,status:v.order?STATUS[v.order.status]:'尚未下单',custody:CUSTODY[v.equipment.custody],
    originDescription:v.origin==='REAL'?'已完成的隔离实验记录；非实时连接':'合成验证样例；不是另一笔真实订单',
    quote:null,warehouseCapacity:null,productionCapacity:null,permissions:null,
    capacityRows:v.externalCapacity.map(row=>({...row,availability:row.epochClosed?'已关闭 · 可用 0 · 不结转':'未关闭记录 · 当前授权未提供'})),
    completion:v.order?`E${v.order.expectedCompletionEpoch}（条件预测，不是入库证据）`:'未提供（无订单）'};
}
