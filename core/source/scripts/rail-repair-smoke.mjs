import assert from 'node:assert/strict';
import {
  RulesEngine,computeActiveGermanRailNetwork,computeSupply,createGameState,defaultRules,defaultScenario,
  hexKey,makeEdge,validateRailRepairAction
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1',G2='G-HUMAN-2';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const plain=(coords)=>[...new Map(coords.map(h=>[hk(h),h])).values()].map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const rail=(a,b,{repairedBy=null,destroyed=false,present=true}={})=>makeEdge(a,b,{railway:{present,repairedBy,destroyed}});
const nonRail=(a,b)=>makeEdge(a,b,{});
const unit=(id,side,type,hex,{alive=true,supplyState='SUPPLIED',controllerId,templateId}={})=>({
  id,templateId:templateId??(side==='GERMAN'?(type==='ENGINEER'?'G-ENG':'G-INF'):(type==='ENGINEER'?'S-ENG':'S-INF')),
  side,type,step:0,alive,hex:{...hex},supplyState,entrenched:false,hasMoved:false,hasAttacked:false,
  controllerId:controllerId??(side==='GERMAN'?G:S),temporarySupply:supplyState==='TEMPORARY_SUPPLY',dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const rulesFor=({base=4,engineer=5,radius=5,branchCap=2,engineerBranchCap=3}={})=>{
  const rules=structuredClone(defaultRules);rules.rail.baseRepairPerTurn=base;rules.rail.engineerRepairPerTurn=engineer;
  rules.rail.branchCap=branchCap;rules.rail.engineerBranchCap=engineerBranchCap;rules.supply.germanRadius=radius;return rules;
};
const scenarioFor=(entries,{extraGerman=false}={})=>({...defaultScenario,id:'rail-repair-smoke',displayName:'Rail Repair Smoke',
  germanWestRailEntries:entries.map(x=>({...x})),sovietSupplySources:[],initialUnits:[],deployment:undefined,controllers:extraGerman?[...defaultScenario.controllers,{id:G2,side:'GERMAN',controllerType:'HUMAN'}]:defaultScenario.controllers});
function stateFor({entries,coords,edges,units=[],rules=rulesFor(),extraGerman=false}){
  const scenario=scenarioFor(entries,{extraGerman});
  const state=createGameState({scenario,rules,hexes:plain(coords),edges,units,seed:404});
  return {state,scenario,rules,engine:new RulesEngine(rules,scenario)};
}
const reason=(result,value)=>result.issues.some(i=>i.details?.reason===value);
const validationReason=(issues,value)=>issues.some(i=>i.details?.reason===value);
function endPhase(engine,state){
  const controllerId=state.activeSide==='GERMAN'?G:S;
  const r=engine.apply(state,{type:'END_PHASE',controllerId});assert.equal(r.accepted,true,`END_PHASE from ${state.phase}`);return r.state;
}
function toNextGermanSupply(engine,state){
  let s=state;let guard=0;
  do {s=endPhase(engine,s);if(++guard>12)throw new Error('phase loop');} while(s.phase!=='GERMAN_SUPPLY_RAIL');
  return s;
}

const E=H(0,0),A=H(1,0),B=H(2,0),C=H(3,0),D=H(4,0),N=H(2,-1),SOUTH=H(1,1);

// A/B — base allowance and custom values prove no 4/5 hardcoding.
{
  const rules=rulesFor({base:2,engineer:3});
  const edges=[rail(E,A),rail(A,B),rail(B,C)];
  let {state,engine}=stateFor({entries:[E],coords:[E,A,B,C],edges,rules});
  let r=engine.apply(state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edges[0].key,edges[1].key]});
  assert.equal(r.accepted,true);assert.equal(r.state.edges[edges[0].key].railway.repairedBy,'GERMAN');
  ({state,engine}=stateFor({entries:[E],coords:[E,A,B,C],edges,rules}));
  r=engine.apply(state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key)});
  assert.equal(r.accepted,false);assert(reason(r,'RAIL_REPAIR_LIMIT_EXCEEDED'));
}

