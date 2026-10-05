import type {WorkerPort} from '../local-ai/client.js';import type {LocalRequest,LocalReply} from '../local-ai/types.js';
export class GrandPort implements WorkerPort {
 onmessage:WorkerPort['onmessage']=null;onerror:WorkerPort['onerror']=null;data:any=null;notice='';locked=false;selections:Record<string,string>={};
 private token='';private epoch=1;private dead=false;private tail=Promise.resolve();
 constructor(private update:()=>void,private geography:boolean|'terrain'=false){}
 private async api(path:string,body:unknown={}){const r=await fetch('/grand/'+path,{method:'POST',headers:{'Content-Type':'application/json','X-Grand-Session':this.token},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error);return d;}
 private emit(message:any,takeover=false){if(!this.dead)this.onmessage?.({data:{epoch:this.epoch,message,meta:this.data.game.meta,takeover}} as MessageEvent<LocalReply>);}
 private read(d:any,takeover=false){if(this.data&&d.instanceId===this.data.instanceId&&d.version<this.data.version)throw Error('STALE_REPLY');if(this.data?.viewer!==d.viewer)this.selections={};this.data=d;this.emit(d.game.message,takeover);this.update();}
 async operation(operation:any){if(this.locked)return;this.locked=true;this.update();try{this.read(await this.api('action',{id:crypto.randomUUID(),version:this.data.version,operation}));this.notice='已确认：库存、预算与地图为同一版本。';}catch(e){this.notice='未提交：'+String(e);this.read(await this.api('state'));}finally{this.locked=false;this.update();}}
 postMessage(m:LocalRequest){this.tail=this.tail.then(()=>this.handle(m)).catch(e=>{this.notice=String(e);this.onerror?.(new Event('error'));});}
 private async handle(m:LocalRequest){this.epoch=m.epoch;if(m.kind==='START'){const d=await this.api('create',{side:m.options.humanSide,scenario:this.geography==='terrain'?'terrain':this.geography?'geography':'original'});this.token=d.token;this.read(d);return;}
  if(m.kind==='TAKEOVER'){this.read(await this.api('takeover'),true);return;}
  const p=m.payload as any;
  if(m.type==='QUERY_MATCH'){try{this.emit(await this.api('query',{id:m.requestId,version:p.expectedRevision,draft:p.draft}));}catch{this.read(await this.api('state'));}return;}
  if(m.type==='RESYNC_MATCH'){this.read(await this.api('state'));return;}
  if(m.type==='SUBMIT_ACTION'){this.locked=true;try{this.read(await this.api('action',{id:m.requestId,version:p.expectedRevision,action:p.action}));this.notice='行动已由权威规则结算。';}catch(e){this.notice='行动未提交：'+String(e);this.read(await this.api('state'));}finally{this.locked=false;this.update();}}
 }
 terminate(){if(!this.dead){void this.api('close').catch(()=>{});this.dead=true;}}
}
const esc=(x:any)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function grandMarkup(p:GrandPort,selected:string|null):string{
 const d=p.data;if(!d)return '';const blocked=p.locked||d.viewer!==d.owner||!!d.game.message.payload.view.pendingDecision,off=blocked?'disabled':'',options=(role?:string)=>d.warehouses.filter((w:any)=>w.controlled&&(!role||w.role===role)).map((w:any)=>`<option value="${esc(w.id)}">${esc(w.label)} ${w.role==='industry'?'后方':'前线'} P${w.P}/E2 ${w.E2}</option>`).join('');
 const u=d.units.find((u:any)=>u.id===selected);
 return `<section class="panel-block grand-panel"><h3>${esc(d.scenarioLabel??'大战略实验')} · T${d.turn}/24 · E${d.epoch}</h3>${['grand-campaign-002-geography','grand-campaign-003-terrain-naturalization'].includes(d.scenarioId)?'<p>东欧地理启发的原创战区；非1941复原。北↖、东↗。北部林湖与分水岭、中部道路绕行、南部河谷渡口；公式和经济沿用001。</p>':''}<p role="status">${esc(p.notice)} 本次提交${Number(d.ms).toFixed(1)}ms</p><p>双方人工轮流操作；新经济暂无AI。结束本方阶段后，在顶部明确接管另一方。</p><p><b>工业预算 ${d.account.I} I</b>；已训练后备 ${d.account.reserve} P。初始${d.account.initialI}＋收入${d.account.incomeI}−已付${d.account.spentI}。</p>
 <label>生产入库地点<select id="grand-factory">${options('industry')}</select></label><div class="button-row"><button data-grand-product="E2" ${off}>生产2 E2 · 3I · 1周期</button><button data-grand-product="P" ${off}>拨补1 P · 2I · 1周期</button></div><p>每方每T最多2笔。E末完成、下一T可用；仓内每4P每E照管1I，不足则隔离。</p>
 <label>货源<select id="grand-from">${options('industry')}</select></label><label>目的地<select id="grand-to">${options('depot')}</select></label><button id="grand-ship" ${off}>预约前送1P＋2E2 · 8运力</button><p>本E先保可行净维护，再铁路前送，后补储备。到账下一T可用；无余量等待，不扣两次运力。</p>
 ${u?`<p><b>${esc(u.id)} · ${esc(u.army)} · ${esc(u.label)}</b>：储备${u.stock/4}补给点，欠账${u.debt/4}点，维护${u.due/4}点。移动每格0.25点；攻击每次1点。空仓沿用缺供减效，连续3轮少维护损失一步。</p>`:''}
 <label>本方部队定位<select id="grand-unit">${d.units.filter((u:any)=>u.alive).map((u:any)=>`<option value="${esc(u.id)}" ${u.id===selected?'selected':''}>${esc(u.id)} · ${esc(u.label)} · 损伤${u.step}</option>`).join('')}</select></label><button id="grand-focus">定位并选择部队</button><p>恢复须在己方材料仓同格且满足原Core恢复资格：1P＋2E2，RP不参与；每方每T至多6单位。</p>
 <details><summary>订单与货运回执</summary>${d.orders.map((o:any)=>`<p>${esc(o.product)} ${o.qty} · ${esc(({STORED:'已入库',BUILDING:'生产中',WAITING_STORE:'等待仓容'} as Record<string,string>)[o.status]??o.status)} · E${o.completeEpoch} · ${esc(o.id.slice(-8))}</p>`).join('')}${d.shipments.map((s:any)=>`<p>${s.P}P＋${s.E2}E2 · ${esc(({QUEUED:'等待发运',DELIVERED:'已到账',CANCELLED:'已取消'} as Record<string,string>)[s.status]??s.status)} ${s.availableTurn?'T'+s.availableTurn+'可用':''}${s.status==='QUEUED'?`<button data-grand-cancel="${esc(s.id)}">取消预约</button>`:''}</p>`).join('')}</details>
 <details><summary>仓储与下一T库存</summary>${d.warehouses.map((w:any)=>`<p>${esc(w.label)} ${w.controlled?'己方服务':'失去服务'}：可用${w.P}P＋${w.E2}E2；总占用${w.lots.reduce((n:number,l:any)=>n+l.qty,0)}/${w.capacity}</p>`).join('')}</details>
 <details><summary>战略地点与最近结算</summary><p>E24按当时控制计VP，平分和局。工业/交通收益每E仅一次，反复易手不即时发钱。</p>${d.objectives.map((n:any)=>`<p>${esc(n.label)}：${n.vp}VP，${n.incomeI}I/E；补给源${n.sourceQ/4}点/E · ${esc(n.control??'未确认')}</p>`).join('')}<pre>${esc(JSON.stringify(d.lastLedger,null,1))}</pre></details></section>`;
}
export function bindGrand(p:GrandPort){for(const id of ['grand-factory','grand-from','grand-to']){const el=document.querySelector<HTMLSelectElement>('#'+id);if(el){if(p.selections[id])el.value=p.selections[id]!;el.addEventListener('change',()=>{p.selections[id]=el.value;});}}const value=(id:string)=>(document.querySelector(id) as HTMLSelectElement)?.value;
 document.querySelectorAll<HTMLElement>('[data-grand-product]').forEach(b=>b.addEventListener('click',()=>void p.operation({type:'ORDER',product:b.dataset.grandProduct,warehouse:value('#grand-factory')})));
 document.querySelector('#grand-ship')?.addEventListener('click',()=>void p.operation({type:'SHIP',from:value('#grand-from'),to:value('#grand-to'),P:1,E2:2}));
 document.querySelectorAll<HTMLElement>('[data-grand-cancel]').forEach(b=>b.addEventListener('click',()=>void p.operation({type:'CANCEL_SHIPMENT',id:b.dataset.grandCancel})));
}
