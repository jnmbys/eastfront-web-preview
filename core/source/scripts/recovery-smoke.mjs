import assert from 'node:assert/strict';
import {
  RulesEngine,createGameState,defaultRules,defaultScenario,makeEdge,hexKey,
  computeGermanDerivedRailheadHexKeys,computeGermanRecoveryBaseHexKeys,
  computeSovietRecoveryBaseHexKeys,computeRecoveryBaseHexKeys,getRecoveryUnitLimit,
  validateRecoveryAction
} from '../dist/index.js';

const G1='G1',G2='G2',S1='S1',S2='S2';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const E=H(0,0),B=H(1,0),C=H(2,0),D=H(1,1),NEAR=H(3,0),FAR=H(4,0),EN=H(3,1),EN2=H(5,0);
const SI=H(10,0),SI2=H(10,2),SC=H(9,0),SD=H(8,0),SX=H(7,2),SY=H(8,2);
const template=(side,type)=>({
  GERMAN:{INFANTRY:'G-INF',PANZER:'G-PANZER',ARTILLERY:'G-ARTY',ENGINEER:'G-ENG',HQ:'G-HQ'},
  SOVIET:{INFANTRY:'S-INF',TANK:'S-TANK',ARTILLERY:'S-ARTY',ENGINEER:'S-ENG',HQ:'S-HQ'}
})[side][type];
const unit=(id,side,type,hex,{step=1,alive=true,supplyState='SUPPLIED',controllerId,hasMoved=false,hasAttacked=false,artillerySupportUsed=false,dedicatedRailRepair=false,entrenched=false,temporarySupply=false}={})=>({
  id,templateId:template(side,type),side,type,step,alive,hex:{...hex},supplyState,entrenched,hasMoved,hasAttacked,
  controllerId:controllerId??(side==='GERMAN'?G1:S1),temporarySupply,dedicatedRailRepair,reconZocIgnoreUsed:false,
  artillerySupportUsed,lastHQCommandTurn:null
});
const rail=(a,b,{repairedBy='GERMAN',destroyed=false}={})=>makeEdge(a,b,{railway:{present:true,repairedBy,destroyed}});
const hexes=(coords,terrain={})=>[...new Map(coords.map(h=>[hk(h),h])).values()].map(coord=>({coord:{...coord},terrain:terrain[hk(coord)]??'PLAIN',control:null}));
const controllers=[
  {id:G1,side:'GERMAN',controllerType:'HUMAN'},{id:G2,side:'GERMAN',controllerType:'HUMAN'},
  {id:S1,side:'SOVIET',controllerType:'HUMAN'},{id:S2,side:'SOVIET',controllerType:'HUMAN'}
];
function scenarioFor({west=[E],east=[],sources=[]}={}){
  return {...defaultScenario,id:'recovery-smoke',displayName:'Recovery Smoke',controllers,initialUnits:[],deployment:undefined,
    germanWestRailEntries:west.map(x=>({...x})),sovietEastRailExits:east.map(x=>({...x})),sovietSupplySources:sources.map(x=>({...x})),
    capitalCoreHexes:[],capitalOuterHexes:[]};
}
function rulesFor({distance=2,germanLimit=1,sovietSchedule}={}){
  const rules=structuredClone(defaultRules);rules.recovery.maxDistanceFromBase=distance;rules.recovery.maxUnitsPerTurn.GERMAN=germanLimit;
  if(sovietSchedule)rules.recovery.maxUnitsPerTurn.SOVIET=structuredClone(sovietSchedule);return rules;
}
function build({coords=[E,B,C,NEAR,FAR,EN,EN2],edges=[rail(E,B),rail(B,C)],units=[],terrain={},rules=rulesFor(),scenario=scenarioFor()}={}){
  const state=createGameState({scenario,rules,hexes:hexes(coords,terrain),edges,units,seed:5150});
  // Recovery tests intentionally control the authoritative snapshot/turn flags as fixtures.
  for(const original of units){const u=state.units[original.id];if(!u)continue;u.supplyState=original.supplyState;u.temporarySupply=original.temporarySupply;u.hasMoved=original.hasMoved;u.hasAttacked=original.hasAttacked;u.artillerySupportUsed=original.artillerySupportUsed;u.dedicatedRailRepair=original.dedicatedRailRepair;u.entrenched=original.entrenched;u.step=original.step;u.alive=original.alive;}
  return {state,rules,scenario,engine:new RulesEngine(rules,scenario)};
}
function recoveryPhase(state,side,turn=1){state.turn=turn;state.phase=side==='GERMAN'?'GERMAN_RECOVERY':'SOVIET_RECOVERY';state.activeSide=side;state.phaseReadyControllerIds=[];return state;}
const reason=(result,value)=>result.issues.some(i=>i.details?.reason===value);
const repair=(engine,state,controllerId,unitId)=>engine.apply(state,{type:'REPAIR_UNIT',controllerId,unitId});

