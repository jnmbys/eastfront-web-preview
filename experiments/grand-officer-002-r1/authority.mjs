import {Campaign as Base} from '../grand-officer-001/authority.mjs';
import {planObjectives,VERSION} from './policy.mjs';
import {searchContext,STEP_BUDGET} from './search.mjs';
import {hexKey as key,hexDistance as dist} from '../../vendor/eastfront-digital-core/dist/index.js';
import {rules} from '../grand-play-001/rules.mjs';
const copy=structuredClone;
export class Campaign extends Base {
 constructor(){super();this.clock.objectives={version:VERSION,enabled:true,sides:{GERMAN:{groups:{},units:{}},SOVIET:{groups:{},units:{}}},orders:{},events:[],search:{GERMAN:{paths:{}},SOVIET:{paths:{}}},cursor:0,relief:{},metrics:{plans:0,expanded:0,hits:0,totalMs:0,maxMs:0,maxExpanded:0,released:0},arbitration:{}};}
 // One final intent: player > current tactical job > idle-unit objective > original corps order.
 ownOrder(id){const base=super.ownOrder(id),v=this.clock.units[id],g=this.clock.corps.find(g=>g.members.includes(id));return v?.direct||g?.order.paused||this.clock.tactical?.orders[id]||this.clock.tactical?.withdrawals[id]?base:this.clock.objectives?.orders[id]??base;}
 enemyPlan(view){const start=performance.now(),o=this.clock.objectives;if(!o)return super.enemyPlan(view);
  const released=[];
  // This is a tactical completion check, before tactical roles are allocated. Objectives never release reserves.
  for(const side of ['GERMAN','SOVIET']){const v=this.fair(side).view,own=v.units.filter(u=>u.side===side&&u.friendly?.alive);
   for(const u of own){const s=this.clock.tactical.states[u.id],unit=this.clock.units[u.id],g=this.clock.corps.find(g=>g.members.includes(u.id));
    if(s?.phase!=='RELIEF'||unit.direct||g?.order.paused||!s.target){delete o.relief[u.id];continue;}
    const sig=JSON.stringify([s.stamp,s.target,key(u.hex)]),old=o.relief[u.id],full=own.filter(x=>key(x.hex)===key(s.target)).length>=rules.stack,waiting=full&&dist(u.hex,s.target)<=1&&!unit.engaged&&!unit.march;
    o.relief[u.id]={sig,since:waiting&&old?.sig===sig?old.since:this.clock.tick};
    if(waiting&&this.clock.tick-o.relief[u.id].since>=6){delete this.clock.tactical.states[u.id];delete this.clock.tactical.orders[u.id];delete o.relief[u.id];released.push({unit:u.id,side,text:'原接替点持续满员，战术任务解除，重新安排预备或行动'});o.metrics.released++;}
   }
  }
  super.enemyPlan(view);o.orders={};const tacticalDone=performance.now(),shared={remaining:STEP_BUDGET,expanded:0,hits:0};
  const eligible=this.clock.corps.filter(g=>!g.order.paused&&g.order.kind==='ADVANCE'&&!g.order.front?.length).sort((a,b)=>a.id.localeCompare(b.id));
  const allowed=eligible.length?eligible[o.cursor%eligible.length].id:null;o.cursor++;
  if(o.enabled)for(const side of ['GERMAN','SOVIET']){const v=this.fair(side).view,own=Object.fromEntries(v.units.filter(u=>u.side===side).map(u=>[u.id,{...this.capability(u.id),...copy(this.clock.units[u.id]),stock:this.econ.supply[u.id].stock,withdrawing:!!this.clock.tactical.withdrawals[u.id]}])),groups=this.clock.corps.filter(g=>g.side===side),ctx=searchContext(v,o.search[side],shared,allowed,this.clock.tactical.orders),p=planObjectives(v,own,groups,this.clock.tactical.states,o.sides[side],this.clock.tick,ctx);
   o.sides[side]=p.state;Object.assign(o.orders,p.orders);for(const e of p.events){this.note(side,e.text,e.unit);o.events.push({tick:this.clock.tick,side,...e});}
  }
  for(const e of released){this.note(e.side,e.text,e.unit);o.events.push({tick:this.clock.tick,...e});}
  o.arbitration={};for(const u of Object.values(this.state.units).filter(u=>u.alive)){const g=this.clock.corps.find(g=>g.members.includes(u.id));o.arbitration[u.id]={owner:this.clock.units[u.id].direct||g?.order.paused?'PLAYER':this.clock.tactical.orders[u.id]?'TACTICAL':o.orders[u.id]?'OBJECTIVE':'CORPS',order:copy(this.ownOrder(u.id))};}
  o.events=o.events.slice(-500);o.metrics.plans++;o.metrics.expanded+=shared.expanded;o.metrics.hits+=shared.hits;o.metrics.maxExpanded=Math.max(o.metrics.maxExpanded,shared.expanded);const elapsed=performance.now()-start;o.metrics.totalMs+=elapsed;o.metrics.maxMs=Math.max(o.metrics.maxMs,elapsed);o.metrics.last={expanded:shared.expanded,hits:shared.hits,allowed,objectiveMs:performance.now()-tacticalDone,totalMs:elapsed};
 }
 decideAction(view,u,own,order,profile){const d=super.decideAction(view,u,own,order,profile),o=this.clock.objectives;if(!this.clock.units[u.id].direct&&!this.clock.tactical.orders[u.id]&&o.orders[u.id])d.reason=o.sides[u.side].units[u.id].reason+'；'+d.reason;return d;}
 transaction(req){const seen=this.receipts.has(req.id),r=super.transaction(req),o=this.clock.objectives,op=req.operation;if(!seen&&o){const ids=op.type==='ORDER'?(this.clock.corps.find(g=>g.id===op.group)?.members??[]):['DIRECT','ASSIGN'].includes(op.type)?[op.unit]:[];for(const id of ids){delete o.orders[id];delete o.arbitration[id];delete o.relief[id];for(const s of Object.values(o.sides))delete s.units[id];}if(op.type==='ORDER')for(const s of Object.values(o.sides))delete s.groups[op.group];}return r;}
 save(){const s=super.save();s.objectiveRules=VERSION;return s;}
 restore(s,pause=true){if(s.objectiveRules!==VERSION||s.clock?.objectives?.version!==VERSION)throw Error('OBJECTIVE_R1_RULES_MISMATCH_START_NEW_CAMPAIGN');super.restore(s,pause);}
 snapshot(draft){const d=super.snapshot(draft),o=this.clock.objectives;if(o){d.continuous.objectives=copy(o.sides[d.viewer]);d.continuous.objectives.scenario=this.clock.scenario??'NORMAL';d.continuous.objectives.mode=o.enabled?'协调修订实验':'001保守候选';for(const[id,row]of Object.entries(o.sides[d.viewer].units))if(d.continuous.tactical.units[id]&&row.task!=='WATCH'&&!this.clock.tactical.orders[id])d.continuous.tactical.units[id].reason=row.reason;}return d;}
}
export class Conservative extends Campaign {constructor(){super();this.clock.objectives.enabled=false;}}
