import type {GrandPort} from './grand.js';
import {escStatus as esc} from './unitStatus.js';
export type DirectDraft={unit:string;kind:string;target:{q:number;r:number}|null;generation:number;instance:string;revision:number;groupId?:string;groupGeneration?:number;requestId?:string;error?:string};
export const directLabels:Record<string,string>={ADVANCE:'移动',ATTACK:'攻击',SUPPORT:'支援',RETREAT:'撤回'};
const distance=(a:any,b:any)=>Math.max(Math.abs(a.q-b.q),Math.abs(a.r-b.r),Math.abs(a.q+a.r-b.q-b.r));
export function makeDirectDraft(p:GrandPort,id:string,kind:string,target:any=null):DirectDraft{const c=p.data.continuous,u=c.units[id],g=c.corps.find((g:any)=>g.members.includes(id));return {unit:id,kind,target,generation:u.commandGeneration,instance:p.data.instanceId,revision:p.data.version,...(!u.direct&&g?{groupId:g.permanentId,groupGeneration:g.commandGeneration}:{})};}
export function chooseDirectTarget(p:GrandPort,id:string,target:any){
 const d=p.directDraft,view=p.data.game.message.payload.view,enemy=view.units.some((u:any)=>u.side!==view.viewer&&distance(u.hex,target)===0);
 const kind=d?.unit===id&&['SUPPORT','RETREAT'].includes(d.kind)?d.kind:enemy?'ATTACK':'ADVANCE';
 if(d?.requestId)return;
 if(d?.unit===id&&!d.error&&d.generation===p.data.continuous.units[id].commandGeneration&&d.kind===kind&&d.target&&distance(d.target,target)===0)return;
 p.directDraft=makeDirectDraft(p,id,kind,{...target});p.directPreview=null;p.requestDirectPreview();
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
 if(d.kind==='ADVANCE'&&enemy)return '目的地出现已识别敌军，请重新点目标并明确确认攻击';
 if(['ATTACK','SUPPORT'].includes(d.kind)){
  if(distance(u.hex,d.target)!==1)return '攻击或支援须与目标相邻';if(!enemy)return '目标已无已识别敌军；原攻击意图保留，请重新选择';
  const b=c.map.battles.find((b:any)=>b.status!=='ENDED'&&distance(b.hex,d.target)===0);
  if(d.kind==='SUPPORT'&&!b)return '该处交战已经结束，不能继续支援';
  if(b?.eligibilityReasons?.[d.unit])return b.eligibilityReasons[d.unit];
 }
 // A preview is advisory. Unrelated world revisions are not command dependencies.
 // The server rechecks the current authorized route and combat conditions atomically.
 if(!p.directPreview)return '正在预览';
 if(p.directPreview.version===p.data.version&&p.directPreview.reason)return p.directPreview.reason;
 return '';
}
export function directCommand(p:GrandPort,id:string){
 const c=p.data.continuous,u=c.units[id];if(!u||!p.selections['map-command'])return '';
 const g=c.corps.find((g:any)=>g.members.includes(id)),direct=!!u.direct||!g,d=p.directDraft?.unit===id?p.directDraft:null;
 const busy=Array.from(p.wire?.pending.values()??[]).some((r:any)=>r.command?.payload?.unit===id),issue=d?directIssue(p,d):'',disabled=p.locked||c.ended||busy;
 const inspect=p.selections['map-command']==='inspect';
 return `<section class="map-command-strip" aria-label="地图指挥"><div class="map-command-heading"><b>${esc(id)} · ${direct?'◇ 直属':esc(g.name)}</b><span>${esc(p.directFeedback[id]??u.reason??'')}${c.paused?' · 世界暂停':''}</span></div><div class="map-command-actions">${d?.target?`<strong>${esc(directLabels[d.kind])} → ${d.target.q},${d.target.r}${direct?'':' · 将接管本队'}</strong><button id="direct-confirm" ${issue||disabled?'disabled':''}>${d.requestId?'等待回执':'确认'+esc(directLabels[d.kind])}</button><button id="direct-cancel">取消</button><small role="status">${esc(issue||'按当前局势核验；虚线路径仅为参考')}</small>`:`<span>${inspect?'查看地物模式':'点地图目标预览'+(direct?'':' · 确认后接管本队')}</span><button data-direct-kind="SUPPORT" ${disabled?'disabled':''}>支援</button><button data-direct-kind="RETREAT" ${disabled?'disabled':''}>撤回</button><button id="direct-stop" ${disabled?'disabled':''}>停止</button>${d?`<b>${esc(directLabels[d.kind])}：点目标</b><button id="direct-cancel">取消</button>`:''}`}<button id="direct-details">部队详情</button><button id="direct-inspect">${inspect?'继续下令':'查看地物'}</button></div></section>`;
}
export function directDetails(p:GrandPort,id:string){const c=p.data.continuous,g=c.corps.find((g:any)=>g.members.includes(id)),u=c.units[id];return `<p>点地图目标即可预览；停止命令不代表已经脱离战斗。</p><label>交给军官<select id="direct-corps">${c.corps.map((x:any)=>`<option value="${esc(x.id)}" ${x.id===g?.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><button id="direct-delegate">交回所选军官</button>${!u.direct?'<button id="direct-takeover">接管并停止主动命令</button>':''}<button id="direct-friendly-hex">以本队所在格为目标</button><p>此按钮可向有友军的格位下令：先选作为落点的友军，再在下方选择出发部队。</p><select id="direct-source" aria-label="出发部队">${Object.keys(c.units).filter(k=>c.units[k].alive&&k!==id).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')}</select>`;}
export function bindDirectCommand(p:GrandPort,id:string|null,refresh:()=>void,pick:(active?:boolean)=>void,select?:(id:string)=>void){
 if(!id||!p.data.continuous.units[id])return;const u=p.data.continuous.units[id];
 const cancel=()=>{p.directDraft=null;p.directPreview=null;pick(false);refresh();};
 document.querySelectorAll<HTMLElement>('[data-direct-kind]').forEach(el=>el.onclick=()=>{p.directDraft=makeDirectDraft(p,id,el.dataset.directKind!);p.directPreview=null;p.selections['map-command']='1';refresh();});
 document.getElementById('direct-cancel')?.addEventListener('click',cancel);
 document.getElementById('direct-details')?.addEventListener('click',()=>{p.selections['ui-panel']=p.selections['ui-panel']==='unit'?'':'unit';refresh();});
 document.getElementById('direct-inspect')?.addEventListener('click',()=>{cancel();p.selections['map-command']=p.selections['map-command']==='inspect'?'1':'inspect';refresh();});
 for(const key of ['direct-stop','direct-takeover'])document.getElementById(key)?.addEventListener('click',()=>{cancel();void p.operation({type:'DIRECT',unit:id,order:{kind:'HOLD',target:u.hex,risk:'LOW',paused:true}});});
 document.getElementById('direct-confirm')?.addEventListener('click',()=>{const d=p.directDraft;if(!d||directIssue(p,d))return;p.submitDirectIntent(d);refresh();});
 document.getElementById('direct-delegate')?.addEventListener('click',()=>{const group=(document.getElementById('direct-corps') as HTMLSelectElement).value;cancel();void p.operation({type:'ASSIGN',unit:id,group});});
 document.getElementById('direct-friendly-hex')?.addEventListener('click',()=>{const source=(document.getElementById('direct-source') as HTMLSelectElement).value;if(!source)return;select?.(source);chooseDirectTarget(p,source,u.hex);p.selections['ui-panel']='';refresh();});
}
