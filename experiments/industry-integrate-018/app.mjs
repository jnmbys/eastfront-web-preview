// Live same-origin API only. No static evidence adapter, projected success, or reset.
const $=id=>document.getElementById(id),KEY='industry018.pending.v1',FLOOR='industry018.view-floor.v1';
let state=null,pending=null,busy=false,token='',polling=false,floor=null;
const msg=s=>{$('message').textContent=s;};
function controls(){for(const [id,op] of [['allocate','ALLOCATE_I'],['order','PLACE_ORDER'],['activate','ACTIVATE_PERSONNEL'],['apply','APPLY_PERSONNEL'],['care','CARE'],['next','NEXT'],['recover','RECOVER']])$(id).disabled=busy||!!pending||!state?.operations[op].enabled;}
function savePending(value){
 // Keep the in-memory lock even if persisting a confirmed receipt fails.
 if(value){pending=value;controls();sessionStorage.setItem(KEY,JSON.stringify(value));}
 else{sessionStorage.removeItem(KEY);pending=null;}
 $('request-id').textContent=value?'请求ID：'+value.requestId:'';controls();
}
function rememberVersion(instanceId,version){
 if(floor&&floor.instanceId!==instanceId)throw Error('服务实例不符，拒绝替换本次账本。');
 floor={instanceId,version:Math.max(floor?.version??0,version)};
 sessionStorage.setItem(FLOOR,JSON.stringify(floor));
}
function waiting(error=''){
 const c=pending?.confirmation;
 $('retry').hidden=!!c||!pending;$('forget').hidden=true;
 if(c)msg((c.status==='COMMITTED'?`后端已确认提交（版本${c.minVersion}）`:`后端已确认拒绝：${c.code}`)+'；账本尚未刷新，显示值可能过期，业务操作已锁定。仅恢复读取，不再提交。'+error);
 else if(pending)msg('结果待确认：保留原请求ID，请查询原回执或按原内容重试。'+error);
 else msg('读取失败，未用该响应更新正式账本：'+error);
 controls();
}
async function api(path,method='GET',body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
 try{const r=await fetch(path,{method,cache:'no-store',credentials:'omit',headers:{'X-Local-Session':token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'HTTP_'+r.status),{status:r.status});return data;}finally{clearTimeout(timer);}
}
function table(id,rows){$(id).replaceChildren(...rows.map(cells=>{const tr=document.createElement('tr');for(const text of cells){const td=document.createElement('td');td.textContent=String(text);tr.append(td);}return tr;}));}
const owners={'RC007-REAR-G-A10':'A10后方仓','RC009-G-C10-GI01':'C10前线仓'};
const custody={NOT_CREATED:'尚未生成',SOURCE_AVAILABLE:'后备池可用',SOURCE_ESCROW:'已申请，待接驳',REAR_UNAVAILABLE:'已到账，等待可用',PRODUCTION_STORE:'生产库',REAR_AVAILABLE:'后方可用',FRONT_AVAILABLE:'前线可用',CONSUMED:'已消费',REAR_QUARANTINED:'后方隔离',FRONT_QUARANTINED:'前线隔离',HELD:'在途留置',IN_TRANSIT:'在途',TRANSIT_QUARANTINED:'在途隔离'};
const debt=v=>{const[a,b='1']=String(v).split('/');return Number(a)/Number(b);};
function render(s){
 if(s.schema!=='industry-017-state.v1'||s.readError||!Number.isSafeInteger(s.version))throw Error('后端视图未确认。');
 // Validate when the response is applied, not when its GET was dispatched.
 const instance=pending?.instanceId??floor?.instanceId??state?.instanceId;
 const minimum=Math.max(floor?.version??0,state?.version??0,pending?.confirmation?.minVersion??0);
 if(instance&&s.instanceId!==instance)throw Error('服务实例不符，拒绝替换本次账本。');
 if(s.version<minimum)throw Error(`旧账本版本${s.version}低于已确认版本${minimum}，拒绝覆盖。`);
 rememberVersion(s.instanceId,s.version);state=s;
 $('phase').textContent=`T${s.turn} · ${s.phaseLabel}`;$('version').textContent=`根 ${s.version} / 游戏 ${s.gameRevision} / 材料 ${s.materialRevision}`;$('freeI').textContent=s.equipmentBudget.freeI+' I';
 $('next-label').textContent=s.operations.NEXT.label;$('instance').textContent='本次实例：'+s.instanceId;
 table('materials',Object.entries(s.materials).map(([key,m])=>[key==='P'?'后备人员 P':'自产装备 E2',owners[m.owner]||(m.owner?'源库或在途':'尚未生成'),m.quantity,m.consumed,custody[m.custody]||m.custody]));
 const b=s.equipmentBudget,p=s.personnelBudget;const values=[['装备原拨款',b.granted+' I'],['已付生产 / 原交接',`${b.productionSpent} / ${b.handoffSpent} I`],['装备托管',b.escrow+' I'],['照管转出 / 实付',`${b.careTransferOutI||0} / ${s.care?.spentI||0} I`],['人员原拨款 / 可用',`${p.grantedI} / ${p.availableI} I`],['人员接受 / 接驳 / 托管',`${p.acceptanceCareSpentI} / ${p.carriageSpentI} / ${p.escrowI} I`]];
 $('finance').replaceChildren(...values.flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;return[dt,dd];}));
 $('arrival').textContent=s.shipment?`本次：E${s.shipment.dispatchEpoch}发运；${s.shipment.arrivalEpoch===null?'尚未到账':`E${s.shipment.arrivalEpoch}到账，T${s.shipment.availableFromTurn}可用`}。`:'尚未取得本次到账结果；未付照管的人员将在E8结束隔离。';
 table('capacity',s.transport?s.transport.map(r=>[r.id.replace('rail:','铁路 ').replace('~','—').replace('W:GH2','GH2末端 W'),r.originalCap,r.spUsed,r.reservation,r.freight,r.remaining]):[['尚未提交','—','—','—','—','—']]);
 const terminalStatus={PAID:'已支付，待使用',CONSUMED:'已用于恢复',EXPIRED_NO_REFUND:'已失效，不退款'};
 $('terminal').textContent=s.terminal?`E8已付${s.terminal.paidW}W只计一次；恢复新增W=${s.terminal.extraRecoveryW}。凭证状态：${terminalStatus[s.terminal.status]||s.terminal.status}。`:'尚未提交本次运力使用。已用的地图外4LQ不能再使用。';
 table('impact',s.impact?s.impact.map(r=>[r.unit,`${r.referencePaidSP} → ${r.actualPaidSP}`,`${r.referenceStockSP} → ${r.actualStockSP}`,`${debt(r.referenceD)} → ${debt(r.actualD)}`]):[['尚未取得E8实际结算','—','—','—']]);
 $('impact-note').textContent=s.impact?'已提交的E8实际结果，与015固定参照比较；不是未来损失或胜率预测。':'固定政策预告：G-REC-02少付0.5SP维护，另有库存重分配。以下实际账仅在E8提交后出现。';
 $('recovery').textContent=s.recovery?`${s.recovery.unitId} 步损 ${s.recovery.beforeStep} → ${s.recovery.afterStep} · 恢复已提交`:s.expired?'人员已到期隔离，不能恢复。':'尚未执行恢复。';
 $('target').textContent=`实际Core：步损${s.target.step}；RP德${s.target.RP.GERMAN} / 苏${s.target.RP.SOVIET}；本回合恢复次数${s.target.recoveryCount} / ${s.target.recoveryLimit}。`;
 renderChain(s);controls();
}
async function refresh(){
 render(await api('/api/state'));
 const c=pending?.confirmation;
 if(c){
  // render checked both the instance and receipt floor; only now release the lock.
  savePending(null);$('retry').hidden=true;
  msg(c.status==='COMMITTED'?'后端已确认提交，正式结果已更新。':'后端已确认拒绝：'+c.code+'。正式账本已刷新，未自动生成新请求。');
  return true;
 }return false;
}
async function recoverView(){try{await refresh();}catch(e){waiting(e.message);}}
async function reconcile(result){
 if(!pending)return true; // Another read may already have completed reconciliation.
 if(result.requestId!==pending.requestId||result.instanceId!==pending.instanceId||result.operation!==pending.operation||result.expectedVersion!==pending.expectedVersion)throw Error('回执标识不符');
 if(result.status==='COMMITTED'||result.status==='REJECTED'){
  if(result.status==='COMMITTED'&&(!Number.isSafeInteger(result.resultVersion)||result.resultVersion<=pending.expectedVersion))throw Error('提交回执缺少有效确认版本。');
  const minVersion=Math.max(floor?.version??0,pending.expectedVersion+(result.code==='STALE_VERSION'?1:0),result.resultVersion??0);
  savePending({...pending,confirmation:{status:result.status,code:result.code,minVersion,resultVersion:result.resultVersion}});
  rememberVersion(pending.instanceId,minVersion);waiting();await recoverView();return true;
 }return false;
}
async function poll(){
 if(polling||!pending)return;polling=true;
 try{
  if(pending.confirmation){await recoverView();return;}
  for(let i=0;i<8&&pending;i++){
   try{if(await reconcile(await api('/api/requests/'+encodeURIComponent(pending.requestId))))return;msg('处理中：只查询原请求回执，不重复提交。');}
   catch(e){waiting(e.message);return;}
   await new Promise(resolve=>setTimeout(resolve,450));
  }
  if(pending)waiting();
 }finally{polling=false;controls();}
}
async function postOriginal(){
 if(!pending||busy)return;
 if(pending.confirmation){await recoverView();return;}
 busy=true;controls();$('retry').hidden=true;msg('处理中：等待后端确认，正式账本尚未更新。');
 const {requestId,instanceId,expectedVersion,operation}=pending;
 try{const r=await api('/api/operations','POST',{requestId,instanceId,expectedVersion,operation});if(!await reconcile(r))await poll();}
 catch(e){waiting(e.message);await poll();}
 finally{busy=false;controls();}
}
async function operate(operation){
 if(busy||pending||!state?.operations[operation].enabled)return;
 try{savePending({requestId:crypto.randomUUID(),instanceId:state.instanceId,expectedVersion:state.version,operation});await postOriginal();}
 catch(e){msg('无法安全保存请求标识，操作停止：'+e.message);controls();}
}
for(const[id,op]of[['allocate','ALLOCATE_I'],['order','PLACE_ORDER'],['activate','ACTIVATE_PERSONNEL'],['apply','APPLY_PERSONNEL'],['care','CARE'],['next','NEXT'],['recover','RECOVER']])$(id).addEventListener('click',()=>operate(op));
$('check').addEventListener('click',async()=>{
 if(pending){await poll();return;}
 try{if(!await refresh())msg('已读取后端正式状态，未提交操作。');}catch(e){waiting(e.message);}
});
$('retry').addEventListener('click',()=>postOriginal());
// A changed instance is not evidence that a confirmed request's ledger was read.
$('forget').hidden=true;
try{
 const fragment=new URLSearchParams(location.hash.slice(1)),incoming=fragment.get('session');
 pending=JSON.parse(sessionStorage.getItem(KEY)||'null');floor=JSON.parse(sessionStorage.getItem(FLOOR)||'null');
 if(incoming){
  if(!pending&&incoming!==sessionStorage.getItem('industry018.credential')){floor=null;sessionStorage.removeItem(FLOOR);}
  sessionStorage.setItem('industry018.credential',incoming);history.replaceState(null,'',location.pathname);
 }
 token=sessionStorage.getItem('industry018.credential')||'';if(!token)throw Error('请使用启动终端给出的完整本机会话链接。');
 $('request-id').textContent=pending?'待核对请求ID：'+pending.requestId:'';controls();
 if(pending){waiting();await poll();}else{await refresh();msg('已连接同一个后端实例，可以操作。');}
}catch(e){waiting(e.message);}

function renderChain(s){
 const x=s.extensions.industry018,o=x.order,p=x.personnel;
 $('chain-summary').textContent=`同一实例 · ${x.stage}阶段 · T${s.turn} · ${x.production.workCompleted}/${x.production.workRequired}个生产结算已完成`;
 $('chain-order').textContent=o?`订单${o.status}；已推进E：${o.workEpochs.join('、')||'尚无'}。出厂、交接和A10入库由实际阶段结算驱动。`:'尚未下单：先领取本实例一次性10I，再下单。没有持续工业收入。';
 $('chain-personnel').textContent=p?`人员账户：${x.accountStatus.personnel}；申请：${p.application?.status||'尚未申请'}；地图外接驳累计已用${Object.values(p.quota.used).reduce((a,b)=>a+b,0)}/4 LQ，不刷新。`:'人员接口在T7开放。1P为原契约的已训练后备池假设，无训练回执；独立预算2I。';
 $('chain-transfers').textContent=x.handoffs.length?x.handoffs.map(h=>`${h.fromStage}→${h.toStage}：游戏版本${h.gameRevision}，保留${h.retainedReceipts}份原永久回执`).join('；'):'尚未发生阶段交接；只从当前执行根继续。';
}
