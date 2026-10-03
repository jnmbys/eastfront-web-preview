const $=id=>document.getElementById('p013-'+id);
const put=(id,value)=>$(id).textContent=String(value);
const el=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node;};
const row=(label,value)=>{const node=document.createElement('div');node.append(el('dt',label),el('dd',value));return node;};
const reasons={TOTAL_PERSONNEL_QUOTA_EXHAUSTED:'独立总运力不足以完成本次发运',SYNTHETIC_REFUSAL:'合成接收拒绝',SCOPE_EXPIRED_NO_REACTIVATION:'服务范围已过期，不可重新激活'};
export function renderPersonnel(s,archive) {
  $('error').hidden=s.valid;
  $('data').hidden=!s.valid;
  if(!s.valid){put('error','无法展示此记录：'+s.errors.join('；')+'。缺失字段未提供，不套用演示默认值。');return;}
  const v=s.view,w=v.warehouse,p=v.personnelBudget,e=v.equipment012Budget,c=v.custody,q=v.service;
  const synthetic=v.origin!=='REAL';
  const isTerminal=s.sourceLabel.startsWith('early_terminal_')||c.state==='TERMINAL_QUARANTINED';
  for(const [id,value] of Object.entries({
    source:s.sourceCommit,schema:v.schema,label:(s.kind==='CHECKPOINT'?'检查点':'原VIEWS样例')+' · '+s.label,'source-label':s.sourceLabel,
    origin:v.origin,'origin-note':s.originDescription,phase:'T'+v.turn+' / '+v.phase,revisions:'整体 '+v.rootRevision+' / 游戏 '+v.gameRevision,
    warehouse:w.node+' · 人员与装备同仓',status:s.status+(isTerminal?' · 终局样例':''),
    resident:w.residentP+' P',available:w.availableP+' P',quarantine:w.quarantinedResidentP+' P',incoming:w.incomingHeldP+' P',equipment:w.residentE2+' E2',
    occupancy:'人员占位 '+s.occupiedP+' / '+w.capacityP+' P（驻留 + 入库预留）',
    'equipment-capacity':'装备占位 '+w.residentE2+' / '+w.capacityE2+' E2',
    authority:w.id+' · '+w.coreKey+' · '+w.personnelAuthority,
    'budget-id':p.id,'p-granted':p.grantedI+' I','p-free':p.availableI+' I','p-escrow':p.escrowI+' I','p-spent':s.personnelSpentI+' I',
    'care-paid':p.acceptanceCareSpentI+' I','carriage-paid':p.carriageSpentI+' I',
    'p-conservation':p.grantedI+' I = 余额 '+p.availableI+' + 托管 '+p.escrowI+' + 照管 '+p.acceptanceCareSpentI+' + 运送 '+p.carriageSpentI,
    'e-granted':e.granted+' I','e-free':e.freeI+' I','e-escrow':e.escrow+' I','e-spent':s.equipmentSpentI+' I',
    'production-paid':e.productionSpent+' I','handoff-paid':e.handoffSpent+' I',
    'e-conservation':e.granted+' I = 余额 '+e.freeI+' + 托管 '+e.escrow+' + 生产 '+e.productionSpent+' + 交接 '+e.handoffSpent,
    arrival:v.receivedEpoch===null?'尚未到账（null）':'E'+v.receivedEpoch+' 到账 / T'+v.availableFromTurn+' 起（账本信息）',
    expiry:v.careEndsAfterEpoch===null?'尚无到账照管期限（null）':'E'+v.careEndsAfterEpoch+' 结束后仍留后方将隔离',
    quota:q.quotaLQ+' LQ · 一次性，不刷新',
    'quota-detail':q.usedLQ+' / '+q.heldLQ+' / '+q.remainingLQ+' LQ'+(q.remainingLQ===0?' · 总额度已用尽':''),
    window:'发运 '+q.dispatchEpochs.map(x=>'E'+x).join(' / ')+'；最晚收货 E'+q.lastReceiveEpoch,
    'source-kind':'场景初始受训预备池假设 · '+v.source.kind,
    imported:v.source.imported?'已导入':'尚未导入',training:'无实际训练回执（null）；不是新完成训练',
    'custody-counts':c.sourceP+' / '+c.transitP+' / '+c.rearP+' P',
    physical:s.physicalP+' P / 其中隔离 '+c.quarantinedP+' P（子集，不累加）',
    'custody-state':s.custody+' · '+c.state,owner:c.owner??'无持有方（null）',
    failure:v.lastRequestError?v.lastRequestError.error+' · '+v.lastRequestError.detail+'。提交失败；以上是失败前已提交账本，不是失败中间态或重试成功后的余额。':'无请求失败回执（null）；不据此授予写入权限。',
    permissions:'forwardTransportRecoveryFormationAllowed = '+v.forwardTransportRecoveryFormationAllowed+'。只读记录不开放申请、前送、恢复、续期或新编。',
    global:'全局阻塞保留 '+v.globalBlockersRetained+' 项，关闭 '+v.globalBlockersClosed+' 项。'
  }))put(id,value);
  put('boundary',synthetic
    ?'合成验证样例：'+s.sourceLabel+'。实际快照仍为 T'+v.turn+' / '+v.phase+'；标签中的E或终局条件不是真实推进证明。'
    :v.receivedEpoch!==null?'真实 E'+v.receivedEpoch+' 到账记录；快照已进入 T'+v.turn+'，人员可用 '+w.availableP+' P。没有伪造“E7到账未可用”中间快照。'
    :'显示真实检查点的已提交账本；切换记录不会推进结算。');
  put('care-note',c.quarantinedP>0
    ?(synthetic?'合成隔离 / 终局样例。':'')+'隔离人员仍在原物理位置；后方隔离仍占仓容，不重新累加为第二批人员。'
    :v.careEndsAfterEpoch!==null?'照管有效至 E'+v.careEndsAfterEpoch+' 结束；届时仍留后方将隔离。可用不等于后续操作已获授权。'
    :'尚未到账，不能推定照管期限。发运与收货窗口按原记录保留。');
  $('origin').className='status '+(synthetic?'error':'success');
  $('blockers').replaceChildren(...(v.blockingReasons.length?v.blockingReasons:['无所列当前阻塞；不代表获得后续操作权限']).map(code=>el('li',reasons[code]?reasons[code]+' · '+code:code)));
  $('ids').replaceChildren(...Object.entries(v.source.ids).map(([k,value])=>row(k,value)));
  put('evidence',archive?'固定来源 '+archive.sourceCommit+'；7个检查点 + 原有18条VIEWS样例；'+archive.evidenceSummary.status+'。来源证据 '+archive.evidenceCases.length+' 项，读取既有结果，没有重跑Core。':'来源摘要未提供');
  $('hashes').replaceChildren(...(archive?Object.entries(archive.sources).map(([name,hash])=>row(name,'Git blob '+hash.gitBlob+' / SHA-256 '+hash.sha256)):[]));
}

