// Persistent posts use only an authorized view, own capabilities and public travel.
import {hexKey as key,hexDistance as distance,getNeighbors} from '../../vendor/eastfront-digital-core/dist/index.js';
import {searchContext} from '../grand-officer-002-r1/search.mjs';
import {travel} from '../grand-play-001/planner.mjs';
import {cfg} from '../grand-economy-002/config.mjs';
export const VERSION='PERSISTENT-FRONT-1', BUDGET=480;
const copy=structuredClone, protectedPhases=new Set(['WITHDRAW','RECOVER','BLOCKED','WAIT']);
export function initialize(clock){
 if(clock.frontDefense&&clock.frontDefense.version!==VERSION)throw Error('UNSUPPORTED_FRONT_POST_VERSION');
 return clock.frontDefense??={version:VERSION,groups:{},orders:{},cursor:0,metrics:{plans:0,expanded:0,maxExpanded:0,totalMs:0,maxMs:0,reassigned:0}};
}
export function reportFront(view,g,states,withdrawals,stored,tactical={}){
 const us=view.units.filter(u=>u.side===view.viewer&&g.members.includes(u.id)),cells=new Map(view.hexes.map(h=>[key(h.coord),h]));
 const posts=(g.order.front??[]).map(hex=>{const p=copy(stored?.posts[key(hex)]??{hex,unit:null}),occupants=us.filter(u=>key(u.hex)===key(hex)&&!withdrawals[u.id]&&!states[u.id]?.march&&!Object.values(stored?.posts??{}).some(x=>x.unit===u.id&&key(x.hex)!==key(hex)));
  const valid=cells.get(key(hex))?.control===view.viewer&&!view.units.some(u=>u.side!==view.viewer&&key(u.hex)===key(hex));
  const assignee=us.find(u=>u.id===p.unit&&!states[u.id]?.direct&&!withdrawals[u.id]);
  p.occupants=occupants.map(u=>u.id);p.status=!valid?'BLOCKED':occupants.length?'OCCUPIED':assignee?(p.status==='BLOCKED'?'BLOCKED':'EN_ROUTE'):'VACANT';return p;});
 const available=us.filter(u=>!states[u.id]?.direct&&!withdrawals[u.id]&&!protectedPhases.has(tactical[u.id]?.phase)&&(states[u.id]?.dailySupply?.effective??1)>0&&states[u.id]?.org>=35&&states[u.id]?.personnel/states[u.id]?.max>=.6).length;
 return {id:g.id,mode:g.order.paused?'PAUSED':g.order.kind==='ADVANCE'&&g.order.planAdvance?'ATTACK':'DEFEND',posts,count:us.length,available,uncommitted:Math.max(0,available-posts.filter(p=>p.unit&&us.some(u=>u.id===p.unit&&!states[u.id]?.direct)).length),occupied:posts.filter(p=>p.status==='OCCUPIED').length,inTransit:posts.filter(p=>p.status==='EN_ROUTE').length,vacant:posts.filter(p=>p.status==='VACANT').length,blocked:posts.filter(p=>p.status==='BLOCKED').length,shortage:Math.max(0,posts.length-available-posts.filter(p=>p.occupants.some(id=>states[id]?.direct?.paused)).length),assigned:Object.fromEntries(posts.filter(p=>p.unit).map(p=>[p.unit,p.hex])),covered:posts.filter(p=>p.status==='OCCUPIED').map(p=>p.hex),unassigned:posts.filter(p=>!p.unit).map(p=>p.hex)};
}
export function planFront(view,g,own,tactical,withdrawals,prior,tick,context){
 const signature=JSON.stringify([g.side,g.order.front]);
 const state=prior?.signature===signature?copy(prior):{signature,posts:{},routes:{},changes:0};
 const cells=new Map(view.hexes.map(h=>[key(h.coord),h])),enemies=view.units.filter(u=>u.side!==view.viewer),us=view.units.filter(u=>u.side===view.viewer&&g.members.includes(u.id)&&own[u.id]);
 const available=u=>!own[u.id].direct&&!withdrawals[u.id]&&!protectedPhases.has(tactical[u.id]?.phase)&&own[u.id].org>=35&&(own[u.id].dailySupply?.effective??1)>0&&own[u.id].stock>=1&&own[u.id].personnel/own[u.id].max>=.6;
 const safePost=h=>cells.get(key(h))?.control===view.viewer&&!enemies.some(e=>key(e.hex)===key(h));
 const priority=h=>{const cell=cells.get(key(h));return (cell?.terrain==='CITY'?30:0)+(view.edges.some(e=>(key(e.a??{})===key(h)||key(e.b??{})===key(h))&&(e.road||e.railway?.present))?10:0)+enemies.filter(e=>distance(e.hex,h)<=1).length*20+getNeighbors(h).filter(n=>cells.has(key(n))&&cells.get(key(n)).control!==view.viewer).length;};
 const front=g.order.front??[],posts=front.map(h=>({hex:copy(h),priority:priority(h),...(state.posts[key(h)]??{})}));
 const assigned=new Set(),orders={},decisions={},released=[];
 // Preserve real jobs, not a greedy fresh nearest-neighbour allocation every tick.
 for(const post of posts){
  const u=us.find(u=>u.id===post.unit);
  post.valid=safePost(post.hex);post.priority=priority(post.hex);
  if(!post.valid||!u||!available(u)||assigned.has(u.id)){post.previous=post.unit??post.previous??null;post.unit=null;}
  if(post.unit)assigned.add(post.unit);
 }
 for(const p of posts){if(!p.valid||p.unit)continue;const guard=us.find(u=>available(u)&&!assigned.has(u.id)&&!own[u.id].march&&key(u.hex)===key(p.hex));if(guard){p.unit=guard.id;p.assignedAt=tick;assigned.add(guard.id);state.changes++;}}
 const gaps=posts.filter(p=>p.valid&&!p.unit&&!us.some(u=>key(u.hex)===key(p.hex)&&own[u.id].direct?.paused&&!own[u.id].march&&!withdrawals[u.id])).sort((a,b)=>b.priority-a.priority||key(a.hex).localeCompare(key(b.hex)));
 for(const p of gaps){
  const candidates=us.filter(u=>available(u)&&!assigned.has(u.id)&&!own[u.id].march&&!own[u.id].engaged&&!(tactical[u.id]?.phase==='RELIEF'&&tactical[u.id]?.replacing)).sort((a,b)=>distance(a.hex,p.hex)-distance(b.hex,p.hex)||a.id.localeCompare(b.id));
  for(const u of candidates){
   const r=key(u.hex)===key(p.hex)?{path:[],expanded:0}:context.route(u.hex,p.hex,own[u.id],80);
   if(key(u.hex)!==key(p.hex)&&!r.path.length)continue;
   p.unit=u.id;p.assignedAt=tick;p.replacing=p.previous??null;assigned.add(u.id);state.changes++;
   if(tactical[u.id]?.phase==='RESERVE')released.push(u.id);break;
  }
  if(!p.unit){
   // Only a clearly less threatened, non-engaged post can donate its guard.
   // The vacated post remains a visible gap; never count the relieving march twice.
   const donors=posts.filter(s=>s.unit&&s.priority+20<=p.priority&&tick-(s.assignedAt??0)>=6).sort((a,b)=>a.priority-b.priority||key(a.hex).localeCompare(key(b.hex)));
   for(const source of donors){const u=us.find(u=>u.id===source.unit);if(!u||!available(u)||own[u.id].march||own[u.id].engaged||['RELIEF','SUPPORT'].includes(tactical[u.id]?.phase))continue;
    const r=context.route(u.hex,p.hex,own[u.id],80);if(!r.path.length)continue;
    p.unit=u.id;p.assignedAt=tick;p.replacing=p.previous??null;p.fromPost=copy(source.hex);source.previous=u.id;source.unit=null;state.changes++;break;
   }
  }
 }
 for(const p of posts){
  const occupants=us.filter(u=>key(u.hex)===key(p.hex)&&!withdrawals[u.id]&&!own[u.id].march&&!posts.some(x=>x.unit===u.id&&key(x.hex)!==key(p.hex)));
  p.occupants=occupants.map(u=>u.id);p.status=!p.valid?'BLOCKED':occupants.length?'OCCUPIED':p.unit?'EN_ROUTE':'VACANT';
  p.reason=!p.valid?'该格非当前已知己方控制或有已识别敌军，无法部署':p.status==='VACANT'?'缺少可用部队或已知通路，缩短战线或增派部队':'';
  const u=us.find(u=>u.id===p.unit);if(!u)continue;
  // Urgent withdrawal/recovery is never held up by post protection.
  if(!available(u))continue;
  const v=own[u.id],t=tactical[u.id],at=key(u.hex)===key(p.hex);
  let reason=at?'已到位，持续守备':p.fromPost?'优先填补已知受威胁缺口；原较低风险岗位暂缺守军':p.replacing?`${u.id} 正在接替 ${p.replacing}，到达前仍为空缺`:'正在赶赴防守岗位';
  orders[u.id]={kind:'HOLD',target:copy(p.hex),risk:g.order.risk,paused:false,frontPost:true};
  if(v.march){decisions[u.id]={kind:'REST',reason:'已接受行军段继续执行；'+reason};continue;}
  if(at){
   // Already accepted stationary support can continue; it does not vacate a post.
   if(t?.phase==='SUPPORT'&&v.engaged){delete orders[u.id];continue;}
   decisions[u.id]={kind:'REST',reason};continue;
  }
  if(t?.phase==='SUPPORT'&&v.engaged){delete orders[u.id];p.status='BLOCKED';p.reason='正在执行支援；未到岗，不能计作驻守';continue;}
  const r=context.route(u.hex,p.hex,v,80);
  if(r.path.length)decisions[u.id]={kind:'MARCH',to:r.path[0],duration:Math.max(1,Math.ceil(travel(view,u.hex,r.path[0],v,context.index)*cfg.marchScale)),expanded:r.expanded,reason};
  else {p.status='BLOCKED';p.reason=r.reason??'本步寻路预算已用尽，保留岗位等待下一步';decisions[u.id]={kind:'REST',reason:p.reason};}
 }
 // Unassigned troops are the only offensive surplus. A sole post guard never follows a common target.
 // No-front corps keep the existing tactical policy unchanged.
 let offensiveReleased=false;
 for(const u of us){if(orders[u.id]||!available(u))continue;const t=tactical[u.id];
  if(['RELIEF','SUPPORT'].includes(t?.phase))continue;
  if(g.order.kind==='ADVANCE'&&g.order.planAdvance&&own[u.id].engaged)continue;
  if(g.order.kind==='ADVANCE'&&g.order.planAdvance&&!offensiveReleased&&posts.filter(p=>p.valid).every(p=>p.status==='OCCUPIED')&&!own[u.id].engaged&&own[u.id].org>=55&&own[u.id].stock>=2){
   offensiveReleased=true;released.push(u.id);orders[u.id]={kind:'ADVANCE',target:copy(g.order.target),risk:g.order.risk,paused:false};continue;
  }
  orders[u.id]={kind:'HOLD',target:copy(u.hex),risk:g.order.risk,paused:false,frontPost:true};decisions[u.id]={kind:'REST',reason:g.order.kind==='ADVANCE'&&g.order.planAdvance?'等待必要岗位到位及组织、补给条件，暂不投入进攻':'预备守备；等待防线缺口或明确进攻授权'};
 }
 state.posts=Object.fromEntries(posts.map(p=>[key(p.hex),p]));state.tick=tick;
 state.summary={id:g.id,mode:g.order.paused?'PAUSED':g.order.kind==='ADVANCE'&&g.order.planAdvance?'ATTACK':'DEFEND',posts,count:us.length,available:us.filter(available).length,occupied:posts.filter(p=>p.status==='OCCUPIED').length,inTransit:posts.filter(p=>p.status==='EN_ROUTE').length,vacant:posts.filter(p=>p.status==='VACANT').length,blocked:posts.filter(p=>p.status==='BLOCKED').length,shortage:Math.max(0,front.length-us.filter(available).length),assigned:Object.fromEntries(posts.filter(p=>p.unit).map(p=>[p.unit,p.hex])),covered:posts.filter(p=>p.status==='OCCUPIED').map(p=>p.hex),unassigned:posts.filter(p=>!p.unit).map(p=>p.hex)};
 return {state,orders,decisions,released};
}
export function scheduleFronts(c){
 const start=performance.now(),f=initialize(c.clock),shared={remaining:BUDGET,expanded:0,hits:0};f.orders={};c.frontDecisions={};
 const search=f.search??={GERMAN:{paths:{}},SOVIET:{paths:{}}};
 const groups=c.clock.corps.filter(g=>g.order.front?.length).sort((a,b)=>a.id.localeCompare(b.id));
 const offset=f.cursor++%Math.max(1,groups.length),ordered=[...groups.slice(offset),...groups.slice(0,offset)];
 const contexts={};
 for(const g of ordered){
  const view=c.fair(g.side).view;
  // Defensive repositioning stays on currently known own land. The offensive
  // surplus still uses the original approach/encounter policy and its risks.
  const routeView={...view,hexes:view.hexes.filter(h=>h.control===g.side)};
  const context=contexts[g.side]??=(searchContext(routeView,search[g.side],shared,null,{}));
  if(g.order.paused||['REFIT','RETREAT'].includes(g.order.kind)){if(f.groups[g.id]?.summary)f.groups[g.id].summary.mode='PAUSED';continue;}
  const own=Object.fromEntries(view.units.filter(u=>u.side===g.side).map(u=>[u.id,{...c.capability(u.id),...c.clock.units[u.id],stock:c.econ.supply[u.id].stock}]));
  for(const id of g.members){const t=c.clock.tactical.states[id];if(t?.phase==='RELIEF'&&!own[id]?.direct&&!c.clock.tactical.withdrawals[id]&&view.hexes.find(h=>key(h.coord)===key(t.target))?.control!==g.side){delete c.clock.tactical.states[id];delete c.clock.tactical.orders[id];}}
  const old=f.groups[g.id],p=planFront(view,g,own,c.clock.tactical.states,c.clock.tactical.withdrawals,old,c.clock.tick,context);
  f.metrics.reassigned+=Math.max(0,p.state.changes-(old?.changes??0));f.groups[g.id]=p.state;
  Object.assign(f.orders,p.orders);Object.assign(c.frontDecisions,p.decisions);
  for(const id of p.released){c.clock.tactical.states[id]={phase:'ACTIVE',reason:p.orders[id]?.frontPost?'防线缺口优先，预备队已释放赶赴岗位':'必要岗位已到位，释放一队执行明确进攻授权',stamp:JSON.stringify(g.order)};delete c.clock.tactical.orders[id];}
 }
 for(const id of Object.keys(f.groups))if(!groups.some(g=>g.id===id))delete f.groups[id];
 const elapsed=performance.now()-start;f.metrics.plans++;f.metrics.expanded+=shared.expanded;f.metrics.maxExpanded=Math.max(f.metrics.maxExpanded,shared.expanded);f.metrics.totalMs+=elapsed;f.metrics.maxMs=Math.max(f.metrics.maxMs,elapsed);f.metrics.lastMs=elapsed;
}