// Recovery Base: German line terminal, branch terminals, and pure cycle semantics.
{
  let b=build();
  assert.deepEqual(computeGermanDerivedRailheadHexKeys(b.state,b.scenario),[hk(C)]);
  assert(!computeGermanDerivedRailheadHexKeys(b.state,b.scenario).includes(hk(E)));
  b=build({coords:[E,B,C,D],edges:[rail(E,B),rail(B,C),rail(B,D)]});
  assert.deepEqual(computeGermanDerivedRailheadHexKeys(b.state,b.scenario),[hk(C),hk(D)].sort());
  const X=H(0,1);b=build({coords:[E,B,X],edges:[rail(E,B),rail(B,X),rail(X,E)]});
  assert.deepEqual(computeGermanDerivedRailheadHexKeys(b.state,b.scenario),[]);
}

// German railway cities are bases only when active; stale HexState.control is irrelevant.
{
  const X=H(6,0),Y=H(7,0);const terrain={[hk(B)]:'CITY',[hk(X)]:'MAIN_CITY'};
  const b=build({coords:[E,B,C,X,Y],edges:[rail(E,B),rail(B,C),rail(X,Y)],terrain});
  b.state.hexes[hk(B)].control='SOVIET';
  const bases=computeGermanRecoveryBaseHexKeys(b.state,b.scenario);
  assert(bases.includes(hk(B)));assert(bases.includes(hk(C)));assert(!bases.includes(hk(X)));
  assert.deepEqual(computeRecoveryBaseHexKeys(b.state,'GERMAN',b.scenario),bases);
}

// Soviet bases = active independent source + city on full supply rail; disconnected city is not a base.
{
  const scenario=scenarioFor({west:[E],east:[],sources:[SI]});
  const terrain={[hk(SC)]:'CITY',[hk(SX)]:'CITY'};
  let b=build({coords:[SI,SC,SD,SX,SY,E],edges:[rail(SI,SC,{repairedBy:null}),rail(SC,SD,{repairedBy:'SOVIET'}),rail(SX,SY,{repairedBy:null})],terrain,scenario});
  b.state.hexes[hk(SI)].control='GERMAN';b.state.hexes[hk(SC)].control='GERMAN';
  let bases=computeSovietRecoveryBaseHexKeys(b.state,scenario);
  assert(bases.includes(hk(SI)));assert(bases.includes(hk(SC)));assert(!bases.includes(hk(SX)));
  // Occupation disables only that source; second independent source survives.
  const blocker=unit('block','GERMAN','INFANTRY',SI,{controllerId:G1});
  const scenario2=scenarioFor({sources:[SI,SI2]});
  b=build({coords:[SI,SI2,E],edges:[],units:[blocker],scenario:scenario2});
  bases=computeSovietRecoveryBaseHexKeys(b.state,scenario2);
  assert(!bases.includes(hk(SI)));assert(bases.includes(hk(SI2)));
}

// Custom Recovery distance is geometric and read from rules: distance 1 accepted, distance 2 rejected.
{
  const rules=rulesFor({distance:1});let b=build({units:[unit('near','GERMAN','INFANTRY',NEAR)],rules});recoveryPhase(b.state,'GERMAN');
  let r=repair(b.engine,b.state,G1,'near');assert.equal(r.accepted,true);
  b=build({units:[unit('far','GERMAN','INFANTRY',FAR)],rules});recoveryPhase(b.state,'GERMAN');
  r=repair(b.engine,b.state,G1,'far');assert.equal(r.accepted,false);assert(reason(r,'RECOVERY_BASE_TOO_FAR'));
}

// Normal SUPPLIED snapshot only; OOS and TEMPORARY_SUPPLY reject.
for(const [supply,accepted] of [['SUPPLIED',true],['OUT_OF_SUPPLY',false],['TEMPORARY_SUPPLY',false]]){
  const b=build({units:[unit(`u-${supply}`,'GERMAN','INFANTRY',C,{supplyState:supply,temporarySupply:supply==='TEMPORARY_SUPPLY'})]});recoveryPhase(b.state,'GERMAN');
  const r=repair(b.engine,b.state,G1,`u-${supply}`);assert.equal(r.accepted,accepted);
  if(!accepted)assert(reason(r,'NORMAL_SUPPLY_REQUIRED'));
}

