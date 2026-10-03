// UI-006: pinned 018 R1 protocol retained; presentation moved to chain-view.mjs.
import {validateChain,renderChainView} from './chain-view.mjs';
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
function render(s){
 validateChain(s);
 const instance=pending?.instanceId??floor?.instanceId??state?.instanceId;
 const minimum=Math.max(floor?.version??0,state?.version??0,pending?.confirmation?.minVersion??0);
 if(instance&&s.instanceId!==instance)throw Error('服务实例不符，拒绝替换本次账本。');
 if(s.version<minimum)throw Error(`旧账本版本${s.version}低于已确认版本${minimum}，拒绝覆盖。`);
 rememberVersion(s.instanceId,s.version);state=s;
 renderChainView(s);controls();
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
