import {Campaign as Base} from '../grand-vision-001/authority.mjs';
import {planSide,retreatSite,VERSION} from './policy.mjs';
import {travel} from '../grand-play-001/planner.mjs';
import {rules} from '../grand-play-001/rules.mjs';
import {hexKey as key,hexDistance as distance} from '../../vendor/eastfront-digital-core/dist/index.js';
import crypto from 'node:crypto';
const copy=structuredClone;
export class Campaign extends Base {
 constructor(){super();this.clock.tactical={version:VERSION,states:{},orders:{},withdrawals:{},metrics:{plans:0,maxMs:0,examined:0,withdrawn:0,blocked:0},events:[]};}
 ownOrder(id){const base=super.ownOrder(id),v=this.clock.units[id],g=this.clock.corps.find(g=>g.members.includes(id));return v?.direct||g?.order.paused?base:this.clock.tactical?.orders[id]??base;}
 enemyPlan(view){super.enemyPlan(view);const t=this.clock.tactical;if(!t)return;const start=performance.now();t.orders={};
  for(const side of ['GERMAN','SOVIET']){const v=this.fair(side).view,own=Object.fromEntries(v.units.filter(u=>u.side===side).map(u=>[u.id,{...this.capability(u.id),...copy(this.clock.units[u.id]),stock:this.econ.supply[u.id].stock}])),groups=this.clock.corps.filter(g=>g.side===side),prior=Object.fromEntries(Object.entries(t.states).filter(([id])=>own[id])),result=planSide(v,own,groups,prior,this.clock.tick);
   for(const [id,s] of Object.entries(result.states))if(s.phase==='WITHDRAW'&&prior[id]?.phase!=='WITHDRAW')this.clock.units[id].march=null;
   for(const id of Object.keys(prior))delete t.states[id];Object.assign(t.states,result.states);Object.assign(t.orders,result.orders);t.metrics.examined+=result.examined;
   for(const e of result.events){this.note(side,e.text,e.unit);t.events.push({tick:this.clock.tick,side,...e});}
  }t.events=t.events.slice(-500);t.metrics.plans++;t.metrics.maxMs=Math.max(t.metrics.maxMs,performance.now()-start);
 }
 decideAction(view,u,own,order,profile){const s=this.clock.tactical?.states[u.id];if(!this.clock.units[u.id].direct&&s?.phase==='WITHDRAW')return {kind:'REST',reason:s.reason};const d=super.decideAction(view,u,own,order,profile);if(!this.clock.units[u.id].direct&&s)d.reason=s.reason+'；'+d.reason;return d;}
 isWithdrawalInProgress(id){return !!this.clock.tactical?.withdrawals[id]||this.clock.tactical?.states[id]?.phase==='WITHDRAW';}
 // Execution only: target selection uses the authorized view; current authoritative occupancy adjudicates arrival, never feeds a policy probe.
 resolveTimedWithdrawal(units,views,caps){const t=this.clock.tactical,tick=this.clock.tick,arrivals=[];
  for(const u of units.filter(u=>u.alive)){
   const v=this.clock.units[u.id],s=t.states[u.id],o=this.ownOrder(u.id),want=v.org<rules.orgRetreat||v.engaged&&o?.kind==='RETREAT'||s?.phase==='WITHDRAW';let w=t.withdrawals[u.id];
   if(!want&&!w)continue;
   if(!w){const h=s?.phase==='WITHDRAW'?s.target:retreatSite(views[u.side],u,caps[u.id],o?.kind==='RETREAT'?o.target:this.clock.goals[u.side==='GERMAN'?0:2].hex,true);if(!h){if(v.org<rules.orgRetreat){v.personnel=Math.max(0,v.personnel-12);v.losses+=12;}v.reason='退路受阻，未完成撤离';t.metrics.blocked++;continue;}
    w=t.withdrawals[u.id]={from:copy(u.hex),to:copy(h),remaining:travel(views[u.side],u.hex,h,caps[u.id]),total:travel(views[u.side],u.hex,h,caps[u.id]),since:tick};v.march=null;v.rest=0;u.entrenched=false;
   }else {const signature=JSON.stringify([travel(views[u.side],u.hex,w.to,caps[u.id]),views[u.side].hexes.find(h=>key(h.coord)===key(w.to))?.control,views[u.side].units.filter(x=>distance(x.hex,w.to)<=1).map(x=>[x.id,key(x.hex)])]);if(w.blockedSignature===signature){v.reason='撤出受阻，已知占位未改变；等待局势变化';continue;}delete w.blockedSignature;if(--w.remaining<=0)arrivals.push({u,w});}
   v.reason=`正在脱离交战，尚未安全；撤出路段还需 ${Math.max(0,w.remaining)*5} 分钟`;
  }
  arrivals.sort((a,b)=>crypto.createHash('sha256').update(tick+':'+a.u.id).digest('hex').localeCompare(crypto.createHash('sha256').update(tick+':'+b.u.id).digest('hex')));
  for(const {u,w}of arrivals){const v=this.clock.units[u.id],occupied=units.filter(x=>x.alive&&key(x.hex)===key(w.to));
   if(occupied.some(x=>x.side!==u.side)||occupied.length>=rules.stack||!Number.isFinite(travel(views[u.side],u.hex,w.to,caps[u.id]))){w.remaining=1;w.blockedSignature=JSON.stringify([travel(views[u.side],u.hex,w.to,caps[u.id]),views[u.side].hexes.find(h=>key(h.coord)===key(w.to))?.control,views[u.side].units.filter(x=>distance(x.hex,w.to)<=1).map(x=>[x.id,key(x.hex)])]);v.reason='撤出路线当前受阻，仍在原地；已知状态改变后才重试';t.metrics.blocked++;continue;}
   u.hex=copy(w.to);v.personnel=Math.max(0,v.personnel-4);v.losses+=4;v.org=Math.max(25,v.org);v.march=null;v.retreat=true;v.reason='已完成撤出路段，进入整补；仍须观察敌军追击';this.spend(u.id,rules.moveQ);delete t.withdrawals[u.id];t.metrics.withdrawn++;
   const s=t.states[u.id];if(s){s.phase='RECOVER';s.until=tick+6;s.reason='已完成撤出路段，进入整补；仍须观察敌军追击';t.orders[u.id]={kind:'REFIT',target:copy(u.hex),risk:'LOW',paused:false};}
   this.note(u.side,'已完成有耗时撤出，承担原追击损失；开始整补',u.id);t.events.push({tick,side:u.side,unit:u.id,text:'WITHDRAWAL_ARRIVED',from:w.from,to:w.to});
  }
  return true;
 }
 transaction(req){const replay=this.receipts.has(req.id),result=super.transaction(req),op=req.operation,t=this.clock.tactical;if(!replay&&t){const ids=op.type==='ORDER'?(this.clock.corps.find(g=>g.id===op.group)?.members??[]):['DIRECT','ASSIGN'].includes(op.type)?[op.unit]:[];for(const id of ids){delete t.states[id];delete t.orders[id];delete t.withdrawals[id];}}return result;}
 save(){const s=super.save();s.tacticalRules=VERSION;return s;}
 restore(s,pause=true){if(s.tacticalRules!==VERSION||s.clock?.tactical?.version!==VERSION)throw Error('TACTICAL_RULES_MISMATCH_START_NEW_CAMPAIGN');super.restore(s,pause);}
 snapshot(draft){const d=super.snapshot(draft),t=this.clock.tactical;if(!t)return d;const own=new Set(d.game.message.payload.view.units.filter(u=>u.side===d.viewer).map(u=>u.id));
  d.continuous.tactical={version:VERSION,scenario:this.clock.scenario??'NORMAL',units:Object.fromEntries(Object.entries(t.states).filter(([id])=>own.has(id)).map(([id,s])=>[id,{phase:s.phase,reason:t.withdrawals[id]?this.clock.units[id].reason:s.phase==='RELIEF'&&key(this.state.units[id].hex)===key(s.target)?'接替部队已到达指定位置，下一步重新评估参战':s.reason,replacing:s.replacing??null}]))};
  for(const [id,w]of Object.entries(t.withdrawals)){if(!own.has(id)||!this.state.units[id].alive)continue;d.continuous.map.actions=d.continuous.map.actions.filter(a=>a.unit!==id);d.continuous.map.actions.push({id:'withdraw:'+id+':'+w.since,unit:id,kind:'RETREAT',from:w.from,to:w.to,path:[w.from,w.to],status:'EXECUTING',battleId:null,...(w.blockedSignature?{activity:'撤出受阻，等待已知通路变化'}:{progress:1-w.remaining/w.total,segment:{completed:w.total-w.remaining,total:w.total,remainingMinutes:w.remaining*5}}),reason:'撤出尚未完成，途中仍可能承受攻击'});}
  return d;
 }
}