// Movement/attack/artillery/dedicated engineer flags block Recovery with stable codes/reasons.
{
  const cases=[
    [unit('m','GERMAN','INFANTRY',C,{hasMoved:true}),'MOVED_THIS_TURN'],
    [unit('a','GERMAN','INFANTRY',C,{hasAttacked:true}),'UNIT_ALREADY_ATTACKED'],
    [unit('art','GERMAN','ARTILLERY',C,{artillerySupportUsed:true}),'ARTILLERY_USED_THIS_TURN'],
    [unit('eng','GERMAN','ENGINEER',C,{dedicatedRailRepair:true}),'DEDICATED_RAIL_REPAIR']
  ];
  for(const [u,expected] of cases){const b=build({units:[u]});recoveryPhase(b.state,'GERMAN');const r=repair(b.engine,b.state,G1,u.id);assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code===expected||i.details?.reason===expected));}
}

// Physical enemy adjacency blocks even non-ZOC HQ/artillery/engineer; dead/distance-2 enemies do not.
for(const enemyType of ['HQ','ARTILLERY','ENGINEER']){
  const target=unit('target','GERMAN','INFANTRY',NEAR),enemy=unit(`enemy-${enemyType}`,'SOVIET',enemyType,EN);
  const b=build({units:[target,enemy]});recoveryPhase(b.state,'GERMAN');const r=repair(b.engine,b.state,G1,'target');assert.equal(r.accepted,false);assert(reason(r,'ENEMY_ADJACENT'));
}
{
  let b=build({units:[unit('target','GERMAN','INFANTRY',NEAR),unit('dead','SOVIET','HQ',EN,{alive:false})]});recoveryPhase(b.state,'GERMAN');assert.equal(repair(b.engine,b.state,G1,'target').accepted,true);
  b=build({units:[unit('target','GERMAN','INFANTRY',NEAR),unit('far-enemy','SOVIET','HQ',EN2)]});recoveryPhase(b.state,'GERMAN');assert.equal(repair(b.engine,b.state,G1,'target').accepted,true);
}

// Full strength and destroyed units cannot recover; Recovery never revives destroyed units.
{
  let b=build({units:[unit('full','GERMAN','INFANTRY',C,{step:0})]});recoveryPhase(b.state,'GERMAN');let r=repair(b.engine,b.state,G1,'full');assert.equal(r.accepted,false);assert(reason(r,'UNIT_NOT_DAMAGED'));
  b=build({units:[unit('dead','GERMAN','INFANTRY',C,{step:1,alive:false})]});recoveryPhase(b.state,'GERMAN');r=repair(b.engine,b.state,G1,'dead');assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='UNIT_DESTROYED'));assert.equal(r.state.units.dead.alive,false);
}

// RP costs come from templates; each accepted action restores exactly one step and preserves entrenchment.
{
  let b=build({units:[unit('inf','GERMAN','INFANTRY',C,{step:2,entrenched:true})]});recoveryPhase(b.state,'GERMAN');b.state.rp.GERMAN=5;
  let r=repair(b.engine,b.state,G1,'inf');assert.equal(r.accepted,true);assert.equal(r.state.units.inf.step,1);assert.equal(r.state.rp.GERMAN,4);assert.equal(r.state.units.inf.entrenched,true);
  b=build({units:[unit('panzer','GERMAN','PANZER',C,{step:1})]});recoveryPhase(b.state,'GERMAN');b.state.rp.GERMAN=5;
  r=repair(b.engine,b.state,G1,'panzer');assert.equal(r.accepted,true);assert.equal(r.state.units.panzer.step,0);assert.equal(r.state.rp.GERMAN,3);
}

// Insufficient RP rejects atomically.
{
  const b=build({units:[unit('panzer','GERMAN','PANZER',C,{step:1})]});recoveryPhase(b.state,'GERMAN');b.state.rp.GERMAN=1;const before=structuredClone(b.state);
  const r=repair(b.engine,b.state,G1,'panzer');assert.equal(r.accepted,false);assert(reason(r,'INSUFFICIENT_RP'));assert.equal(r.state.units.panzer.step,before.units.panzer.step);assert.equal(r.state.rp.GERMAN,1);
}

// Same unit once per phase, even if still damaged and RP remains.
{
  const b=build({units:[unit('twostep','GERMAN','INFANTRY',C,{step:2})]});recoveryPhase(b.state,'GERMAN');b.state.rp.GERMAN=8;
  const first=repair(b.engine,b.state,G1,'twostep');assert.equal(first.accepted,true);assert.equal(first.state.units.twostep.step,1);
  const second=repair(b.engine,first.state,G1,'twostep');assert.equal(second.accepted,false);assert(reason(second,'UNIT_ALREADY_RECOVERED_THIS_TURN'));
}

