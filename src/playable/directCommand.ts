import type {GrandPort} from './grand.js';
import {escStatus as esc} from './unitStatus.js';

export type DirectDraft={unit:string;kind:string;target:{q:number;r:number}|null;generation:number;instance:string;revision:number};
const labels:Record<string,string>={ADVANCE:'移动',ATTACK:'攻击',SUPPORT:'支援',RETREAT:'撤回'};
const distance=(a:any,b:any)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
/** Presentation checks use only the already-authorized document. The server remains the final arbiter. */
export function directIssue(p:GrandPort,d:DirectDraft):string {
 const c=p.data.continuous,u=c.units[d.unit],view=p.data.game.message.payload.view;
 if(d.instance!==p.data.instanceId)return '战役已重新载入，请重新选择命令';
 if(!u?.alive)return '该部队已不可用';
 if(d.generation!==u.commandGeneration)return '部队控制或命令已改变，请重新选择命令';
 if(c.ended)return '战役已结束';
 if(p.locked)return '连接尚未恢复，等待授权状态';
 if(!d.target)return '点选地图目的地；拖动和缩放不会下令';
 if(['ATTACK','SUPPORT'].includes(d.kind)){
  if(distance(u.hex,d.target)!==1)return '攻击和支援须与目标相邻';
  if(!view.units.some((e:any)=>e.side!==view.viewer&&distance(e.hex,d.target)===0))return '目标没有当前已识别敌军';
  const b=c.map.battles.find((b:any)=>b.status!=='ENDED'&&distance(b.hex,d.target)===0);
  if(d.kind==='SUPPORT'&&!b)return '支援须指向一场正在进行的战斗';
  if(b?.eligibilityReasons?.[d.unit])return b.eligibilityReasons[d.unit];
 }
 if(!p.directPreview)return '正在读取授权路线预览';
 if(p.directPreview.version!==p.data.version)return '局势已更新，请刷新预览后确认';
 if(p.directPreview.reason)return p.directPreview.reason;
 return '';
}
export function directCommand(p:GrandPort,id:string){
 const c=p.data.continuous,u=c.units[id];if(!u)return '';
 const g=c.corps.find((g:any)=>g.members.includes(id)),direct=!!u.direct||!g,d=p.directDraft?.unit===id?p.directDraft:null;
 const busy=p.wire&&Array.from(p.wire.pending.values()).some((r:any)=>r.command?.payload?.operation?.unit===id||r.command?.payload?.unit===id);
 const issue=d?directIssue(p,d):'',disabled=p.locked||c.ended||busy;
 return `<section class="direct-command" aria-label="所选部队命令"><b>${esc(id)} · ${direct?'◇ 直属':'由 '+esc(g.name)+' 指挥'}</b><p>${c.paused?'世界暂停；合法命令将在继续时间后执行。':'命令确认后按真实时间执行。'}</p>${!direct?`<button id="direct-takeover" ${disabled?'disabled':''}>接管并停止主动命令</button>`:''}<div class="direct-actions">${Object.entries(labels).map(([k,v])=>`<button data-direct-kind="${k}" aria-pressed="${d?.kind===k}" ${disabled?'disabled':''}>${v}</button>`).join('')}<button id="direct-stop" ${disabled?'disabled':''}>停止／待命</button></div>${!direct?'<small>向本队确认命令会接管该队，军官不再覆盖它。</small>':''}${d?`<div class="direct-preview" role="status"><strong>${esc(labels[d.kind])}预览 · ${d.target?`${d.target.q},${d.target.r}`:'选择目的地'}</strong><p>${esc(issue|| (d.kind==='SUPPORT'?'参与相邻战斗，支援结束不自动跟进。':d.kind==='ATTACK'?'攻击已识别目标；实际投入由权威规则复核。':'方向预览；实际逐格路径由现有规划器决定，未知通路不保证安全。'))}</p>${p.directPreview?.path?.length?`<small>路径 ${p.directPreview.path.map((h:any)=>h.q+','+h.r).join(' → ')}<br>${esc(p.directPreview.label)}</small>`:''}<button id="direct-preview-refresh">重新预览</button><button id="direct-confirm" ${issue||disabled?'disabled':''}>确认${esc(labels[d.kind])}</button><button id="direct-cancel">取消点选</button></div>`:''}${busy?'<p role="status">本队命令待确认；仍可拖图和查看其他部队。</p>':''}<label>交给军官<select id="direct-corps">${c.corps.map((x:any)=>`<option value="${esc(x.id)}" ${x.id===g?.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><button id="direct-delegate" ${disabled?'disabled':''}>交回所选军官</button><small>停止主动命令不等于安全脱离；敌方攻击继续生效。</small></section>`;
}
export function bindDirectCommand(p:GrandPort,id:string|null,refresh:()=>void,pick:(active?:boolean)=>void){
 if(!id||!p.data.continuous.units[id])return;
 const u=p.data.continuous.units[id],run=(op:any)=>void p.operation(op);
 const cancel=()=>{p.directDraft=null;p.directPreview=null;pick(false);refresh();};
 document.querySelectorAll<HTMLElement>('[data-direct-kind]').forEach(el=>el.onclick=()=>{p.directDraft={unit:id,kind:el.dataset.directKind!,target:null,generation:u.commandGeneration,instance:p.data.instanceId,revision:p.data.version};pick();});
 document.getElementById('direct-preview-refresh')?.addEventListener('click',()=>{p.requestDirectPreview();refresh();});
 document.getElementById('direct-cancel')?.addEventListener('click',cancel);
 for(const key of ['direct-stop','direct-takeover'])document.getElementById(key)?.addEventListener('click',()=>{cancel();run({type:'DIRECT',unit:id,order:{kind:'HOLD',target:u.hex,risk:'LOW',paused:true}});});
 document.getElementById('direct-confirm')?.addEventListener('click',()=>{const d=p.directDraft;if(!d||d.unit!==id)return;const issue=directIssue(p,d);if(issue){p.notice=issue;refresh();return;}const b=p.data.continuous.map.battles.find((b:any)=>distance(b.hex,d.target)===0);cancel();run({type:'DIRECT',unit:id,...(d.kind==='SUPPORT'?{battleId:b.id}:{}),order:{kind:d.kind,target:d.target,risk:'NORMAL',paused:false}});});
 document.getElementById('direct-delegate')?.addEventListener('click',()=>{const group=(document.getElementById('direct-corps') as HTMLSelectElement).value;cancel();run({type:'ASSIGN',unit:id,group});});
}