// C — supplied engineer raises the total allowance and becomes dedicated.
{
  const rules=rulesFor({base:2,engineer:3});const eng=unit('eng','GERMAN','ENGINEER',E);
  const edges=[rail(E,A),rail(A,B),rail(B,C)];const built=stateFor({entries:[E],coords:[E,A,B,C],edges,units:[eng],rules});
  built.state.units.eng.supplyState='SUPPLIED';
  const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key),engineerUnitId:'eng'});
  assert.equal(r.accepted,true);assert.equal(r.state.units.eng.dedicatedRailRepair,true);
}

// D — every invalid engineer category rejects and cannot grant the engineer allowance.
{
  const rules=rulesFor({base:1,engineer:2});const e1=rail(E,A),e2=rail(A,B);
  const cases=[
    unit('oos','GERMAN','ENGINEER',E,{supplyState:'OUT_OF_SUPPLY'}),
    unit('temp','GERMAN','ENGINEER',E,{supplyState:'TEMPORARY_SUPPLY'}),
    unit('dead','GERMAN','ENGINEER',E,{alive:false}),
    unit('s-eng','SOVIET','ENGINEER',E),
    unit('inf','GERMAN','INFANTRY',E),
    unit('other','GERMAN','ENGINEER',E,{controllerId:G2})
  ];
  for(const candidate of cases){
    const built=stateFor({entries:[E],coords:[E,A,B],edges:[e1,e2],units:[candidate],rules,extraGerman:candidate.id==='other'});
    // createGameState performs normal supply refresh; restore explicit stale test preconditions where needed.
    if(candidate.id==='oos')built.state.units.oos.supplyState='OUT_OF_SUPPLY';
    if(candidate.id==='temp'){built.state.units.temp.supplyState='TEMPORARY_SUPPLY';built.state.units.temp.temporarySupply=true;}
    const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[e1.key,e2.key],engineerUnitId:candidate.id});
    assert.equal(r.accepted,false,`invalid engineer ${candidate.id}`);
    assert.equal(r.state.units[candidate.id]?.dedicatedRailRepair??false,false);
  }
}

// E — one accepted plan per German turn; a rejected attempt does not consume the opportunity.
{
  const connected=rail(E,A),next=rail(A,B),isolated=rail(C,D);
  let built=stateFor({entries:[E],coords:[E,A,B,C,D],edges:[connected,next,isolated]});
  let r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[isolated.key]});
  assert.equal(r.accepted,false);assert(reason(r,'RAIL_PLAN_DISCONNECTED'));
  r=built.engine.apply(r.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[connected.key]});
  assert.equal(r.accepted,true);
  const second=built.engine.apply(r.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[next.key]});
  assert.equal(second.accepted,false);assert(reason(second,'RAIL_REPAIR_ALREADY_USED'));
}

// F/G/H — actor/phase and plan-shape validation.
{
  const edge=rail(E,A),nr=nonRail(A,B);const built=stateFor({entries:[E],coords:[E,A,B],edges:[edge,nr]});
  let state=structuredClone(built.state);state.phase='GERMAN_MOVEMENT';
  assert.equal(built.engine.apply(state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key]}).accepted,false);
  assert.equal(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:S,edgeKeys:[edge.key]}).accepted,false);
  assert(reason(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[]}), 'EMPTY_RAIL_REPAIR_PLAN'));
  assert(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key,edge.key]}).issues.some(i=>i.code==='DUPLICATE_ID'));
  assert(reason(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:['missing']}),'UNKNOWN_RAIL_EDGE'));
  assert(reason(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[nr.key]}),'EDGE_HAS_NO_RAILWAY'));
}

// H/I/J — already-operational German edge rejects; destroyed German / Soviet / null rail can be converted.
{
  const operational=rail(E,A,{repairedBy:'GERMAN'});
  let built=stateFor({entries:[E],coords:[E,A],edges:[operational]});
  assert(reason(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[operational.key]}),'EDGE_ALREADY_GERMAN_REPAIRED'));
  for(const edge of [rail(E,A,{repairedBy:'GERMAN',destroyed:true}),rail(E,A,{repairedBy:'SOVIET'}),rail(E,A,{repairedBy:null})]){
    built=stateFor({entries:[E],coords:[E,A],edges:[edge]});
    const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key]});
    assert.equal(r.accepted,true);assert.equal(r.state.edges[edge.key].railway.destroyed,false);assert.equal(r.state.edges[edge.key].railway.repairedBy,'GERMAN');
  }
}

