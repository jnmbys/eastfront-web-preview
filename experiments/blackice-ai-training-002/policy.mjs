import {hexKey,hexDistance,getNeighbors} from '../../vendor/eastfront-digital-core/dist/index.js';
export const POLICY=Object.freeze({version:'AI-TRAINING-POLICY-1',interval:12,session:144,cooldown:576,startOrg:85,returnOrg:75,ratio:1/6});
export const stamp=(g,u)=>JSON.stringify([g?.id,g?.order,u?.templateId,u?.templateVersion]);
// Pure authorized-input planner. No campaign/state, hidden map, RNG or rule probing.
export function rearReason(view,hex){
 const cells=new Map(view.hexes.map(h=>[hexKey(h.coord),h]));
 if(view.units.some(u=>u.side!==view.viewer&&hexDistance(u.hex,hex)<=4))return '附近有已识别威胁';
 let frontier=[hex],seen=new Set();for(let n=0;n<=2;n++){const next=[];for(const h of frontier){const k=hexKey(h);if(seen.has(k))continue;seen.add(k);if(cells.get(k)?.control!==view.viewer)return '未确认连续后方控制区';next.push(...getNeighbors(h));}frontier=next;}
 return null;
}
export function plan(input){
 const {view,own,groups,tasks,tick}=input,decisions=[],rejections={};
 const units=view.units.filter(u=>u.side===view.viewer&&own[u.id]),busy=Object.entries(tasks).filter(([,s])=>['TRAIN','RECOVER'].includes(s.phase));
 for(const[id,t]of busy){const u=units.find(u=>u.id===id),v=own[id],g=groups.find(g=>g.members.includes(id));
  if(!u||!v){decisions.push({id,kind:'RELEASE',reason:'部队已失效'});continue;}
  if(!v.owned){decisions.push({id,kind:'RELEASE',reason:'已有新的手动控制，训练AI退出'});continue;}
  if(t.phase==='TRAIN'){
   const reason=t.stopRequested??(!v.training?'训练已由规则中断':v.eligibility??rearReason(view,u.hex)??(stamp(g,v)!==t.stamp?'军团或编制任务变化':null)??(tick-t.since>=POLICY.session?'本轮训练达到12小时上限':null));
   if(reason)decisions.push({id,kind:'STOP',reason});
  }else if(!v.engaged&&!v.march&&!v.withdrawing&&v.org>=POLICY.returnOrg){decisions.push({id,kind:'RESUME',reason:'组织恢复至75%，归队执行当前军团任务'});}
 }
 if(tick%POLICY.interval)return {decisions,rejections};
 let slots=Math.max(0,Math.floor(units.length*POLICY.ratio)-busy.length);const occupied=new Set(busy.map(([id])=>groups.find(g=>g.members.includes(id))?.id));
 for(const u of units.sort((a,b)=>a.id.localeCompare(b.id))){const v=own[u.id],g=groups.find(g=>g.members.includes(u.id)),t=tasks[u.id];let reason;
  if(t&&['TRAIN','RECOVER'].includes(t.phase))continue;
  if(!g||g.order.paused||g.order.kind!=='HOLD')reason='军团有推进/整补任务或已暂停';
  else if(v.direct||v.manual)reason='手动命令优先';
  else if(tick<(t?.next??0))reason='训练冷却中';
  else if(v.front||g.order.front?.length)reason='保留防线岗位';
  else if(v.phase&&v.phase!=='ACTIVE')reason='保留预备/接替/战术任务';
  else if(v.eligibility)reason=v.eligibility;
  else if(v.org<POLICY.startOrg)reason='组织不足85%';
  else if(v.supply<.8)reason='供给不足80%，不安排训练';
  else reason=rearReason(view,u.hex);
  if(!reason){const ready=units.filter(x=>g.members.includes(x.id)&&x.id!==u.id&&!own[x.id].direct&&!own[x.id].engaged&&!own[x.id].march&&!own[x.id].withdrawing&&own[x.id].org>=POLICY.returnOrg&&!busy.some(([id])=>id===x.id));if(ready.length<2)reason='需保留至少两支可用部队';}
  if(!reason&&(slots<=0||occupied.has(g.id)))reason='达到有限训练/恢复名额';
  if(reason){rejections[reason]=(rejections[reason]??0)+1;continue;}
  decisions.push({id:u.id,kind:'START',reason:'已知安全后方、供给充足；保留岗位和预备',stamp:stamp(g,v)});slots--;occupied.add(g.id);
 }
 return {decisions,rejections};
}
