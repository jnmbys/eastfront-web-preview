// Objective policy consumes one authorized side view and own state only.
import {hexKey as key,hexDistance as dist,getNeighbors} from '../../vendor/eastfront-digital-core/dist/index.js';
import {route,travel} from '../grand-play-001/planner.mjs';
import {rules,profiles} from '../grand-play-001/rules.mjs';
export const VERSION='GRAND-OFFICER-002-R1';
export const config=Object.freeze({interval:6,stalledSteps:6,groupSearchBudget:400,maxApproaches:7,readinessStock:2});
const copy=structuredClone;
export function planObjectives(view,own,groups,tactical,memory,tick,context=null){
 const before=memory??{groups:{},units:{}},state={groups:copy(before.groups??{}),units:{}},orders={},release=[],events=[];
 const units=view.units.filter(u=>u.side===view.viewer&&u.friendly?.alive&&own[u.id]),enemy=view.units.filter(u=>u.side!==view.viewer),seen=new Set(view.identifiedHexKeys),hexes=new Map(view.hexes.map(h=>[key(h.coord),h]));
 const count=h=>units.filter(u=>key(u.hex)===key(h)).length,atEnemy=h=>enemy.some(u=>key(u.hex)===key(h)),nearEnemy=h=>enemy.filter(u=>dist(u.hex,h)<=1).length;
 let expanded=0;const destinations=new Map(),buckets=new Map();
 for(const g of groups){if(g.order.paused||g.order.kind!=='ADVANCE'||g.order.front?.length){delete state.groups[g.id];continue;}const k=key(g.order.target);if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(g);}
 const set=(u,g,task,target,reason,prior)=>{const row={group:g.id,stamp:JSON.stringify(g.order),task,target:copy(target),reason,issued:prior?.task===task&&key(prior.target)===key(target)?prior.issued:tick,last:key(u.hex),stalled:prior?.last===key(u.hex)?(prior.stalled??0)+1:0};state.units[u.id]=row;
  orders[u.id]={kind:task==='GUARD'||task==='WAIT'?'HOLD':'ADVANCE',target:copy(target),risk:g.order.risk,paused:task==='WAIT'};
  destinations.set(key(target),(destinations.get(key(target))??0)+1);
  if(!prior||prior.task!==task||key(prior.target)!==key(target)||false)events.push({unit:u.id,group:g.id,text:reason,task,target:copy(target)});
 };
 for(const [goalKey,bucket]of [...buckets].sort(([a],[b])=>a.localeCompare(b))){
  bucket.sort((a,b)=>a.id.localeCompare(b.id));const goal=bucket[0].order.target,visible=seen.has(goalKey),clear=visible&&!atEnemy(goal),held=visible&&hexes.get(goalKey)?.control===view.viewer;
  const active=[];
  for(const g of bucket){const stamp=JSON.stringify(g.order);for(const u of units.filter(u=>g.members.includes(u.id)&&!own[u.id].direct)){
   const v=own[u.id],s=tactical[u.id],raw=before.units?.[u.id]?.stamp===stamp?before.units[u.id]:null,old=raw?.task==='WATCH'?raw.resume:raw,stalled=raw?.last===key(u.hex)?(raw.stalled??0)+1:0;
   const watch={group:g.id,stamp,task:'WATCH',target:copy(goal),reason:'沿用撤出、轮换或当前接触任务',issued:old?.issued??tick,last:key(u.hex),stalled,resume:old??null};
   if(['WITHDRAW','RECOVER','WAIT','BLOCKED','RESERVE','RELIEF','SUPPORT'].includes(s?.phase)||v.withdrawing||context?.tacticalOrders[u.id]){state.units[u.id]=watch;continue;}
   if(v.org<profiles[g.profile].stop+12||v.stock<config.readinessStock||v.personnel/v.max<.6){state.units[u.id]={...watch,reason:v.stock<config.readinessStock?'补给不足，暂不组织新的目标推进':v.personnel/v.max<.6?'人员不足，等待真实补充':'组织尚未达到目标推进条件'};continue;}
   if(v.engaged||s?.phase==='SUPPORT'){state.units[u.id]=watch;continue;}
   active.push({u,g,old,stalled});
  }}
  // Exactly one occupier/guard for a shared final target. Others keep distinct approach positions.
  const anchorUnit=clear?active.slice().sort((a,b)=>dist(a.u.hex,goal)-dist(b.u.hex,goal)||a.g.id.localeCompare(b.g.id)||a.u.id.localeCompare(b.u.id)).find(x=>key(x.u.hex)===goalKey||count(goal)<rules.stack):null;
  if(anchorUnit){const {u,g,old}=anchorUnit;set(u,g,held&&key(u.hex)===goalKey?'GUARD':'OCCUPY',goal,held?'守备最终目标，保留一队；余部组织周边行动':'目标当前可见且无已识别敌军，明确改任推进占领（不保证无遭遇）',old);}
  const usedAnchors=new Set();
  for(const [index,g]of bucket.entries()){
   const stamp=JSON.stringify(g.order),us=active.filter(x=>x.g.id===g.id&&x!==anchorUnit),members=units.filter(u=>g.members.includes(u.id)&&!own[u.id].direct),prev=state.groups[g.id]?.stamp===stamp?state.groups[g.id]:null;
   const threats=enemy.filter(e=>dist(e.hex,goal)<=4).map(e=>[e.id,key(e.hex)]).sort().toString();
   const blocked=us.some(x=>x.stalled>=config.stalledSteps&&!own[x.u.id].march&&x.old&&key(x.u.hex)!==key(x.old.target)),invalid=prev?.anchor&&(!hexes.has(key(prev.anchor))||hexes.get(key(prev.anchor)).terrain==='LAKE'||atEnemy(prev.anchor)||count(prev.anchor)>=rules.stack&&!members.some(u=>key(u.hex)===key(prev.anchor)));
   const due=!prev||!prev.anchor&&tick>=prev.next||prev.available===0&&us.length>0||prev.held!==held||prev.visible!==visible||prev.threats!==threats||invalid||blocked&&tick>=prev.next;
   let anchor=prev?.anchor,reason=prev?.reason,role=index===0?'主攻':'侧向接近',used=0;
   if(due&&(!context||context.allowedGroup===g.id)){const rep=us.slice().sort((a,b)=>dist(a.u.hex,goal)-dist(b.u.hex,goal)||a.u.id.localeCompare(b.u.id))[0]?.u;
    const candidates=[...getNeighbors(goal)].filter(h=>hexes.has(key(h))&&!usedAnchors.has(key(h))&&!atEnemy(h)&&count(h)<rules.stack).sort((a,b)=>(rep?dist(rep.hex,a)-dist(rep.hex,b):0)||key(a).localeCompare(key(b))).slice(0,config.maxApproaches);
    const options=[];if(rep)for(const h of candidates){const remaining=Math.min(config.groupSearchBudget-used,context?.remaining??config.groupSearchBudget);if(remaining<=0)break;const r=context?context.route(rep.hex,h,own[rep.id],remaining):route(view,rep.hex,h,own[rep.id],0,remaining);used+=r.expanded;if(r.path.length||key(rep.hex)===key(h)){let cost=0,from=rep.hex;for(const to of r.path){cost+=travel(view,from,to,own[rep.id],context?.index);from=to;}options.push({h,cost:cost+nearEnemy(h)*3+count(h)*2});}}
    options.sort((a,b)=>a.cost-b.cost||key(a.h).localeCompare(key(b.h)));const previous=options.find(x=>anchor&&key(x.h)===key(anchor)),best=options[0];
    if(best){if(!previous||blocked||previous.cost>best.cost+2)anchor=copy(best.h);reason=held?'目标已控制，分守接近方向并保留通路':visible?(clear?'目标腾空，分配推进与接应':'组织已知目标附近的主攻与接应'):'目标情报未确认，沿公开地形接近，不宣称目标已清空';}
    else if(context?.remaining===0&&prev?.anchor&&!invalid){anchor=prev.anchor;reason=prev.reason;}else{anchor=null;reason=rep?'等待前方友军让出通路，或当前有界搜索未找到可达接近点':'没有可用于新推进的部队；当前撤出、整补与接触任务优先';}
    state.groups[g.id]={stamp,finalTarget:copy(goal),anchor,role:anchorUnit?.g.id===g.id?'占领／守备':role,held,visible,threats,reason,plannedAt:tick,next:tick+config.interval,search:used};expanded+=used;
   }else {state.groups[g.id]=prev??{stamp,finalTarget:copy(goal),anchor:null,role,held,visible,threats,reason:'等待本步规划轮次；保留有效任务',next:tick,search:0}; if(invalid){anchor=null;state.groups[g.id].anchor=null;state.groups[g.id].reason='接近点已失效，等待重新规划';}}
   const record=state.groups[g.id];if(anchor)usedAnchors.add(key(anchor));
   if(!anchor)for(const {u,old}of us)set(u,g,'WAIT',u.hex,record.reason,old);
   if(anchor){
    const slots=[anchor,...getNeighbors(anchor)].filter(h=>hexes.has(key(h))&&dist(h,goal)<=2&&key(h)!==goalKey&&!atEnemy(h)).sort((a,b)=>dist(a,anchor)-dist(b,anchor)||key(a).localeCompare(key(b)));
    for(const {u,old,stalled}of us){
     // Do not cancel an accepted march solely because a view refreshed. Reconsider at the next node.
     if(own[u.id].march&&old&&['APPROACH','OCCUPY'].includes(old.task)){set(u,g,old.task,old.target,old.reason,old);continue;}
     let target=old&&old.task==='APPROACH'&&slots.some(h=>key(h)===key(old.target))?old.target:null;
     const room=h=>count(h)+(destinations.get(key(h))??0)-(key(u.hex)===key(h)?1:0)<rules.stack;
     if(!target||!room(target))target=slots.filter(room).sort((a,b)=>dist(u.hex,a)-dist(u.hex,b)||dist(a,anchor)-dist(b,anchor)||key(a).localeCompare(key(b)))[0];
     if(target)set(u,g,'APPROACH',target,held?'守备目标周边，保留通路与接替空间':`沿分配接近方向组织行动；${visible?'按当前已知接触处理':'目标仍未确认'}`,old);
     else set(u,g,'WAIT',u.hex,'等待前方友军让出通路；不重复挤入满员目标',old);
    }
   }
   // Include specific readiness/rotation constraints in the existing corps detail.
   record.available=us.length+(anchorUnit?.g.id===g.id?1:0);record.members=members.length;
  }
 }
 return {state,orders,release,events,expanded};
}
