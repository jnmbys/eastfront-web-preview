// Live same-origin API only. No static evidence adapter, projected success, or reset.
const $=id=>document.getElementById(id),KEY='industry017.pending.v1';let state=null,pending=null,busy=false,token='',polling=false;
const msg=s=>{$('message').textContent=s;};
function controls(){for(const [id,op] of [['care','CARE'],['next','NEXT'],['recover','RECOVER']])$(id).disabled=busy||!!pending||!state?.operations[op].enabled;}
function savePending(value){if(value)sessionStorage.setItem(KEY,JSON.stringify(value));else sessionStorage.removeItem(KEY);pending=value;$('request-id').textContent=value?'请求ID：'+value.requestId:'';controls();}
async function api(path,method='GET',body){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4500);
 try{const r=await fetch(path,{method,cache:'no-store',credentials:'omit',headers:{'X-Local-Session':token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await r.json();if(!r.ok)throw Object.assign(Error(data.error||'HTTP_'+r.status),{status:r.status});return data;}finally{clearTimeout(timer);}
}
function table(id,rows){$(id).replaceChildren(...rows.map(cells=>{const tr=document.createElement('tr');for(const text of cells){const td=document.createElement('td');td.textContent=String(text);tr.append(td);}return tr;}));}
const owners={'RC007-REAR-G-A10':'A10后方仓','RC009-G-C10-GI01':'C10前线仓'};
const custody={REAR_AVAILABLE:'后方可用',FRONT_AVAILABLE:'前线可用',CONSUMED:'已消费',REAR_QUARANTINED:'后方隔离',FRONT_QUARANTINED:'前线隔离',HELD:'在途留置',IN_TRANSIT:'在途',TRANSIT_QUARANTINED:'在途隔离'};
const debt=v=>{const[a,b='1']=String(v).split('/');return Number(a)/Number(b);};
function render(s){
 if(s.schema!=='industry-017-state.v1'||s.readError)throw Error('后端视图未确认，请查询原请求回执。');state=s;
 $('phase').textContent=`T${s.turn} · ${s.phaseLabel}`;$('version').textContent=`根 ${s.version} / 游戏 ${s.gameRevision} / 材料 ${s.materialRevision}`;$('freeI').textContent=s.equipmentBudget.freeI+' I';
 $('next-label').textContent=s.operations.NEXT.label;$('instance').textContent='本次实例：'+s.instanceId;
 table('materials',Object.entries(s.materials).map(([key,m])=>[key==='P'?'后备人员 P':'自产装备 E2',owners[m.owner]||'本次在途',m.quantity,m.consumed,custody[m.custody]||m.custody]));
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
 controls();
}
async function refresh(){render(await api('/api/state'));}
async function reconcile(result){
 if(!pending||result.requestId!==pending.requestId||result.instanceId!==pending.instanceId)throw Error('回执标识不符');
 if(result.status==='COMMITTED'||result.status==='REJECTED'){
  const done=result.status==='COMMITTED';savePending(null);$('retry').hidden=true;await refresh();msg(done?'后端已确认提交，正式结果已更新。':'后端已拒绝：'+result.code+'。未自动生成新请求。');return true;
 }return false;
}
async function poll(){
 if(polling||!pending)return;polling=true;
 try{
  if(state&&pending.instanceId!==state.instanceId){msg('服务实例已改变：旧请求无法从新实例核对，禁止自动重发。');$('forget').hidden=false;return;}
  for(let i=0;i<8&&pending;i++){
   try{if(await reconcile(await api('/api/requests/'+encodeURIComponent(pending.requestId))))return;msg('处理中：只查询原请求回执，不重复提交。');}
   catch(e){msg('结果待确认：'+e.message+'。保留原请求ID；请查询或按原内容重试。');$('retry').hidden=!!(state&&pending.instanceId!==state.instanceId);return;}
   await new Promise(resolve=>setTimeout(resolve,450));
  }
  if(pending)msg('结果待确认：请继续查询原请求回执。');
 }finally{polling=false;controls();}
}
async function postOriginal(){
 if(!pending||busy)return;busy=true;controls();$('retry').hidden=true;msg('处理中：等待后端确认，正式账本尚未更新。');
 try{const r=await api('/api/operations','POST',pending);if(!await reconcile(r))await poll();}
 catch(e){msg('结果待确认：'+e.message+'。将核对原请求回执，不生成新ID。');await poll();}
 finally{busy=false;controls();}
}
async function operate(operation){
 if(busy||pending||!state?.operations[operation].enabled)return;
 try{savePending({requestId:crypto.randomUUID(),instanceId:state.instanceId,expectedVersion:state.version,operation});await postOriginal();}
 catch(e){msg('无法安全保存请求标识，操作停止：'+e.message);controls();}
}
for(const[id,op]of[['care','CARE'],['next','NEXT'],['recover','RECOVER']])$(id).addEventListener('click',()=>operate(op));
$('check').addEventListener('click',async()=>{try{await refresh();if(pending)await poll();else msg('已读取后端正式状态，未提交操作。');}catch(e){msg('连接失败，正式结果保持上次已确认值：'+e.message);}});
$('retry').addEventListener('click',()=>postOriginal());
$('forget').addEventListener('click',()=>{if(pending&&state&&pending.instanceId!==state.instanceId){savePending(null);$('forget').hidden=true;$('retry').hidden=true;msg('旧请求已从本页标记中移除；没有向新实例重发。');}});
try{
 const fragment=new URLSearchParams(location.hash.slice(1)),incoming=fragment.get('session');
 if(incoming){sessionStorage.setItem('industry017.credential',incoming);history.replaceState(null,'',location.pathname);}
 token=sessionStorage.getItem('industry017.credential')||'';if(!token)throw Error('请使用启动终端给出的完整本机会话链接。');
 pending=JSON.parse(sessionStorage.getItem(KEY)||'null');$('request-id').textContent=pending?'待核对请求ID：'+pending.requestId:'';
 await refresh();if(pending){msg('刷新后重新连接：正在核对原请求。');await poll();}else msg('已连接同一个后端实例，可以操作。');
}catch(e){msg(e.message);controls();}
