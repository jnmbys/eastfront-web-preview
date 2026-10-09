import type {GrandPort} from './grand.js';
import {escStatus as esc} from './unitStatus.js';
export type DirectDraft={unit:string;kind:string;target:{q:number;r:number}|null;generation:number;instance:string;revision:number;groupId?:string;groupGeneration?:number;requestId?:string;error?:string};
export const directLabels:Record<string,string>={ADVANCE:'移动',ATTACK:'攻击',SUPPORT:'支援',RETREAT:'撤回'};
export function directExecutionStatus(p:GrandPort,id:string){
 const u=p.data.continuous.units[id],pending=Array.from(p.wire?.pending.values()??[]).find((r:any)=>r.command?.payload?.unit===id) as any;
 if(pending)return pending.status==='queued'?'等待前一命令确认':'命令待确认';
 const feedback=p.directFeedback[id];if(feedback&&!feedback.startsWith('已接受'))return feedback;
 if(u.march){const m=u.march;return `行军至 ${m.to.q},${m.to.r} · 当前路段 ${Math.round(100*(m.total-m.remaining)/m.total)}% · 还需 ${m.remaining*5} 游戏分钟`;}
 if(u.direct?.paused)return '手动驻守；恢复军团计划后继续';
 if(u.direct)return !u.reason||u.reason==='直属或命令暂停'?'等待下一模拟步执行手动任务':u.reason;
 const idle=p.data.continuous.corps.find((g:any)=>g.members.includes(id))?.order.paused?'军官暂停，可直接下令':'等待下一时间步恢复军团任务';
 const last=[...(p.wire?.history??[])].reverse().find((r:any)=>r.status==='applied'&&r.command?.payload?.mapIntent&&r.command.payload.unit===id);
 if(last){const target=last.command.payload.order.target,at=u.hex.q===target.q&&u.hex.r===target.r;return `${at?'手动任务已完成':u.commandGeneration>last.command.dependencies.unitGeneration+1?'旧手动命令已被替换':'已恢复军团计划'} · ${u.reason==='直属或命令暂停'?idle:u.reason??''}`;}
 return u.reason==='直属或命令暂停'?idle:u.reason??'等待军团计划';
}
const distance=(a:any,b:any)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export function makeDirectDraft(p:GrandPort,id:string,kind:string,target:any=null):DirectDraft{const c=p.data.continuous,u=c.units[id],g=c.corps.find((g:any)=>g.members.includes(id));return {unit:id,kind,target,generation:u.commandGeneration,instance:p.data.instanceId,revision:p.data.version,...(!u.direct&&g?{groupId:g.permanentId,groupGeneration:g.commandGeneration}:{})};}
export function chooseDirectTarget(p:GrandPort,id:string,target:any){
 const d=p.directDraft,view=p.data.game.message.payload.view,enemy=view.units.some((u:any)=>u.side!==view.viewer&&distance(u.hex,target)===0);
 const kind=d?.unit===id&&['SUPPORT','RETREAT'].includes(d.kind)?d.kind:enemy?'ATTACK':'ADVANCE';
 if(d?.requestId&&d.unit===id)return;
 if(d?.unit===id&&!d.error&&d.generation===p.data.continuous.units[id].commandGeneration&&d.kind===kind&&d.target&&distance(d.target,target)===0)return;
 p.directDraft=makeDirectDraft(p,id,kind,{...target});p.directPreview=null;const issue=directIssue(p,p.directDraft);if(issue){p.directDraft.error=issue;p.directFeedback[id]=issue;}else p.submitDirectIntent(p.directDraft);
}
export function directIssue(p:GrandPort,d:DirectDraft):string{
 const c=p.data.continuous,u=c.units[d.unit],view=p.data.game.message.payload.view;
 if(d.instance!==p.data.instanceId)return '战役已重新载入，请重新选择命令';
 if(!u?.alive)return '该部队已不可用';
 if(d.generation!==u.commandGeneration)return '部队控制或命令已改变，请重新选择';
 if(d.groupId){const g=c.corps.find((g:any)=>g.permanentId===d.groupId);if(!g||g.commandGeneration!==d.groupGeneration||!g.members.includes(d.unit)||u.direct)return '军团命令或部队归属已改变，请重新选择';}
 if(c.ended)return '战役已结束';if(p.locked)return '连接尚未恢复';if(d.requestId)return '命令等待确认';if(d.error)return d.error;
 if(!d.target)return '点地图目标';
 const enemy=view.units.some((e:any)=>e.side!==view.viewer&&distance(e.hex,d.target)===0);
 if(d.kind==='ADVANCE'&&enemy)return '目的地出现已识别敌军，请重新点目标下达攻击';
 if(['ATTACK','SUPPORT'].includes(d.kind)){
  if(distance(u.hex,d.target)!==1)return '攻击或支援须与目标相邻';if(!enemy)return '目标已无已识别敌军；原攻击意图保留，请重新选择';
  const b=c.map.battles.find((b:any)=>b.status!=='ENDED'&&distance(b.hex,d.target)===0);
  if(d.kind==='SUPPORT'&&!b)return '该处交战已经结束，不能继续支援';
  if(b?.eligibilityReasons?.[d.unit])return b.eligibilityReasons[d.unit];
 }
 // A preview is advisory. Unrelated world revisions are not command dependencies.
 // The server rechecks the current authorized route and combat conditions atomically.
 // Route preview is optional. Acceptance still validates the intent against current authority.
 if(!p.directPreview)return '';
 if(p.directPreview.version===p.data.version&&p.directPreview.reason)return p.directPreview.reason;
 return '';
}
export function directCommand(p:GrandPort,id:string){
 const c=p.data.continuous,u=c.units[id];if(!u||!p.selections['map-command'])return '';
 const g=c.corps.find((g:any)=>g.members.includes(id)),d=p.directDraft?.unit===id?p.directDraft:null;
 const busy=Array.from(p.wire?.pending.values()??[]).some((r:any)=>r.command?.payload?.unit===id),disabled=p.locked||c.ended||busy;
 const inspect=p.selections['map-command']==='inspect',friend=p.friendlyTarget;
 return `<section class="map-command-strip" aria-label="地图指挥"><div class="map-command-heading"><b>${esc(id)} · ${esc(g?.name??'独立部队')} · ${u.direct?'手动任务':'军团计划'}</b><span>${esc(directExecutionStatus(p,id))}${c.paused?' · 继续时间后执行':''}</span></div><div class="map-command-actions">${friend?.source===id?`<strong>友军格 ${friend.hex.q},${friend.hex.r}</strong>${friend.members.map((k:string)=>`<button data-friendly-select="${esc(k)}">选择 ${esc(k)}</button>`).join('')}<button id="friendly-move" ${disabled?'disabled':''}>移动到此格</button><button id="direct-cancel">取消</button>`:`<span>${inspect?'查看地物模式':p.selections['friend-move-source']===id?'点友军标记：向其所在格移动':d&&!d.target?esc(directLabels[d.kind])+'：点目标即下令':'点空地移动 · 点敌军攻击'}</span><button id="direct-friend-hex" ${disabled?'disabled':''}>移至友军格</button><button data-direct-kind="SUPPORT" ${disabled?'disabled':''}>支援</button><button data-direct-kind="RETREAT" ${disabled?'disabled':''}>撤回</button><button id="direct-stop" ${disabled?'disabled':''}>停止／驻守</button>${u.direct&&g?`<button id="direct-resume" ${disabled?'disabled':''}>恢复军团计划</button>`:''}${(d&&!d.requestId)||p.selections['friend-move-source']?'<button id="direct-cancel">取消点选</button>':''}`}<button id="direct-details">详情</button><button id="direct-inspect">${inspect?'继续下令':'查看地物'}</button></div></section>`;
}
export function directDetails(p:GrandPort,id:string){const c=p.data.continuous,g=c.corps.find((g:any)=>g.members.includes(id));return `<p>手动命令优先，部队仍属于${esc(g?.name??'原编组')}。移动、攻击或支援完成后恢复军团计划；停止将保持待命。停止不表示脱离敌方攻击。</p><label>调整编组<select id="direct-corps">${c.corps.map((x:any)=>`<option value="${esc(x.id)}" ${x.id===g?.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><button id="direct-delegate">编入所选军团并恢复计划</button>`;}
export function bindDirectCommand(p:GrandPort,id:string|null,refresh:()=>void,pick:(active?:boolean)=>void,select?:(id:string)=>void){
 if(!id||!p.data.continuous.units[id])return;const u=p.data.continuous.units[id];
 const cancel=()=>{p.directDraft=null;p.directPreview=null;p.friendlyTarget=null;delete p.selections['friend-move-source'];pick(false);refresh();};
 const on=(key:string,fn:()=>void)=>{const e=document.getElementById(key);if(e)e.onclick=fn;};
 document.querySelectorAll<HTMLElement>('[data-direct-kind]').forEach(el=>el.onclick=()=>{p.friendlyTarget=null;p.directDraft=makeDirectDraft(p,id,el.dataset.directKind!);p.directPreview=null;p.selections['map-command']='1';refresh();});
 on('direct-cancel',cancel);
 on('direct-friend-hex',()=>{p.directDraft=null;p.directPreview=null;p.selections['friend-move-source']=id;refresh();});
 on('direct-details',()=>{p.selections['ui-panel']=p.selections['ui-panel']==='unit'?'':'unit';refresh();});
 on('direct-inspect',()=>{const old=p.selections['map-command'];cancel();p.selections['map-command']=old==='inspect'?'1':'inspect';refresh();});
 on('direct-stop',()=>{cancel();void p.operation({type:'DIRECT',unit:id,order:{kind:'HOLD',target:u.hex,risk:'LOW',paused:true}});});
 on('direct-resume',()=>{cancel();void p.operation({type:'RESUME_PLAN',unit:id});});
 on('direct-delegate',()=>{const group=(document.getElementById('direct-corps') as HTMLSelectElement).value;cancel();void p.operation({type:'ASSIGN',unit:id,group});});
 document.querySelectorAll<HTMLElement>('[data-friendly-select]').forEach(e=>e.onclick=()=>{p.friendlyTarget=null;select?.(e.dataset.friendlySelect!);refresh();});
 on('friendly-move',()=>{const f=p.friendlyTarget;if(!f)return;p.friendlyTarget=null;p.directDraft=null;chooseDirectTarget(p,f.source,f.hex);refresh();});
}