// K/L — an empty current network may be created from the west entry; a disconnected eastern plan rejects.
{
  const edges=[rail(E,A),rail(A,B),rail(B,C)];let built=stateFor({entries:[E],coords:[E,A,B,C],edges});
  let r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key)});
  assert.equal(r.accepted,true);assert.deepEqual(computeActiveGermanRailNetwork(r.state,built.scenario).edgeKeys,edges.map(x=>x.key).sort());
  const east=rail(C,D);built=stateFor({entries:[E],coords:[E,C,D],edges:[east]});
  r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[east.key]});
  assert.equal(r.accepted,false);assert(reason(r,'RAIL_PLAN_DISCONNECTED'));
}

// M — previewing the whole set permits bridging into an already repaired but inactive segment.
{
  const ea=rail(E,A,{repairedBy:'GERMAN'}),ab=rail(A,B),bc=rail(B,C,{repairedBy:'GERMAN'}),cd=rail(C,D);
  const built=stateFor({entries:[E],coords:[E,A,B,C,D],edges:[ea,ab,bc,cd],rules:rulesFor({base:2})});
  const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[ab.key,cd.key]});
  assert.equal(r.accepted,true);assert.deepEqual(computeActiveGermanRailNetwork(r.state,built.scenario).edgeKeys,[ea,ab,bc,cd].map(x=>x.key).sort());
}

// N — DR-002 ignores branchCap/engineerBranchCap and allows total allowance across branches.
{
  const rules=rulesFor({base:3,branchCap:0,engineerBranchCap:0});const edges=[rail(E,A),rail(A,N),rail(A,SOUTH)];
  const built=stateFor({entries:[E],coords:[E,A,N,SOUTH],edges,rules});
  const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key)});
  assert.equal(r.accepted,true);assert.equal(rules.rail.branchCap,0);
}

// O — a cycle preview terminates and activates all selected edges once connected to the entry.
{
  const X=H(1,-1),edges=[rail(E,A),rail(A,X),rail(X,E)];const built=stateFor({entries:[E],coords:[E,A,X],edges,rules:rulesFor({base:3})});
  const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key)});
  assert.equal(r.accepted,true);assert.equal(new Set(computeActiveGermanRailNetwork(r.state,built.scenario).edgeKeys).size,3);
}

// P/Q — live Soviet occupation blocks repair; death removes block. ZOC without occupation does not block it.
{
  const edge=rail(E,A),block=unit('block','SOVIET','INFANTRY',A);let built=stateFor({entries:[E],coords:[E,A],edges:[edge],units:[block]});
  let r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key]});assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='ENEMY_OCCUPIED_HEX'));
  r.state.units.block.alive=false;r=built.engine.apply(r.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key]});assert.equal(r.accepted,true);
  const z=H(1,1),zoc=unit('zoc','SOVIET','INFANTRY',z);built=stateFor({entries:[E],coords:[E,A,z],edges:[edge],units:[zoc]});
  assert.equal(built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key]}).accepted,true);
}

// R — edgeKeys order is set-like: reversed submission has identical legality and railway outcome.
{
  const edges=[rail(E,A),rail(A,B),rail(B,C)],rules=rulesFor({base:3});
  const one=stateFor({entries:[E],coords:[E,A,B,C],edges,rules}),two=stateFor({entries:[E],coords:[E,A,B,C],edges,rules});
  const r1=one.engine.apply(one.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key)});
  const r2=two.engine.apply(two.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:edges.map(x=>x.key).reverse()});
  assert.equal(r1.accepted,true);assert.equal(r2.accepted,true);assert.deepEqual(r1.state.edges,r2.state.edges);
}

// S — repair changes pure projection immediately but never refreshes this German turn's authoritative snapshot.
{
  const rules=rulesFor({base:1,radius:1});const active=rail(E,A,{repairedBy:'GERMAN'}),gap=rail(A,B),front=unit('front','GERMAN','INFANTRY',C,{supplyState:'SUPPLIED'});
  const built=stateFor({entries:[E],coords:[E,A,B,C],edges:[active,gap],units:[front],rules});
  assert.equal(built.state.units.front.supplyState,'OUT_OF_SUPPLY');
  let r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[gap.key]});
  assert.equal(r.accepted,true);assert.equal(computeSupply(r.state,'GERMAN',rules,built.scenario).unitSupply.front,'SUPPLIED');
  assert.equal(r.state.units.front.supplyState,'OUT_OF_SUPPLY');
  const next=toNextGermanSupply(built.engine,r.state);assert.equal(next.units.front.supplyState,'SUPPLIED');
}

