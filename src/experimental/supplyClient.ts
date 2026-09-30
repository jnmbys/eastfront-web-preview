/** Same-origin hotseat transport. No WebSocket, full Core state, RNG or local apply. */
import type {PlayerTransport} from '../multiplayer/networkSession.js';
import type {LobbyState} from '../multiplayer/client.js';
import type {ServerMessage,ClientPayloads} from '../multiplayer/protocol.js';
import {PROTOCOL_VERSION} from '../multiplayer/protocol.js';
import type {MatchSnapshot,QueryDraft} from '../multiplayer/gameplayProtocol.js';
export const SUPPLY_VERSION='SUPPLY-INTEGRATE-015-v1';
export interface SupplyInfo {
 version:string;source:string;mode:string;profile:string;owner:'GERMAN'|'SOVIET';next:string;seconds:number|null;
 units:{id:string;stock:number;reserve:number;debt:string;effect:{factor:number;cap:number|null;exhausted:boolean}}[];
 ledger:unknown[];receipt:{settled:boolean;charges:{unit:string;cost:number;type:string}[];changes:{id:string;stockBefore:number;stockAfter:number;debtBefore:string;debtAfter:string;removed:boolean}[]}|null;
}
type Packet=Pick<MatchSnapshot,'view'|'model'|'canAct'|'events'|'forcedAction'|'status'|'matchRevision'> & {version:string;supply:SupplyInfo;duplicate?:boolean};
export class SupplyClient implements PlayerTransport {
 readonly state:LobbyState={connection:'CONNECTED',controllerId:null,snapshot:null,room:null,match:null,view:null,pending:false,synced:true,error:null};
 supply:SupplyInfo|null=null;statusText='';private sequence=0;private listeners=new Set<(m:ServerMessage|null)=>void>();private stopped=false;
 private lastAction:Record<string,unknown>|null=null;private uncertain=false;
 get canMutate(){return !this.stopped&&!this.state.pending&&this.state.synced&&!this.uncertain;}
 subscribe(cb:(m:ServerMessage|null)=>void){this.listeners.add(cb);return ()=>this.listeners.delete(cb);}
 private notify(m:ServerMessage|null=null){for(const cb of [...this.listeners])cb(m);}
 private async request(cmd:Record<string,unknown>):Promise<Packet>{
  const r=await fetch('/experiment',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:SUPPLY_VERSION,...cmd}),signal:AbortSignal.timeout(10000)});
  const data=await r.json();if(!r.ok)throw new Error(data.error??'实验请求失败；未提交。');
  if(data.version!==SUPPLY_VERSION||!data.view||!data.model||!data.supply)throw new Error('实验响应版本或视图无效；请重新同步。');
  return data as Packet;
 }
 private snapshot(p:Packet,resync=false):MatchSnapshot {
  this.supply=p.supply;this.state.view=p.view;
  const snapshot:MatchSnapshot={...p,matchId:'supply-hotseat',revision:p.matchRevision,serverSequence:++this.sequence,format:'snapshot-v1',resync};
  this.state.snapshot=snapshot;return snapshot;
 }
 async open(mode:'new'|'old'):Promise<void>{const p=await this.request({op:'open',mode});this.snapshot(p);}
 send<K extends Exclude<keyof ClientPayloads,'HELLO'|'RECONNECT'|'SET_SNAPSHOT_FORMAT'>>(type:K,payload:ClientPayloads[K]):string|null {
  if(type==='LEAVE_ROOM'){void fetch('/experiment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:SUPPLY_VERSION,op:'close'})});return null;}
  if(!this.canMutate)return null;
  const id=crypto.randomUUID();const body=payload as unknown as {expectedRevision:number;draft?:QueryDraft;action?:unknown};
  if(type!=='QUERY_MATCH'&&type!=='SUBMIT_ACTION')return null;
  const cmd={op:type==='QUERY_MATCH'?'query':'action',revision:body.expectedRevision,id,...(body.draft?{draft:body.draft}:{}),...(body.action?{action:body.action}:{})};
  if(type==='SUBMIT_ACTION')this.lastAction=cmd;
  void this.run(cmd,id,type==='QUERY_MATCH');return id;
 }
 private async run(cmd:Record<string,unknown>,id:string,query=false):Promise<void>{
  this.state.pending=true;this.statusText=query?'正在读取授权操作…':'正在真实结算（3秒事务预算）…';
  // Defer notification until NetworkPlayerSession has registered requestId.
  queueMicrotask(()=>this.notify());
  try{
   const p=await this.request(cmd);if(this.stopped)return;if(cmd.op==='switch')this.lastAction=null;this.state.pending=false;this.uncertain=false;
   this.statusText=`${SUPPLY_VERSION} · ${p.supply.mode==='new'?'新补给实验':'旧补给对照'} · 热座 · ${p.canAct?'可操作':'等待交接'}${p.duplicate?' · 重复请求未再次扣费':''}`;
   const snapshot=this.snapshot(p,!query&&(cmd.op!=='action'||Boolean(p.duplicate)));
   const message=query?{messageType:'MATCH_QUERY',payload:{matchId:snapshot.matchId,matchRevision:snapshot.matchRevision,serverSequence:snapshot.serverSequence,model:snapshot.model,forcedAction:snapshot.forcedAction}}:{messageType:'PLAYER_VIEW_SNAPSHOT',payload:snapshot};
   this.notify({protocolVersion:PROTOCOL_VERSION,requestId:id,...message} as ServerMessage);
  }catch(error){
   this.state.pending=false;this.statusText=error instanceof Error&&!(error instanceof TypeError)&&!['AbortError','TimeoutError'].includes(error.name)?error.message:'连接中断，操作结果未知；请用同一编号重试，或重新同步界面。';
   // A lost HTTP response may have committed. Retrying MUST retain the exact id/revision/Action.
   this.uncertain=!query;this.notify({protocolVersion:PROTOCOL_VERSION,requestId:id,messageType:'ROOM_ERROR',payload:{code:'BAD_MESSAGE',message:this.statusText,revision:0}} as ServerMessage);
  }
 }
 resyncMatch():void{if(!this.state.pending)void this.run({op:'open'},crypto.randomUUID());}
 retry():void{if(!this.state.pending&&this.lastAction)void this.run(this.lastAction,String(this.lastAction.id));}
 async switchSide():Promise<void>{
  if(!this.canMutate||!this.supply)return;
  const viewer=this.supply.owner===this.state.view?.viewer?(this.state.view.viewer==='GERMAN'?'SOVIET':'GERMAN'):this.supply.owner;
  await this.run({op:'switch',viewer},crypto.randomUUID());
 }
 async close():Promise<boolean>{
  if(this.state.pending){this.statusText='请求尚未结束，请稍后离开对局。';this.notify();return false;}
  try{const r=await fetch('/experiment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({version:SUPPLY_VERSION,op:'close'}),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('结束对局失败；请稍后重试。');return true;}catch{this.statusText='结束对局失败，请稍后重试；尚未返回入口。';this.notify();return false;}
 }
 dispose(){this.stopped=true;this.listeners.clear();}
}
export function supplyPanel(client:SupplyClient,selected:string|null):string {
 const s=client.supply;if(!s)return '';
 const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const u=s.units.find(u=>u.id===selected),r=s.receipt;
 return `<section class="panel-block" id="supply-experiment-panel"><h3>${s.mode==='new'?'新补给实验':'旧补给对照'} · 热座</h3><p>版本 ${esc(s.version)}，本局不可切换。AI、多人及额外炮兵支援未接通。</p><button id="supply-handoff" class="secondary-action">交给${s.owner==='GERMAN'?'德军':'苏军'}／切换观察方</button><button id="supply-retry" class="secondary-action">重试上次操作（同一编号）</button><button id="supply-sync" class="secondary-action">重新同步界面</button>${u?`<p><strong>${esc(u.id)}</strong>：库存 ${u.stock}；目标储备 ${u.reserve}；欠账 ${esc(u.debt)}。攻击系数 ${u.effect.factor}，移动上限 ${u.effect.cap??'无额外限制'}。攻击还会按实际可支付储备减效。</p>`:'<p>点选本方单位查看库存、储备与欠账。</p>'}<p>${esc(s.next)}。${s.mode==='old'?'旧规则不扣实验库存。':'装甲移动／攻击按原实验结算扣库存。'} 会话30分钟或重启失效，暂无存档。</p>${r?`<details><summary>最近行动与配送变化</summary><p>${r.settled?'已完成回合配送与恢复。':'本次未发生回合配送。'} ${s.seconds===null?'':`结算 ${s.seconds.toFixed(3)} 秒。`}</p>${r.charges.map(c=>`<p>${esc(c.unit)} 行动消耗 ${c.cost}</p>`).join('')}${r.changes.map(c=>`<p>${esc(c.id)} 库存 ${c.stockBefore}→${c.stockAfter}；欠账 ${esc(c.debtBefore)}→${esc(c.debtAfter)}${c.removed?'（单位消灭，库存销毁）':''}</p>`).join('')}</details>`:''}<details><summary>本方实际配送账本／实验参数</summary><p>${esc(s.profile)}；沿用冻结实验参数，未平衡。</p><pre style="white-space:pre-wrap">${esc(JSON.stringify(s.ledger,null,2))}</pre></details></section>`;
}
