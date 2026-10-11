// Directed authority diagnostics, never presented as a user's natural campaign.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {Campaign} from './authority.mjs';
import {seeds,scenarios,template} from './r1-forced.mjs';
import {PROFILE} from './catalog.mjs';
import {modelDemand} from '../grand-division-002/model-demand.mjs';
import {totals,validate} from '../grand-division-002/inventory.mjs';
import {refreshNetwork} from '../grand-economy-002/economy.mjs';
import {hexDistance,hexKey} from '../../vendor/eastfront-digital-core/dist/index.js';
export function observe(c,ids){
 const d={steps:0,combatSteps:0,inCombatOrgRecovery:0,restOrgRecovery:0,withdrawalOrgFloor:0,damage:{},withdrawalEvents:[],decisions:{},timeline:[]};let decisions={},fire={},rests={};
 const decide=c.decideAction.bind(c);c.decideAction=(...a)=>{const r=decide(...a);if(ids.includes(a[1].id))decisions[a[1].id]=structuredClone(r);return r;};
 const resolve=c.resolveDivisionCombat.bind(c);c.resolveDivisionCombat=a=>{resolve(a);fire=Object.fromEntries(ids.map(id=>[id,{people:a.damage[id]??0,orgPercent:a.orgDamage[id]??0}]));for(const id of ids){d.damage[id]??={people:0,orgPercent:0};d.damage[id].people+=fire[id].people;d.damage[id].orgPercent+=fire[id].orgPercent;}};
 const rest=c.restOrgRate.bind(c);c.restOrgRate=id=>{const r=rest(id);if(ids.includes(id)){const actual=Math.min(r,Math.max(0,100-c.clock.units[id].org));rests[id]=actual;d.restOrgRecovery+=actual;if(c.clock.units[id].engaged)d.inCombatOrgRecovery+=actual;}return r;};
 const withdraw=c.resolveTimedWithdrawal.bind(c);c.resolveTimedWithdrawal=(...args)=>{const before=Object.fromEntries(ids.map(id=>[id,{org:c.clock.units[id].org,hex:hexKey(c.state.units[id].hex),w:structuredClone(c.clock.tactical.withdrawals[id]??null)}]));const r=withdraw(...args);for(const id of ids){const u=c.state.units[id],v=c.clock.units[id],w=c.clock.tactical.withdrawals[id],old=before[id];if(!old.w&&w||old.w&&!w||w?.blockedSignature!==old.w?.blockedSignature){const row={tick:c.clock.tick,unit:id,kind:!old.w&&w?'START':old.w&&!w?'ARRIVE':w?.blockedSignature?'BLOCKED':'UNBLOCKED',orgBefore:old.org,orgAfter:v.org,from:old.hex,to:hexKey(u.hex),withdrawal:structuredClone(w??old.w),phase:c.clock.tactical.states[id]?.phase,trigger:{forcedOrg:v.org<18,peopleRatio:v.personnel/v.max,stock:c.econ.supply[id].stock,order:c.ownOrder(id)?.kind,tactical:c.clock.tactical.states[id]?.reason},reason:v.reason};d.withdrawalEvents.push(row);}if(v.org>old.org)d.withdrawalOrgFloor+=v.org-old.org;}return r;};
 const row=()=>Object.fromEntries(ids.map(id=>{const u=c.state.units[id],v=c.clock.units[id],p=c.clock.divisionLedger.units[id],a=c.divisionAttributes(id);return[id,{hex:hexKey(u.hex),alive:u.alive,personnel:p.personnel,held:structuredClone(p.held),org:p.org,orgMax:a.paper.orgMax,orgPercent:v.org,supply:v.dailySupply?{need:v.dailySupply.need,received:v.dailySupply.received,effective:v.dailySupply.effective,carriedHours:v.dailySupply.carriedHours,reason:v.dailySupply.reason,route:v.dailySupply.route?{hub:v.dailySupply.route.hub,source:v.dailySupply.route.source,railEdges:v.dailySupply.route.path.length}:null}:null,stock:c.econ.supply[id].stock,fuel:c.clock.divisionLedger.fuel.units[id]??0,entrenched:u.entrenched,works:c.clock.divisionLedger.balance.works?.[id]?.ticks??0,engaged:v.engaged,phase:c.clock.tactical.states[id]?.phase??null,withdrawal:structuredClone(c.clock.tactical.withdrawals[id]??null),reason:v.reason,restRecovery:rests[id]??0,decision:decisions[id]??null,fire:fire[id]??null,effective:a.effective}];}));
 d.timeline.push({tick:c.clock.tick,event:'START',units:row()});let priorKey='';
 return {data:d,after(){d.steps++;if(ids.some(id=>c.clock.units[id].engaged))d.combatSteps++;const units=row(),key=JSON.stringify(ids.map(id=>[units[id].alive,units[id].hex,units[id].phase,units[id].withdrawal?.since,!!units[id].engaged]));if(key!==priorKey||c.clock.tick%72===0){d.timeline.push({tick:c.clock.tick,event:key!==priorKey?'STATE_CHANGE':'6H',units});priorKey=key;}for(const id of ids){const k=decisions[id]?.reason??'none';d.decisions[k]=(d.decisions[k]??0)+1;}decisions={};fire={};rests={};},finish(){d.final=row();d.timeline.push({tick:c.clock.tick,event:'END',units:d.final});return d;}};
}
export function fixture(scenario,seed,control='officer',CampaignClass=Campaign){
 const c=new CampaignClass(),ids=['G-013','S-013'],p=c.clock.divisionLedger;
 c.clock.rng=seed;c.clock.autopause=false;c.clock.paused=false;
 for(const[id,u]of Object.entries(c.state.units)){
  u.alive=ids.includes(id);u.entrenched=false;c.clock.units[id].direct=null;c.clock.units[id].manual=null;c.clock.units[id].march=null;c.clock.units[id].losses=0;
  if(!u.alive){p.units[id].personnel=0;for(const k of Object.keys(p.units[id].held))p.units[id].held[k]=0;}
 }
 for(const [i,id]of ids.entries()){
  const t=template(scenario[i+1]);Object.assign(t,{id:'R1:'+id,version:1,status:'FORMAL',side:p.units[id].side,name:'定向对照 '+scenario[0]});p.formal.templates[t.id]=t;
  const u=p.units[id];u.templateId=t.id;u.templateVersion=1;u.target=modelDemand(t,PROFILE);u.personnel=u.target.manpower;u.held=structuredClone(u.target.equipment);u.org=c.divisionAttributes(id).paper.orgMax;
  c.state.units[id].hex={q:23+i,r:4};
 }
 c.bindModels();c.clock.tactical.states={};c.clock.tactical.orders={};c.clock.tactical.withdrawals={};
 for(const g of c.clock.corps){const id=ids.find(id=>g.members.includes(id));g.order={kind:g.side==='GERMAN'?'ADVANCE':'HOLD',target:{q:24,r:4},risk:'NORMAL',paused:!id};}
 for(const id of ids){const cap=c.divisionAttributes(id).effective.fuelHour*12,side=p.units[id].side,q=Math.min(p.nations[side].stock.FUEL,cap);p.nations[side].stock.FUEL-=q;p.fuel.units[id]=q;if(control==='manual')c.clock.units[id].direct={kind:id==='G-013'?'ATTACK':'HOLD',target:{q:24,r:4},risk:'NORMAL',paused:false};}
 p.initial=totals(p);c.attributeCache=new Map();c.observeVision();refreshNetwork(c);validate(p);
 return {c,ids};
}
export function natural(scenario,seed,control='officer',CampaignClass=Campaign){
 const {c,ids}=fixture(scenario,seed,control,CampaignClass),watch=observe(c,ids),initial=structuredClone(watch.data.timeline[0]),startLost=Object.fromEntries(ids.map(id=>[id,c.clock.units[id].losses]));let first=null,last=null,quiet=0,end='OBSERVATION_BUDGET';
 for(let i=0;i<576;i++){
  c.advance();watch.after();const fighting=c.clock.battles.some(b=>ids.every(id=>b.units.includes(id)));
  if(fighting){first??=c.clock.tick;last=c.clock.tick;quiet=0;}else if(first)quiet++;
  if(ids.some(id=>!c.state.units[id].alive)){end='PERSONNEL_ZERO';break;}
  if(first&&quiet>=12&&ids.every(id=>!c.clock.tactical.withdrawals[id])){end=hexDistance(c.state.units[ids[0]].hex,c.state.units[ids[1]].hex)>1?'CONTACT_ENDED_AFTER_SEPARATION':'ATTACK_STOPPED_ADJACENT';break;}
 }
 validate(c.clock.divisionLedger);const data=watch.finish();
 return {scenario:scenario[0],seed,heldout:seeds.slice(-2).includes(seed),control,kind:'Directed actual authority: two retained test units at real 23,4 / 24,4; other test units excluded. Finite initial nation pools; no ongoing injection. Normal AI, economic supply, withdrawal, movement and recovery remain enabled.',sameAsForced:'Same templates/full equipment/start org and seed; actual network/fuel/AI/replacement/withdrawal differ and are recorded. Not a natural campaign replay.',hours:c.clock.tick/12,first,last,end,losses:Object.fromEntries(ids.map(id=>[id,c.clock.units[id].losses-startLost[id]])),initial,...data};
}
if(process.argv[1]?.endsWith('r1-authority.mjs')){
 const rows=[];for(const name of ['infantry','artillery','armor'])for(const seed of seeds){const r=natural(scenarios.find(s=>s[0]===name),seed);console.log(JSON.stringify({scenario:name,seed,hours:r.hours,end:r.end,losses:r.losses,withdrawals:r.withdrawalEvents.length,recovery:r.inCombatOrgRecovery}));if(seed!==219031){delete r.timeline;delete r.initial;}rows.push(r);}
 const manual=natural(scenarios[1],219031,'manual');rows.push(manual);
 fs.mkdirSync('evidence/blackice-001-r1',{recursive:true});fs.writeFileSync('evidence/blackice-001-r1/authority.json',JSON.stringify({rules:'BLACKICE-001-LAND-1',noTuning:true,rows},null,2));
 assert(rows.every(r=>r.inCombatOrgRecovery===0));
}