// T — a dedicated engineer cannot MOVE / ATTACK / ENTRENCH, and next German Player Turn resets dedication.
{
  const rules=rulesFor({base:1,engineer:2}),repair=rail(E,A),eng=unit('eng','GERMAN','ENGINEER',E),enemy=unit('enemy','SOVIET','INFANTRY',A);
  const built=stateFor({entries:[E],coords:[E,A,SOUTH],edges:[repair],units:[eng,enemy],rules});built.state.units.eng.supplyState='SUPPLIED';
  // Enemy cannot occupy the selected endpoint during repair; keep it dead until after the plan is accepted.
  built.state.units.enemy.alive=false;
  let r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[repair.key],engineerUnitId:'eng'});assert.equal(r.accepted,true);const dedicated=r.state;assert.equal(dedicated.units.eng.dedicatedRailRepair,true);
  let s=structuredClone(dedicated);s.phase='GERMAN_MOVEMENT';s.activeSide='GERMAN';
  let attempt=built.engine.apply(s,{type:'MOVE',controllerId:G,unitId:'eng',path:[SOUTH]});assert.equal(attempt.accepted,false);assert(attempt.issues.some(i=>i.details?.reason==='DEDICATED_RAIL_REPAIR'));
  s=structuredClone(dedicated);s.phase='GERMAN_COMBAT';s.activeSide='GERMAN';s.units.enemy.alive=true;
  attempt=built.engine.apply(s,{type:'ATTACK',controllerId:G,attackerUnitIds:['eng'],target:A});assert.equal(attempt.accepted,false);assert(attempt.issues.some(i=>i.details?.reason==='DEDICATED_RAIL_REPAIR'));
  s=structuredClone(dedicated);s.phase='GERMAN_ENTRENCHMENT';s.activeSide='GERMAN';
  attempt=built.engine.apply(s,{type:'ENTRENCH',controllerId:G,unitId:'eng'});assert.equal(attempt.accepted,false);assert(attempt.issues.some(i=>i.details?.reason==='DEDICATED_RAIL_REPAIR'));
  const next=toNextGermanSupply(built.engine,dedicated);assert.equal(next.units.eng.dedicatedRailRepair,false);
}

// U — accepted base repair has no collateral mutation beyond selected rail state + normal action identity/log.
{
  const selected=rail(E,A),untouched=rail(B,C,{repairedBy:'SOVIET'}),g=unit('g','GERMAN','INFANTRY',B);
  const built=stateFor({entries:[E],coords:[E,A,B,C],edges:[selected,untouched],units:[g]});const before=structuredClone(built.state);
  const r=built.engine.apply(built.state,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[selected.key]});assert.equal(r.accepted,true);
  assert.deepEqual(r.state.units,before.units);assert.deepEqual(r.state.hexes,before.hexes);assert.deepEqual(r.state.controllers,before.controllers);
  assert.deepEqual(r.state.rp,before.rp);assert.deepEqual(r.state.cp,before.cp);assert.deepEqual(r.state.random,before.random);assert.deepEqual(r.state.victory,before.victory);
  assert.deepEqual(r.state.edges[untouched.key],before.edges[untouched.key]);
  assert.equal(r.state.edges[selected.key].railway.repairedBy,'GERMAN');assert.equal(r.state.edges[selected.key].railway.destroyed,false);
  assert.equal(r.state.actionLog.length,before.actionLog.length+1);
}

// Public validation helper uses the same DR-002 connectivity rule and never reads deprecated branch caps.
{
  const edge=rail(C,D),built=stateFor({entries:[E],coords:[E,C,D],edges:[edge],rules:rulesFor({branchCap:0,engineerBranchCap:0})});
  const issues=validateRailRepairAction(built.state,built.rules,built.scenario,{type:'RAIL_REPAIR',controllerId:G,edgeKeys:[edge.key]});
  assert(validationReason(issues,'RAIL_PLAN_DISCONNECTED'));
}

console.log('Digital Branch Task 002B-4 German Rail Repair Core / DR-002 smoke checks passed.');
