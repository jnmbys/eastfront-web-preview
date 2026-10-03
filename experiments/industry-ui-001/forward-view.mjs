import {rational} from './forward-adapter.mjs';
const $=id=>document.getElementById('f016-'+id);
const put=(id,value)=>$(id).textContent=String(value);
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=String(text);return n;};
const tableRow=values=>{const n=document.createElement('tr');n.append(...values.map(v=>el('td',v)));return n;};
const pair=(label,value)=>{const n=document.createElement('div');n.append(el('dt',label),el('dd',value));return n;};
const rp=value=>value?'德 '+value.GERMAN+' / 苏 '+value.SOVIET:'未提供';
const signed=n=>n>0?'+'+n:String(n);
export function renderForward(s,archive){
  $('error').hidden=s.valid;$('data').hidden=!s.valid;
  if(!s.valid){put('error','无法展示此记录：'+s.errors.join('；')+'。缺失字段未提供，不使用其他检查点或演示默认值。');return;}
  const r=s.record,v=s.view,e=v.equipmentBudget,p=v.personnelBudget,care=v.care,ship=v.shipment,rec=v.recovery;
  put('branch',s.branch.title);put('branch-note',s.branch.note+' '+(r.origin==='REAL'?'REAL：已完成的隔离实验记录，非实时连接。':'合成条件及其后续结果仅作验证，不冒充真实主线。'));
  for(const [id,value] of Object.entries({
    origin:r.origin,source:archive.sourceCommit,'source-origin':r.sourceOrigin,time:'T'+v.turn+' / '+v.phase,
    label:r.title+' · '+r.sourceLabel+' · '+(r.tracePath??'SYNTHETIC-VIEWS.'+r.id),
    revision:v.gameRevision+' / '+v.rootRevision+' / '+v.materialRevision,schema:v.schema,
    route:s.route??'A10起点 · 尚无本次发运记录',
    shipment:ship?'E'+ship.dispatchEpoch+' 发运 / '+(ship.arrivalEpoch===null?'未到账':'E'+ship.arrivalEpoch+' 到账')+' / 账本 T'+ship.availableFromTurn+' 可用起点':'未发运；本次到账与可用时点未提供',
    'shipment-state':ship?.status??'未发运（null）',
    'personnel-source':'013实验假定受训后备池；无实际训练回执，不代表训练系统已完成',
    'equipment-source':'012自产原批次 E2:L；沿用原永久ID，未新增赠料',
    expiry:care?'已付照管至E'+care.endEpoch+'结束 · '+care.status:'未支付016照管；013人员原照管在E8结束到期',
    'recovery-state':rec?'已恢复':v.expired?'已到期 / 未恢复':'未恢复',
    step:r.ledger?r.ledger.step+'（已提交快照）':'未提供（合成view未导出Core步损）',
    recovery:rec?rec.unitId+' 步损 '+rec.beforeStep+' → '+rec.afterStep:'尚无恢复回执',
    payment:rec?'消费 '+rec.payment.P+' P + '+rec.payment['E2:L']+' E2；RP '+rec.payment.RP+'，新增W '+rec.payment.extraW:'尚未消费恢复材料',
    rp:rp(r.ledger?.RP),
    'rp-change':rec?rp(archive.records.find(x=>x.id==='preRecovery').ledger.RP)+' → '+rp(r.ledger.RP)+'（不变）':'该检查点尚无已完成恢复比较',
    'old-lq':'已用 '+v.historicalOffmapPersonnelLQ.used+' LQ / 剩余 '+v.historicalOffmapPersonnelLQ.remaining+'；不可复用',
    'request-error':r.requestError?r.requestError.error+' · '+r.requestError.detail+'。已回滚，显示失败前已提交账本；没有套用成功结果。':r.origin==='SYNTHETIC'?'合成拒收 / 在途隔离样例；运力使用、材料归属和空间预留按本条记录保留。':'已提交的真实检查点；浏览记录不执行新的恢复。',
    global:'全局阻塞保留 '+v.globalBlockersRetained+' 项，关闭 '+v.globalBlockersClosed+' 项；SP来源缺口 德 '+v.sourceGapSP.G+' / 苏 '+v.sourceGapSP.S+'。'
  }))put(id,value);
  $('origin').className='status '+(r.origin==='REAL'?'success':'error');
  $('materials').replaceChildren(...s.rows.map(row=>tableRow([row.key,row.location+' · '+row.state,row.quantity,row.available,row.quarantined,row.consumed])));
  put('capacity',v.receiver?'C10实物 '+v.frontInventory.P+' P + '+v.frontInventory['E2:L']+' E2；入库预留 '+s.incoming.P+' P + '+s.incoming['E2:L']+' E2；容量 '+v.receiver.capacity.P+' P / '+v.receiver.capacity['E2:L']+' E2。隔离实物包含在占用内。':'C10容量未提供（尚无接收仓记录）；不套用演示容量。');
  $('ids').replaceChildren(...s.rows.flatMap(row=>[pair(row.key+' 永久ID',row.id),pair(row.key+' 当前持有方',row.owner),pair(row.key+' 历史A10入库','E'+row.historicalArrival+' / T'+row.historicalAvailable)]));
  $('finance').replaceChildren(
    tableRow(['原装备账户',e.granted+' I 拨款',e.freeI+' I',e.escrow+' I','生产 '+e.productionSpent+' I + 原交接 '+e.handoffSpent+' I；照管内部转出 '+s.transfer+' I']),
    tableRow(['原人员账户',p.grantedI+' I 拨款',p.availableI+' I',p.escrowI+' I','原照管 '+p.acceptanceCareSpentI+' I + 原运送 '+p.carriageSpentI+' I']),
    tableRow(['016照管账户',care?care.receivedI+' I 内部转入':'未建立',care?care.availableI+' I':'未提供','无托管字段，未提供',care?'照管支出 '+care.spentI+' I；不退款':'未支付']));
  const start=archive.records.find(x=>x.id==='start').view.equipmentBudget.freeI;
  put('finance-note',care?'装备账户可用 '+start+' → '+e.freeI+' I；'+s.transfer+' I转入照管账户并实际支出 '+care.spentI+' I。内部划拨不是新增收入，转出与转入不能重复计为支出。原人员 '+p.grantedI+' I账户保持不变。':'本记录未支付016照管费，装备可用 '+e.freeI+' I；原人员账户按本记录展示。');
  $('transport').replaceChildren(...(v.transport??[]).map(row=>tableRow([row.id,row.originalCap,row.spUsed,row.freight,row.reservation,row.remaining,row.cargo])));
  put('transport-note',v.transport?'这是E8已提交账目：上限 = SP占用 + 材料实际freight + 当前预留 + 剩余。cargo仅是收费规格，不能与freight再加一次。':'该检查点尚无已提交的E8材料运力账目；未提供，不从成功记录补齐。');
  put('terminal',v.terminal?'末端凭证 '+v.terminal.status+'；E8已付 '+v.terminal.paidW+' W，恢复新增 '+v.terminal.extraRecoveryW+' W。与上表W:GH2的freight是同一笔，8W仅计一次。':'尚无末端接收凭证；即使在途freight已支出，也不代表已到账。');
  $('impact-panel').hidden=!s.impact;
  $('impact').replaceChildren(...(s.impact?.units??[]).map(u=>tableRow([u.id,
    u.reference.maintenance/archive.qPerSP+' → '+u.alternative.maintenance/archive.qPerSP+' SP',
    rational(u.reference.debt)+' → '+rational(u.alternative.debt),
    u.reference.after/archive.qPerSP+' → '+u.alternative.after/archive.qPerSP+' SP',signed(u.stockDeltaQ/archive.qPerSP)+' SP'])));
  if(s.impact){
    const u=s.impact.units.find(u=>u.id==='G-REC-02');
    put('impact-note','G-REC-02少维护 '+u.reductionQ/archive.qPerSP+' SP，D由 '+rational(u.reference.debt)+' 变为 '+rational(u.alternative.debt)+'。实际攻击系数 '+u.actualCore.expSupply.attackFactor+'，移动上限 '+u.actualCore.expSupply.movementCap+'，'+u.actualCore.supplyState+'；相对参照没有新增掉步，也没有再次跨档。这里没有执行战斗，不代表长期净收益。1q = '+1/archive.qPerSP+' SP。');
  }
  $('e9-panel').hidden=!s.e9;
  if(s.e9){
    put('e9-maintenance',s.e9.sides.map(side=>(side.side==='G'?'德军':'苏军')+'实际维护 '+side.units.reduce((n,u)=>n+u.maintenance,0)+' q = '+side.units.reduce((n,u)=>n+u.maintenance,0)/archive.qPerSP+' SP').join('；'));
    $('e9-losses').replaceChildren(...s.e9.sides.flatMap(side=>side.units.filter(u=>u.loss>0).map(u=>el('li',u.id+'：实际掉 '+u.loss+' 步；D '+rational(u.debt)))));
  }else $('e9-losses').replaceChildren();
  $('blockers').replaceChildren(...(v.blockers.length?v.blockers:['本切片无所列阻塞；不代表全局阻塞已解除']).map(code=>el('li',code)));
  put('evidence',archive.checks.length+'项既有检查：'+archive.verification.status+'。本UI只核对固定证据，没有重跑工业实验。TRACE SHA-256 '+archive.traceSha256+'；单进程隔离，不声明崩溃持久化。');
  $('hashes').replaceChildren(...Object.entries(archive.sources).map(([name,hash])=>pair(name,'Git blob '+hash.gitBlob+' / SHA-256 '+hash.sha256)));
}

