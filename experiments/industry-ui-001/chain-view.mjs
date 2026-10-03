// Presentation of confirmed industry-018-chain.v1 only; no fetch, storage, timers or business writes.
export const OPS=[['allocate','ALLOCATE_I','领取装备拨款'],['order','PLACE_ORDER','下单生产'],['activate','ACTIVATE_PERSONNEL','启用后备池'],['apply','APPLY_PERSONNEL','申请人员接驳'],['care','CARE','支付照管费'],['next','NEXT','推进阶段'],['recover','RECOVER','恢复部队']];
const required=(object,keys)=>{for(const key of keys)if(!object||!Object.hasOwn(object,key))throw Error('账本字段未提供：'+key);};
const amount=v=>{if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw Error('账本数量未确认');};
const sum=values=>Object.values(values).reduce((n,v)=>n+v,0);
export function validateChain(s){
 if(s?.schema!=='industry-017-state.v1'||s.readError||!Number.isSafeInteger(s.version))throw Error('后端视图未确认。');
 const x=s.extensions?.industry018;
 if(x?.schema!=='industry-018-chain.v1')throw Error('未知或未提供018扩展，拒绝展示。');
 required(x,['stage','matchId','production','order','equipmentBatch','equipmentHandoffCapacity','personnel','handoffs','accountStatus']);
 required(x.production,['workRequired','workCompleted','bufferHoldE2']);Object.values(x.production).forEach(amount);
 required(s,['turn','phase','phaseLabel','instanceId','gameRevision','materialRevision','care','shipment','terminal','transport','recovery','impact','target','materials','expired']);
 for(const [,op]of OPS)if(typeof s.operations?.[op]?.enabled!=='boolean'||typeof s.operations[op].label!=='string')throw Error('操作资格未提供：'+op);
 if(!['ACTIVE','NOT_ALLOCATED'].includes(x.accountStatus?.equipment)||!['ACTIVE','NOT_ACTIVATED'].includes(x.accountStatus?.personnel))throw Error('账户启用状态未提供');
 for(const [obj,keys]of [[s.equipmentBudget,['granted','freeI','productionSpent','handoffSpent','escrow']],[s.personnelBudget,['grantedI','availableI','acceptanceCareSpentI','carriageSpentI','escrowI']]]){required(obj,keys);keys.forEach(k=>amount(obj[k]));}
 for(const key of ['P','E2:L']){required(s.materials[key],['owner','custody','quantity','consumed']);amount(s.materials[key].quantity);amount(s.materials[key].consumed);}
 if(x.order)required(x.order,['id','batchId','status','acceptedTurn','workEpochs']);
 if(x.personnel){required(x.personnel,['activated','sourceKind','trainingReceipt','application','package','quota','incomingP']);required(x.personnel.quota,['capLQ','used','holds','renews']);}
 for(const c of Object.values(x.equipmentHandoffCapacity))required(c,['epoch','finiteCap','perE2Work','used','holds']);
}
export function nextHint(s){
 const o=s.operations,x=s.extensions.industry018;
 if(s.recovery)return '恢复已完成；本次链路停在T9。可读取账本或查看历史模式。';
 if(o.ALLOCATE_I.enabled||o.PLACE_ORDER.enabled)return '完成主线请先领取原拨款并下单。现在直接推进会错过下单窗口，后续交接可能被拒绝。';
 if(o.ACTIVATE_PERSONNEL.enabled||o.APPLY_PERSONNEL.enabled)return '完成主线请先启用后备池并申请接驳。阶段推进不会替你申请；跳过可能使后续交接受阻。';
 if(o.CARE.enabled)return '完成主线请先支付照管。跳过照管，人员将在E8结束隔离，不能按本链路前送恢复。';
 if(o.RECOVER.enabled)return '人员和装备已到前线，当前可以显式恢复G-I-01。恢复会消费1P＋2 E2。';
 if(s.phase==='SOVIET_ENTRENCHMENT'){
  const purpose=s.turn<=6?(x.order?'结算生产；按本订单计划推进生产进度':'本轮没有生产订单'):s.turn===7?'结算人员接驳':s.turn===8?'结算A10至C10前送及部队维护':'按后端当前资格结算';
  return `下一步进入E${s.turn}结算：${purpose}。提交并读回后显示实际到账结果。`;
 }
 return '下一步：'+o.NEXT.label.replace('执行原场景增援：','安排本阶段增援：')+'。仅到结算边界才推进生产、接驳或前送。';
}
const $=id=>document.getElementById(id),put=(id,value)=>{$(id).textContent=value;};
function table(id,rows){$(id).replaceChildren(...rows.map(cells=>{const tr=document.createElement('tr');for(const v of cells){const td=document.createElement('td');td.textContent=String(v);tr.append(td);}return tr;}));}
const owners={'RC007-REAR-G-A10':'A10后方仓','RC009-G-C10-GI01':'C10前线仓'};
const custody={NOT_CREATED:'尚未生成',SOURCE_AVAILABLE:'后备池驻留',SOURCE_ESCROW:'待接驳',REAR_UNAVAILABLE:'到账未可用',PRODUCTION_STORE:'生产库存',REAR_AVAILABLE:'后方可用',FRONT_AVAILABLE:'前线可用',CONSUMED:'已消费',REAR_QUARANTINED:'后方隔离',FRONT_QUARANTINED:'前线隔离',HELD:'在途留置',IN_TRANSIT:'在途',TRANSIT_QUARANTINED:'在途隔离'};
const arrival=(m,name)=>!m?`${name}尚未生成或启用。`:m.receivedEpoch==null?`${name}尚未到账。`:`${name}原接驳：E${m.receivedEpoch}到账，T${m.availableFromTurn}可用（历史时点）。`;
const debt=v=>{const[a,b='1']=String(v).split('/');return Number(a)/Number(b);};
export function renderChainView(s){
 const x=s.extensions.industry018,o=x.order,p=x.personnel,b=s.equipmentBudget,pb=s.personnelBudget;
 put('phase',`T${s.turn} · ${s.phaseLabel}`);
 put('chain-summary',s.recovery?'恢复完成':x.stage==='012'?(o?'生产与交接':'下单准备'):x.stage==='013'?'人员接驳':s.shipment?'前线恢复':'照管与前送');
 put('freeI',x.accountStatus.equipment==='NOT_ALLOCATED'?'尚未领取拨款':b.freeI+' I');
 put('eligible',OPS.filter(([,op])=>s.operations[op].enabled).map(([,op,label])=>label).join(' · ')||'本次没有可执行业务；可以读取账本。');
 for(const [id,op]of OPS)document.getElementById('card-'+id).classList.toggle('eligible',s.operations[op].enabled);
 put('next-label',s.operations.NEXT.label.replace('执行原场景增援：','安排本阶段增援：'));put('next-hint',nextHint(s));
 put('chain-order',o?`生产结算 ${x.production.workCompleted}/${x.production.workRequired}；实际经过${o.workEpochs.map(e=>'E'+e).join('、')||'尚无生产结算'}。${x.production.workCompleted===x.production.workRequired?'生产工期已完成。':'等结算边界推进，无倒计时。'}`:`尚未下单。工期${x.production.workRequired}个合法结算，到账以实际交接为准。`);
 $('production-progress').max=x.production.workRequired;$('production-progress').value=x.production.workCompleted;
 put('production-space',`生产空间预留 ${x.production.bufferHoldE2} E2；预留不计实物。`);
 put('equipment-arrival',arrival(x.equipmentBatch,'装备'));
 put('chain-personnel',!p||!p.activated?'人员账户尚未启用，独立2I未到账；后备池没有导入本次账本。':p.application?'人员申请已登记；到账与归属见实际材料账。':'后备池与独立人员账户已启用；尚未申请接驳。');
 put('personnel-arrival',arrival(p?.package,'人员'));
 put('personnel-expiry',s.recovery?'本次人员已消费用于恢复，保留原照管历史。':s.expired?'人员已隔离，仍占仓容，不可恢复。':s.care?`已支付照管${s.care.spentI}I，期限至E${s.care.endEpoch}结束；届时未使用将隔离，仍占仓容。`:'固定人员期限：未照管且E8结束仍留后方将隔离；T8照管支付后才延长至E9结束。');
 table('finance',[
  ['装备',x.accountStatus.equipment==='ACTIVE'?'已启用':'尚未拨款',x.accountStatus.equipment==='ACTIVE'?b.granted+' I':'未到账',x.accountStatus.equipment==='ACTIVE'?b.freeI+' I':'未到账',b.escrow+' I',`生产 ${b.productionSpent} I · 交接 ${b.handoffSpent} I · 照管 ${s.care?.spentI??0} I`],
  ['人员',x.accountStatus.personnel==='ACTIVE'?'已启用':'尚未启用',x.accountStatus.personnel==='ACTIVE'?pb.grantedI+' I':'未到账',x.accountStatus.personnel==='ACTIVE'?pb.availableI+' I':'未到账',pb.escrowI+' I',`接受 ${pb.acceptanceCareSpentI} I · 接驳 ${pb.carriageSpentI} I`]
 ]);
 table('materials',Object.entries(s.materials).map(([key,m])=>[key==='P'?'后备人员 P':'自产装备 E2',owners[m.owner]||(m.owner?'后备来源 / 在途':'尚未生成'),m.quantity,['REAR_AVAILABLE','FRONT_AVAILABLE'].includes(m.custody)?m.quantity:0,m.custody.includes('QUARANTINED')?m.quantity:0,m.consumed,custody[m.custody]||'状态未识别（见诊断）']));
 put('arrival',s.shipment?`本次前送：E${s.shipment.dispatchEpoch}发运；${s.shipment.arrivalEpoch==null?'尚未到账':`E${s.shipment.arrivalEpoch}到账，T${s.shipment.availableFromTurn}可用`}。这是同一批材料，不与原A10接驳重复计数。`:'本次前送尚未发生。后方材料可用不等于当前已具备前线恢复资格。');
 const windows=Object.values(x.equipmentHandoffCapacity);
 put('equipment-capacity',windows.length?windows.map(c=>`E${c.epoch}装备交接账：上限${c.finiteCap}工作点，已用${sum(c.used)}、预留${sum(c.holds)}、账面余量${c.finiteCap-sum(c.used)-sum(c.holds)}（该结算已关闭，不能作为当前运力）`).join('；'):'装备独立交接：尚未产生结算运力账。固定每E上限4工作点，每E2占2工作点。');
 put('personnel-capacity',p?`人员独立额度：上限${p.quota.capLQ} LQ，已用${sum(p.quota.used)}，预留${sum(p.quota.holds)}，剩余${p.quota.capLQ-sum(p.quota.used)-sum(p.quota.holds)}；不刷新。入库预留${sum(p.incomingP)} P，不计实物。`:'人员接驳额度尚未启用；不能显示成已消耗或当前运输余额。');
 table('capacity',s.transport?s.transport.map(c=>[c.id.replace('rail:','铁路 ').replace('~','—').replace('W:GH2','末端 W'),c.originalCap,c.spUsed,c.reservation,c.freight,c.remaining]):[['尚未产生E8前送账','—','—','—','—','—']]);
 put('terminal',s.terminal?`E8已付${s.terminal.paidW}W，只计一次；恢复新增W=${s.terminal.extraRecoveryW}。`:'E8前送尚未提交；不提前扣除SP运力或增加前线库存。');
 table('impact',s.impact?s.impact.map(c=>[c.unit,`${c.referencePaidSP} → ${c.actualPaidSP}`,`${c.referenceStockSP} → ${c.actualStockSP}`,`${debt(c.referenceD)} → ${debt(c.actualD)}`]):[['尚未取得E8实际账','—','—','—']]);
 put('impact-note',s.impact?'E8实际维护账与固定参照比较；不能外推长期收益。':'固定前送代价预告：G-REC-02少维护0.5SP，D由参照2到2.5；实际结算后再列账。');
 put('recovery',s.recovery?`${s.recovery.unitId} 步损 ${s.recovery.beforeStep} → ${s.recovery.afterStep} · 恢复已提交`:'尚未执行恢复。');
 put('target',`当前步损${s.target.step}；RP德${s.target.RP.GERMAN} / 苏${s.target.RP.SOVIET}；恢复次数${s.target.recoveryCount} / ${s.target.recoveryLimit}。`);
 put('version',`根 ${s.version} / 游戏 ${s.gameRevision} / 材料 ${s.materialRevision}`);put('instance','本次实例：'+s.instanceId);
 put('chain-transfers',`内部阶段 ${x.stage} · ${x.matchId}；`+x.handoffs.map(h=>`${h.fromStage}→${h.toStage}，游戏版本${h.gameRevision}，保留${h.retainedReceipts}份回执`).join('；'));
 put('raw-state',JSON.stringify(s,null,2));
}
