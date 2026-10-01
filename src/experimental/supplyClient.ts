/** Same-origin hotseat transport. No WebSocket, full Core state, RNG or local apply. */
import type {PlayerTransport} from '../multiplayer/networkSession.js';
import type {LobbyState} from '../multiplayer/client.js';
import type {ServerMessage,ClientPayloads} from '../multiplayer/protocol.js';
import {PROTOCOL_VERSION} from '../multiplayer/protocol.js';
import type {MatchSnapshot,QueryDraft} from '../multiplayer/gameplayProtocol.js';
export const SUPPLY_VERSION='SUPPLY-INTEGRATE-015-v1';
export interface SupplyPreview {
 revision:number;draft:QueryDraft|null;
 rows:{id:string;type:'MOVE'|'ATTACK'|'SCHWERPUNKT_ATTACK';stock:number;cost:number;after:number;debt:string;debtInventory:number;debtFactor:number;attackFactor:number|null}[];
}
interface SupplyLedger {
 units:{id:string;before:number;received:number;maintenance:number;due:number;after:number;debt:string;debtInventory:number;loss:number;reason:string}[];
 hubs:Record<string,number>;
 flows:{hub:string;unit:string;edges:string[];q:number;cost:number}[];
}
export interface SupplyInfo {
 version:string;source:string;mode:string;profile:string;owner:'GERMAN'|'SOVIET';next:string;seconds:number|null;
 units:{id:string;stock:number;reserve:number;debt:string;maintenance:number;debtInventory:number;effect:{factor:number;cap:number|null;exhausted:boolean}}[];
 preview:SupplyPreview;
 ledger:SupplyLedger[];receipt:{settled:boolean;charges:{unit:string;cost:number;type:string}[];changes:{id:string;stockBefore:number;stockAfter:number;debtBefore:string;debtAfter:string;debtInventoryBefore:number;debtInventoryAfter:number;removed:boolean}[]}|null;
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
   if(this.supply)this.supply={...this.supply,preview:{...this.supply.preview,draft:null,rows:[]}};
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
/** Raw ledger integers remain authoritative; quarter points are exact in binary. */
export function supplyPoints(value:number):string {return Number.isSafeInteger(value)?`${value/4}补给点`:'未知';}
export function supplyPanel(client:SupplyClient,selected:string|null,draft:QueryDraft):string {
 const s=client.supply;if(!s)return '';
 const esc=(v:unknown)=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
 const pct=(v:number)=>`${v*100}%`,u=s.units.find(u=>u.id===selected),r=s.receipt;
 const fresh=client.canMutate&&s.preview?.revision===client.state.snapshot?.matchRevision&&JSON.stringify(s.preview.draft)===JSON.stringify(draft);
 const rows=fresh?s.preview.rows:[];
 const quote=s.mode==='old'?'<p>旧规则对照：不扣实验库存，不套用新补给的欠账或支付系数。</p>':`<h4>所选行动 · 只读预览</h4>${rows.length?rows.map(row=>`<p><strong>${esc(row.id)} · ${row.type==='MOVE'?'移动':row.type==='ATTACK'?'攻击':'第二次攻击（此单位按钮）'}</strong><br>储备 ${supplyPoints(row.stock)} − 本次消耗 ${supplyPoints(row.cost)} → 扣费后 ${supplyPoints(row.after)}<br>欠账折合 ${supplyPoints(row.debtInventory)}（D=${esc(row.debt)}维护份），欠账系数 ${pct(row.debtFactor)}${row.attackFactor===null?'':`<br><strong>本次攻击有效补给系数 ${pct(row.attackFactor)}</strong>`}</p>`).join(''):'<p>预计费用、行动后储备、攻击有效系数：未知。请选本方单位及完整移动路径／攻击目标；未同步或当前不能行动时不提供预览。</p>'}<p>若行动被接受，按上述费用扣仓；这里的“扣费后”不含战损或未来配送。攻击先按扣费前储备与欠账取较低系数，再扣费；单体攻击力向上取整，其他战斗修正另计。联攻逐单位支付，第二次攻击单独支付。</p>`;
 const ledger=s.ledger.map(l=>`${l.units.map(v=>`<p><strong>${esc(v.id)}</strong>：配送前 ${supplyPoints(v.before)} ＋ 实收 ${supplyPoints(v.received)} − 维护 ${supplyPoints(v.maintenance)}（应付 ${supplyPoints(v.due)}）＝配送后 ${supplyPoints(v.after)}；欠账折合 ${supplyPoints(v.debtInventory)}（D=${esc(v.debt)}维护份）；损失 ${v.loss}阶。${esc(v.reason)}</p>`).join('')}${Object.entries(l.hubs).map(([id,n])=>`<p>${esc(id)} 枢纽结余 ${supplyPoints(n)}</p>`).join('')}${l.flows.map(f=>`<p>已公开实送：${esc(f.hub)} → ${esc(f.unit)}，${supplyPoints(f.q)}；路径 ${esc(f.edges.join(' → '))}</p>`).join('')}`).join('');
 return `<section class="panel-block" id="supply-experiment-panel"><h3>${s.mode==='new'?'新补给实验':'旧补给对照'} · 热座</h3><p>4库存单位＝1补给点；最小差异为0.25补给点。版本 ${esc(s.version)}，本局不可切换。AI、多人及额外炮兵支援未接通。</p><button id="supply-handoff" class="secondary-action">交给${s.owner==='GERMAN'?'德军':'苏军'}／切换观察方</button><button id="supply-retry" class="secondary-action">重试上次操作（同一编号）</button><button id="supply-sync" class="secondary-action">重新同步界面</button>${u?`<p><strong>${esc(u.id)}</strong>：当前储备 ${supplyPoints(u.stock)}；目标储备 ${supplyPoints(u.reserve)}。${s.mode==='new'?`<br>欠账折合 ${supplyPoints(u.debtInventory)}（D=${esc(u.debt)}维护份；每份 ${supplyPoints(u.maintenance)}）。当前欠账系数 ${pct(u.effect.factor)}；移动上限 ${u.effect.cap??'无额外限制'}。`:''}</p>${s.mode==='new'&&u.debt==='0'&&u.stock<4?'<p><strong>欠账已清，但储备不足1补给点；维护恢复不等于补足攻击储备，下一击仍按可支付储备减效。</strong></p>':''}`:'<p>点选本方单位查看储备与欠账。</p>'}${quote}<p>${esc(s.next)}。${s.mode==='new'?'攻击及装甲／摩托化普通移动每单位最多消耗1补给点，其他单位普通移动不扣补给点。未来配送量未知，无法据此推断隐藏运输阻挡。':''} 会话30分钟或重启失效，暂无存档。</p>${r?`<details><summary>最近行动与配送变化</summary><p>${r.settled?'已完成回合配送、维护与恢复。':'本次未发生回合配送。'} ${s.seconds===null?'':`结算 ${s.seconds.toFixed(3)} 秒。`}</p>${r.charges.map(c=>`<p>${esc(c.unit)} 行动消耗 ${supplyPoints(c.cost)}</p>`).join('')}${r.changes.map(c=>`<p>${esc(c.id)} 储备 ${supplyPoints(c.stockBefore)} → ${supplyPoints(c.stockAfter)}；欠账折合 ${supplyPoints(c.debtInventoryBefore)} → ${supplyPoints(c.debtInventoryAfter)}${c.removed?'（单位消灭，库存销毁）':''}</p>`).join('')}</details>`:''}<details><summary>本方已结算配送账本／实验参数</summary><p>${esc(s.profile)}；沿用冻结实验参数，未平衡。欠账D是维护份额，折合补给点仅便于理解，不额外扣这笔库存；实际收货不能保证下轮配送。</p>${ledger||'<p>暂无已结算配送。</p>'}</details></section>`;
}