// German limit is side-wide, not per-controller; rejected attempts do not consume it.
{
  const b=build({units:[unit('u1','GERMAN','INFANTRY',C,{controllerId:G1}),unit('u2','GERMAN','INFANTRY',NEAR,{controllerId:G2})]});recoveryPhase(b.state,'GERMAN');
  const first=repair(b.engine,b.state,G1,'u1');assert.equal(first.accepted,true);
  const second=repair(b.engine,first.state,G2,'u2');assert.equal(second.accepted,false);assert(reason(second,'RECOVERY_UNIT_LIMIT_REACHED'));
  const c=build({units:[unit('bad','GERMAN','INFANTRY',C,{step:0,controllerId:G1}),unit('good','GERMAN','INFANTRY',NEAR,{controllerId:G2})]});recoveryPhase(c.state,'GERMAN');
  const bad=repair(c.engine,c.state,G1,'bad');assert.equal(bad.accepted,false);const good=repair(c.engine,bad.state,G2,'good');assert.equal(good.accepted,true);
}

// Soviet schedule boundaries and unsorted schedules use highest matching fromTurn.
{
  assert.equal(getRecoveryUnitLimit(defaultRules,'SOVIET',4),1);assert.equal(getRecoveryUnitLimit(defaultRules,'SOVIET',5),2);
  assert.equal(getRecoveryUnitLimit(defaultRules,'SOVIET',9),2);assert.equal(getRecoveryUnitLimit(defaultRules,'SOVIET',10),3);
  const rules=rulesFor({sovietSchedule:[{fromTurn:10,maxUnits:3},{fromTurn:1,maxUnits:1},{fromTurn:5,maxUnits:2}]});
  assert.equal(getRecoveryUnitLimit(rules,'SOVIET',7),2);
}

// Permanent ownership is required; a battle commitment cannot authorize Recovery.
{
  const b=build({units:[unit('owned','GERMAN','INFANTRY',C,{controllerId:G1})]});recoveryPhase(b.state,'GERMAN');
  b.state.unitCommitments.fake={id:'fake',grantActionId:'A0',battleId:'B0',grantorControllerId:G1,authorizedControllerId:G2,unitIds:['owned'],createdTurn:1,createdPhase:'GERMAN_COMBAT',active:true};
  const r=repair(b.engine,b.state,G2,'owned');assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='NOT_UNIT_CONTROLLER'));
}

// No-collateral mutation and replay determinism. No Recovery-specific GameEvent is added.
{
  const other=unit('other','GERMAN','INFANTRY',FAR,{step:1}),target=unit('target','GERMAN','INFANTRY',C,{step:1});
  const b=build({units:[target,other]});recoveryPhase(b.state,'GERMAN');const before=structuredClone(b.state);const action={type:'REPAIR_UNIT',controllerId:G1,unitId:'target'};
  const r1=b.engine.apply(b.state,action),r2=b.engine.apply(b.state,action);assert.equal(r1.accepted,true);assert.deepEqual(r1.state,r2.state);assert.deepEqual(r1.events,r2.events);assert.deepEqual(r1.events,[]);
  assert.deepEqual(r1.state.edges,before.edges);assert.deepEqual(r1.state.hexes,before.hexes);assert.deepEqual(r1.state.controllers,before.controllers);assert.deepEqual(r1.state.cp,before.cp);assert.deepEqual(r1.state.random,before.random);assert.deepEqual(r1.state.victory,before.victory);assert.deepEqual(r1.state.units.other,before.units.other);
  for(const field of ['hex','alive','controllerId','supplyState','temporarySupply','hasMoved','hasAttacked','artillerySupportUsed','entrenched'])assert.deepEqual(r1.state.units.target[field],before.units.target[field]);
}

// Ready barrier guard: once a controller is Ready in Recovery, it cannot submit another Recovery action.
{
  const b=build({units:[unit('u1','GERMAN','INFANTRY',C,{controllerId:G1}),unit('u2','GERMAN','INFANTRY',NEAR,{controllerId:G2})]});recoveryPhase(b.state,'GERMAN');
  const ready=b.engine.apply(b.state,{type:'READY_FOR_PHASE_END',controllerId:G1});assert.equal(ready.accepted,true);assert.equal(ready.state.phase,'GERMAN_RECOVERY');
  const r=repair(b.engine,ready.state,G1,'u1');assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='CONTROLLER_ALREADY_READY'));
}

// Wrong phase/controller validation and public validator agree with RulesEngine orchestration.
{
  const b=build({units:[unit('u','GERMAN','INFANTRY',C)]});
  let issues=validateRecoveryAction(b.state,b.rules,b.scenario,{type:'REPAIR_UNIT',controllerId:G1,unitId:'u'});assert(issues.some(i=>i.code==='WRONG_PHASE'));
  recoveryPhase(b.state,'GERMAN');const r=repair(b.engine,b.state,'missing','u');assert.equal(r.accepted,false);assert(r.issues.some(i=>i.code==='INVALID_CONTROLLER'));
}

console.log('Digital Branch Task 002C-1 Recovery Core smoke checks passed.');
