import {campaignEconomy} from './campaign.js';
import {uxMarkup,bindUx} from './grandUx.js';
import type {WorkerPort} from '../local-ai/client.js';import type {LocalRequest,LocalReply} from '../local-ai/types.js';
export class GrandPort implements WorkerPort {
 onmessage:WorkerPort['onmessage']=null;onerror:WorkerPort['onerror']=null;data:any=null;notice='';locked=false;selections:Record<string,string>={};
 officerUnit='';officerGroup='0';officerKind='ATTACK';officerTarget:{q:number;r:number}|null=null;officerNotice='';
 private timer:ReturnType<typeof setTimeout>|null=null;private busy:Promise<void>|null=null;private configTail=Promise.resolve();private configs=0;private halted=false;private idle='';private generation=0;private preserve=false;
 private token='';private epoch=1;private dead=false;private tail=Promise.resolve();
 private poll:ReturnType<typeof setTimeout>|null=null;
 constructor(private update:()=>void, public continuous=false){}
 async campaignFile(kind:'save'|'load'){if(this.locked)return;this.locked=true;this.update();try{const d=await this.api(kind);if(kind==='load'){this.data=null;this.read(d);}this.notice=kind==='save'?'已保存到本机磁盘，关闭服务后仍可加载。':'已加载，时间暂停。';}catch(e){this.notice='存档操作失败：'+e;}finally{this.locked=false;}this.update();}
 private startPoll(){if(!this.continuous||this.dead)return;this.poll=setTimeout(async()=>{try{if(!this.locked){const d=await this.api('state');if(!this.data||d.version!==this.data.version)this.read(d);}}catch{this.notice='本机服务断开；已保存的战役可在重启后加载。';this.update();}this.startPoll();},1000);}
 private async api(path:string,body:unknown={}){const r=await fetch('/grand/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Grand-Session':this.token},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 private emit(message:any,takeover=false){if(!this.dead)this.onmessage?.({data:{epoch:this.epoch,message,meta:this.data.game.meta,takeover}} as MessageEvent<LocalReply>);}
 private read(d:any,takeover=false){if(this.data&&d.instanceId===this.data.instanceId&&d.version<this.data.version)throw Error('STALE_REPLY');if(this.data?.viewer===d.viewer&&d.officers?.revision<this.data.officers?.revision)return;if(this.data?.viewer!==d.viewer){this.selections={};this.officerTarget=null;this.officerGroup='0';this.officerUnit='';this.halted=true;}this.data=d;this.emit(d.game.message,takeover);this.update();this.schedule();}
 private pendingKey(){return 'grand-pending:'+this.token;}
 async reconcile(){const raw=sessionStorage.getItem(this.pendingKey());if(!raw)return;const pending=JSON.parse(raw);this.locked=true;this.update();
  try{const r=await this.api('receipt',{id:pending.request.id});if(r.instanceId!==pending.instanceId)throw Error('INSTANCE_CHANGED');if(!r.receipt&&r.status!=='REJECTED')throw Error('RESULT_UNKNOWN');pending.rejected=r.status==='REJECTED';sessionStorage.setItem(this.pendingKey(),JSON.stringify(pending));if(r.receipt){pending.confirmedVersion=r.receipt.version;sessionStorage.setItem(this.pendingKey(),JSON.stringify(pending));}
   this.notice=pending.confirmedVersion!==undefined?'已确认提交；正在读取账本。':'正在核对请求与账本。';const d=await this.api('state');if(d.instanceId!==pending.instanceId||d.version<(pending.confirmedVersion??pending.request.version))throw Error('STALE_LEDGER');this.read(d);sessionStorage.removeItem(this.pendingKey());this.notice=r.receipt?'已提交，账本已更新。':'服务端确认未提交，账本已更新。';this.locked=false;
  }catch(e){this.notice=pending.confirmedVersion!==undefined?'已确认提交，账本尚未刷新；业务操作已锁定，请核对账本。':pending.rejected?'已确认未提交，账本尚未刷新；业务操作已锁定。':'结果待确认，业务操作已锁定；按原请求核对，不重新下单。';}
  this.update();this.schedule();
 }
 async retryPending(){const raw=sessionStorage.getItem(this.pendingKey());if(!raw)return;const p=JSON.parse(raw);if(p.confirmedVersion!==undefined||p.rejected){await this.reconcile();return;}this.locked=false;await this.submitBound(p.request);}
 private async submitBound(request:any){if(this.locked)return;this.locked=true;const pending={instanceId:this.data.instanceId,request} as any;sessionStorage.setItem(this.pendingKey(),JSON.stringify(pending));this.update();
  try{const d=await this.api('action',request);pending.confirmedVersion=d.receipt.version;sessionStorage.setItem(this.pendingKey(),JSON.stringify(pending));if(d.instanceId!==pending.instanceId||d.version<pending.confirmedVersion)throw Error('STALE_LEDGER');this.read(d);sessionStorage.removeItem(this.pendingKey());this.notice='已提交，账本已更新。';this.locked=false;
  }catch{await this.reconcile();}this.update();this.schedule();
 }
 async operation(operation:any){await this.submitBound({id:crypto.randomUUID(),version:this.data.version,operation});}

 postMessage(m:LocalRequest){this.tail=this.tail.then(()=>this.handle(m)).catch(e=>{this.notice=String(e);this.onerror?.(new Event('error'));});}
 private async handle(m:LocalRequest){this.epoch=m.epoch;if(m.kind==='START'){this.token=sessionStorage.getItem((this.continuous?'grand-play-session':'grand-officer-session'))??'';const d=await this.api('create',{side:m.options.humanSide,resume:!!this.token,mode:this.continuous?'continuous':'legacy'});this.token=d.token;sessionStorage.setItem((this.continuous?'grand-play-session':'grand-officer-session'),this.token);this.read(d);this.startPoll();if(sessionStorage.getItem(this.pendingKey()))await this.reconcile();return;}
  if(m.kind==='TAKEOVER'){this.stopDispatch();await this.api('takeover');if(this.busy)await this.busy;this.read(await this.api('state'),true);return;}
  const p=m.payload as any;
  if(m.type==='QUERY_MATCH'){try{this.emit(await this.api('query',{id:m.requestId,version:p.expectedRevision,draft:p.draft}));}catch{this.read(await this.api('state'));}return;}
  if(m.type==='RESYNC_MATCH'){this.read(await this.api('state'));return;}
  if(m.type==='SUBMIT_ACTION')await this.submitBound({id:m.requestId,version:p.expectedRevision,action:p.action});
 }
 private stopDispatch(){this.generation++;this.halted=true;if(this.timer)clearTimeout(this.timer);this.timer=null;}
 async officerBeginTarget(){this.stopDispatch();if(this.busy)await this.busy;}
 preserveOnUnload(){this.preserve=true;}
 officerChoose(g:string){this.officerGroup=g;this.update();}
 officerOrderTarget(h:{q:number;r:number}){this.officerTarget={...h};this.update();}
 officerConfig(command:any){this.stopDispatch();this.configs++;const work=this.configTail.then(async()=>{try{this.read(await this.api('officer-config',{revision:this.data.officers.revision,command}));if(this.busy)await this.busy;this.read(await this.api('state'));this.halted=false;this.idle='';this.officerNotice='授权已更新，已支付资源和待决完整保留。';}catch(e){this.officerNotice='授权未确认，已停止：'+e;}});this.configTail=work.catch(()=>{});return work.finally(()=>{this.configs--;this.update();this.schedule();});}
 private schedule(){if(this.continuous)return;const d=this.data,o=d?.officers,key=`${d?.viewer}:${d?.version}:${o?.revision}`;if(this.dead||this.locked||this.halted||this.configs||this.timer||this.busy||key===this.idle||d?.owner!==d?.viewer||!o?.enabled||!o.groups.some((g:any)=>g.order&&!g.paused&&g.members.length))return;const generation=this.generation;this.timer=setTimeout(()=>{this.timer=null;if(generation!==this.generation||this.dead||this.locked)return;this.busy=this.tickOfficer().finally(()=>{this.busy=null;this.schedule();});},350);}
 private async tickOfficer(){this.locked=true;this.officerNotice='军官处理中；可暂停，已提交动作等待结果。';this.update();try{const d=await this.api('officer-tick',{id:crypto.randomUUID(),version:this.data.version,revision:this.data.officers.revision});this.read(d);this.officerNotice=d.officerResult.ok?'军官行动已确认。':d.officerResult.reason;if(!d.officerResult.ok&&!d.officerResult.retryOthers)this.idle=`${d.viewer}:${d.version}:${d.officers.revision}`;this.locked=false;}catch(e){this.halted=true;this.officerNotice='结果待确认；自动提交停止：'+e;try{this.read(await this.api('state'));this.locked=false;}catch{this.locked=true;}}this.update();}
 terminate(){if(this.poll)clearTimeout(this.poll);if(!this.dead){this.stopDispatch();if(!this.preserve){void this.api('close').catch(()=>{});sessionStorage.removeItem((this.continuous?'grand-play-session':'grand-officer-session'));}this.dead=true;}}
}
const esc=(x:any)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function grandMarkup(p:GrandPort,selected:string|null):string{
 const d=p.data;if(!d)return '';if(p.continuous)return campaignEconomy(p,selected);if(d.ux)return uxMarkup(p,selected);const blocked=p.locked||d.viewer!==d.owner||!!d.game.message.payload.view.pendingDecision,off=blocked?'disabled':'',options=(role?:string)=>d.warehouses.filter((w:any)=>w.controlled&&(!role||w.role===role)).map((w:any)=>`<option value="${esc(w.id)}">${esc(w.label)} ${w.role==='industry'?'后方':'前线'} P${w.P}/E2 ${w.E2}</option>`).join('');
 const u=d.units.find((u:any)=>u.id===selected);
 return `<section class="panel-block grand-panel"><h3>大战略实验 · T${d.turn}/24 · E${d.epoch}</h3><p role="status">${esc(p.notice)} 本次提交${Number(d.ms).toFixed(1)}ms</p><p>统帅待办：铁路、生产下单、共享运输、全军结束阶段。军官仅执行明确委托；经济选择仍人工确认。结束本方阶段后，在顶部明确接管另一方。</p><p><b>工业预算 ${d.account.I} I</b>；已训练后备 ${d.account.reserve} P。初始${d.account.initialI}＋收入${d.account.incomeI}−已付${d.account.spentI}。</p>
 <label>生产入库地点<select id="grand-factory">${options('industry')}</select></label><div class="button-row"><button data-grand-product="E2" ${off}>生产2 E2 · 3I · 1周期</button><button data-grand-product="P" ${off}>拨补1 P · 2I · 1周期</button></div><p>每方每T最多2笔。E末完成、下一T可用；仓内每4P每E照管1I，不足则隔离。</p>
 <label>货源<select id="grand-from">${options('industry')}</select></label><label>目的地<select id="grand-to">${options('depot')}</select></label><button id="grand-ship" ${off}>预约前送1P＋2E2 · 8运力</button><p>本E先保可行净维护，再铁路前送，后补储备。到账下一T可用；无余量等待，不扣两次运力。</p>
 ${u?`<p><b>${esc(u.id)} · ${esc(u.army)} · ${esc(u.label)}</b>：储备${u.stock/4}补给点，欠账${u.debt/4}点，维护${u.due/4}点。移动每格0.25点；攻击每次1点。空仓沿用缺供减效，连续3轮少维护损失一步。</p>`:''}
 <label>本方部队定位<select id="grand-unit">${d.units.filter((u:any)=>u.alive).map((u:any)=>`<option value="${esc(u.id)}" ${u.id===selected?'selected':''}>${esc(u.id)} · ${esc(u.label)} · 损伤${u.step}</option>`).join('')}</select></label><button id="grand-focus">定位并选择部队</button><p>恢复须在己方材料仓同格且满足原Core恢复资格：1P＋2E2，RP不参与；每方每T至多6单位。</p>
 <details><summary>订单与货运回执</summary>${d.orders.map((o:any)=>`<p>${esc(o.product)} ${o.qty} · ${esc(({STORED:'已入库',BUILDING:'生产中',WAITING_STORE:'等待仓容'} as Record<string,string>)[o.status]??o.status)} · E${o.completeEpoch} · ${esc(o.id.slice(-8))}</p>`).join('')}${d.shipments.map((s:any)=>`<p>${s.P}P＋${s.E2}E2 · ${esc(({QUEUED:'等待发运',DELIVERED:'已到账',CANCELLED:'已取消'} as Record<string,string>)[s.status]??s.status)} ${s.availableTurn?'T'+s.availableTurn+'可用':''}${s.status==='QUEUED'?`<button data-grand-cancel="${esc(s.id)}">取消预约</button>`:''}</p>`).join('')}</details>
 <details><summary>仓储与下一T库存</summary>${d.warehouses.map((w:any)=>`<p>${esc(w.label)} ${w.controlled?'己方服务':'失去服务'}：可用${w.P}P＋${w.E2}E2；总占用${w.lots.reduce((n:number,l:any)=>n+l.qty,0)}/${w.capacity}</p>`).join('')}</details>
 <details><summary>战略地点与最近结算</summary><p>E24按当时控制计VP，平分和局。工业/交通收益每E仅一次，反复易手不即时发钱。</p>${d.objectives.map((n:any)=>`<p>${esc(n.label)}：${n.vp}VP，${n.incomeI}I/E；补给源${n.sourceQ/4}点/E · ${esc(n.control??'未确认')}</p>`).join('')}<pre>${esc(JSON.stringify(d.lastLedger,null,1))}</pre></details></section>`;
}
export function bindGrand(p:GrandPort){if(p.data?.ux){bindUx(p);return;}for(const id of ['grand-factory','grand-from','grand-to']){const el=document.querySelector<HTMLSelectElement>('#'+id);if(el){if(p.selections[id])el.value=p.selections[id]!;el.addEventListener('change',()=>{p.selections[id]=el.value;});}}const value=(id:string)=>(document.querySelector(id) as HTMLSelectElement)?.value;
 document.querySelectorAll<HTMLElement>('[data-grand-product]').forEach(b=>b.addEventListener('click',()=>void p.operation({type:'ORDER',product:b.dataset.grandProduct,warehouse:value('#grand-factory')})));
 document.querySelector('#grand-ship')?.addEventListener('click',()=>void p.operation({type:'SHIP',from:value('#grand-from'),to:value('#grand-to'),P:1,E2:2}));
 document.querySelectorAll<HTMLElement>('[data-grand-cancel]').forEach(b=>b.addEventListener('click',()=>void p.operation({type:'CANCEL_SHIPMENT',id:b.dataset.grandCancel})));
}
