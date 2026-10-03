const $=id=>document.getElementById(id);
const put=(id,text)=>$(id).textContent=text;
const el=(tag,text)=>{const n=document.createElement(tag); n.textContent=text; return n;};
const reasonNames={EXTERNAL_CAPACITY_INSUFFICIENT:'外部交接容量不足',WAREHOUSE_CAPACITY_INSUFFICIENT:'目的仓位不足',SERVICE_WINDOW_EXPIRED_NO_AUTOMATIC_RETRY:'服务窗口已过期，不自动续期或重试',SYNTHETIC_RECEIVER_BLOCK:'合成接收资格阻塞'};
export function renderRecord(s) {
  $('record-error').hidden=s.valid;
  $('record-data').hidden=!s.valid;
  if(!s.valid){put('record-error',`无法展示此记录：${s.errors.join('；')}。缺失内容未提供，不使用演示默认值。`); return;}
  const v=s.view,b=v.budget,e=v.equipment,o=v.order,a=v.arrival;
  for(const [id,value] of Object.entries({
    'record-source':s.sourceCommit,'record-schema':v.schema,'record-label':s.label,'record-origin':v.origin,
    'record-origin-note':s.originDescription,'record-turn':`T${v.turn}`,'record-phase':v.phase,
    'record-revisions':`整体 ${v.rootRevision} / 游戏 ${v.gameRevision} / 工业 ${v.industryRevision}`,
    'record-status':s.status,'record-order-id':o?.id??'未下单（null）',
    'record-granted':`${b.grantedI} I`,'record-free':`${b.availableI} I`,'record-escrow':`${b.escrowI} I`,
    'record-spent':`${b.productionPaidI+b.handoffPaidI} I`,'record-paid-detail':`生产 ${b.productionPaidI} I + 交接 ${b.handoffPaidI} I`,
    'record-progress':o?`${o.workCompleted} / ${o.workRequired} 个结算边界`:'未提供（无订单）',
    'record-work-epochs':o?o.workEpochs.map(x=>`E${x}`).join('、')||'尚无已提交生产结算':'未提供（无订单）',
    'record-completion':s.completion,'record-completed':o?.completedEpoch===null||!o?'尚未产出':`E${o.completedEpoch}`,
    'record-produced':`${e.producedE2} ${e.materialType}`,'record-custody':`${s.custody} · ${e.custody}`,
    'record-buffer':`${e.productionStoreE2} E2`,'record-transit':`${e.inTransitOrHeldE2} E2`,'record-rear':`${e.rearE2} E2`,
    'record-available':`${e.availableRearE2} E2`,'record-production-hold':`${e.productionReservedE2} E2`,'record-incoming-hold':`${e.incomingReservedE2} E2`,
    'record-personnel':`${e.P} P`,'record-arrival':a?.receivedEpoch===null||!a?'未到账':`E${a.receivedEpoch} 到账；账本可用起点 T${a.availableFromTurn}`,
    'record-receipt':a?.receiptId??'未到账，无收货回执','record-global':`全局阻塞保留 ${v.globalBlockersRetained} 项，关闭 ${v.globalBlockersClosed} 项`,
    'record-error-detail':v.lastRequestError?`${v.lastRequestError.error} · ${v.lastRequestError.detail}。该请求未提交；以上为失败前已确认账本，不是重试成功结果。`:'无请求拒绝回执（null）'
  }))put(id,value);
  const boundaryNote=s.checkpoint==='E6'?'E6结算后的实际快照已进入 T7，装备可用。记录未导出真实“E6到账未可用”中间快照。'
    :s.checkpoint==='E5'?'E5结算后的实际快照已进入 T6；E5容量行已关闭，剩余工作点不能作为当前运力。'
    :v.lastRequestError?'提交失败样例：保留各自失败前的预算、进度和装备，不替换为主路径或重试后的值。'
    :'显示选中检查点的已保存值；切换检查点只浏览记录，不推进游戏。';
  put('record-boundary-note',boundaryNote);
  $('record-origin').className=`status ${v.origin==='REAL'?'success':'error'}`;
  $('record-blockers').replaceChildren(...(v.blockingReasons.length?v.blockingReasons:['无当前阻塞记录；不代表获得生产或恢复权限']).map(code=>el('li',reasonNames[code]?`${reasonNames[code]} · ${code}`:code)));
  $('record-capacity').replaceChildren(...s.capacityRows.map(r=>{
    const tr=document.createElement('tr');
    for(const x of [`E${r.epoch}`,r.resourceId,r.cap,r.usedByAllCommittedTraffic,r.reserved,r.remaining,r.availability])tr.append(el('td',String(x)));
    return tr;
  }));
  $('record-capacity-empty').hidden=s.capacityRows.length>0;
}
