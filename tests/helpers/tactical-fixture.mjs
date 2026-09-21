import assert from 'node:assert/strict';
import {fixture,ordinary,unit} from './combat-fixture.mjs';
import {harness} from './animation-fixture.mjs';
import {observePresentationTransitions} from '../../dist/app/presentation/transitionBus.js';
import * as intents from '../../dist/app/interaction/intents.js';
import * as flow from '../../dist/app/interaction/combatFlow.js';

export function record(h){
 const events=[],batches=[];
 observePresentationTransitions(h.s,batch=>{events.push(...batch);batches.push({events:batch,coreEvents:h.s.lastResult.events,action:h.s.lastResult.action});});
 return Object.assign(h,{events,batches});
}
export function attack(h,attackers=['g'],target='d'){
 intents.selectCounter(h.s,h.p,attackers[0]);intents.selectCounter(h.s,h.p,target);
 for(const id of attackers.slice(1))intents.selectCounter(h.s,h.p,id);
 intents.attackAndContinue(h.s,h.p);h.remount();return h;
}
export function battleRun({multi=false,destroy=false,speed='normal'}={}){
 const units=ordinary();if(destroy)units[0].step=2;
 if(multi)units.push(unit('g2','G-PANZER','GERMAN','PANZER',{q:0,r:-1}),unit('g3','G-INF','GERMAN','INFANTRY',{q:1,r:-1}));
 const h=record(harness(fixture(destroy?22:2722,units),speed));
 return attack(h,multi?['g','g2','g3']:['g']);
}
export function tacticalRun(speed='normal'){
 const h=record(harness(fixture(8246,[unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),unit('d','S-TANK','SOVIET','TANK',{q:0,r:0}),unit('d2','S-INF','SOVIET','INFANTRY',{q:2,r:0})]),speed));
 attack(h,['p']);
 while(h.s.state.pendingDecision?.kind==='RETREAT'){
  const options=flow.retreatPlan(h.s,h.p).options;
  flow.chooseRetreatDestination(h.s,h.p,options.find(hex=>`${hex.q},${hex.r}`!=='1,0')??options[0]);h.remount();
 }
 flow.chooseAdvanceDestination(h.s,h.p,{q:0,r:0});h.remount();
 assert.equal(h.s.state.pendingDecision.kind,'BREAKTHROUGH_OPTION');
 intents.extendBreakthroughDraft(h.s,h.p,{q:1,r:0});intents.commitBreakthrough(h.s,h.p);h.remount();return h;
}
