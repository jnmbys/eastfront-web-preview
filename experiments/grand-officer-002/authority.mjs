import {Campaign as Base} from '../grand-officer-001/authority.mjs';
import {planObjectives,VERSION} from './policy.mjs';
import {decideAction} from '../grand-map-r1/policy.mjs';
const copy=structuredClone;
export class Campaign extends Base {
 constructor(){super();this.clock.objectives={version:VERSION,sides:{GERMAN:{groups:{},units:{}},SOVIET:{groups:{},units:{}}},orders:{},events:[],metrics:{plans:0,expanded:0,maxMs:0}};}
 ownOrder(id){const base=super.ownOrder(id),v=this.clock.units[id],g=this.clock.corps.find(g=>g.members.includes(id));return v?.direct||g?.order.paused?base:this.clock.objectives?.orders[id]??base;}
 enemyPlan(view){super.enemyPlan(view);const o=this.clock.objectives;if(!o)return;const started=performance.now();o.orders={};
  for(const side of ['GERMAN','SOVIET']){const v=this.fair(side).view,own=Object.fromEntries(v.units.filter(u=>u.side===side).map(u=>[u.id,{...this.capability(u.id),...copy(this.clock.units[u.id]),stock:this.econ.supply[u.id].stock,withdrawing:!!this.clock.tactical.withdrawals[u.id]}])),groups=this.clock.corps.filter(g=>g.side===side),p=planObjectives(v,own,groups,this.clock.tactical.states,o.sides[side],this.clock.tick);
   o.sides[side]=p.state;Object.assign(o.orders,p.orders);o.metrics.expanded+=p.expanded;for(const id of p.release){delete this.clock.tactical.states[id];delete this.clock.tactical.orders[id];}
   for(const e of p.events){this.note(side,e.text,e.unit);o.events.push({tick:this.clock.tick,side,...e});}
  }o.events=o.events.slice(-500);o.metrics.plans++;o.metrics.maxMs=Math.max(o.metrics.maxMs,performance.now()-started);
 }
 decideAction(view,u,own,order,profile){const row=this.clock.objectives?.sides[u.side]?.units[u.id];if(this.clock.objectives?.orders[u.id]&&!this.clock.units[u.id].direct){const d=decideAction(view,u,own,order,profile);d.reason=row.reason+'；'+d.reason;return d;}return super.decideAction(view,u,own,order,profile);}
 transaction(req){const seen=this.receipts.has(req.id),r=super.transaction(req),o=this.clock.objectives,op=req.operation;if(!seen&&o){const ids=op.type==='ORDER'?(this.clock.corps.find(g=>g.id===op.group)?.members??[]):['DIRECT','ASSIGN'].includes(op.type)?[op.unit]:[];for(const id of ids){delete o.orders[id];for(const s of Object.values(o.sides))delete s.units[id];}if(op.type==='ORDER')for(const s of Object.values(o.sides))delete s.groups[op.group];}return r;}
 save(){const s=super.save();s.objectiveRules=VERSION;return s;}
 restore(s,pause=true){if(s.objectiveRules!==VERSION||s.clock?.objectives?.version!==VERSION)throw Error('OBJECTIVE_RULES_MISMATCH_START_NEW_CAMPAIGN');super.restore(s,pause);}
 snapshot(draft){const d=super.snapshot(draft),o=this.clock.objectives;if(o){d.continuous.objectives=copy(o.sides[d.viewer]);d.continuous.objectives.scenario=this.clock.scenario??'NORMAL';for(const[id,row]of Object.entries(o.sides[d.viewer].units))if(d.continuous.tactical.units[id]&&row.task!=='WATCH')d.continuous.tactical.units[id].reason=row.reason;}return d;}
}
