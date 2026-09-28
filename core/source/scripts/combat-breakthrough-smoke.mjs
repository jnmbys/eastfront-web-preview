import assert from 'node:assert/strict';
import {RulesEngine,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity} from '../dist/index.js';

const G='G-HUMAN-1',G2='G-AI-2',S='S-AI-1';
const engine=new RulesEngine(defaultRules,defaultScenario);
const hex=(q,r,terrain='PLAIN')=>({coord:{q,r},terrain,control:null});
const grid=()=>{const out=[];for(let q=-5;q<=5;q++)for(let r=-5;r<=5;r++)out.push(hex(q,r));return out;};
const unit=(id,templateId,side,type,pos,controllerId=side==='GERMAN'?G:S,step=0)=>({
  id,templateId,side,type,step,alive:true,hex:{...pos},supplyState:'SUPPLIED',entrenched:true,hasMoved:false,hasAttacked:true,
  controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
function make(units,side='GERMAN'){
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes:grid(),edges:[],units,seed:321});
  // Fixture precondition: each breakthrough case explicitly declares its unit supply state.
  for(const u of units)if(st.units[u.id])st.units[u.id].supplyState=u.supplyState;
  st.phase=side==='GERMAN'?'GERMAN_COMBAT':'SOVIET_COMBAT';st.activeSide=side;
  return st;
}
function prepare(st,{battleId='B-BT',attackers=['p'],defenders=['d'],eligible=attackers,completed=[],max={},result='D1R',side='GERMAN',declaring=G,commitmentIds=[]}={}){
  const maxima={};for(const id of eligible)maxima[id]=max[id]??(st.units[id]?.step===2?1:2);
  const defenderSide=side==='GERMAN'?'SOVIET':'GERMAN';
  st.combatTransactions[battleId]={battleId,sourceBattleId:null,stage:'BREAKTHROUGH_OPTION',declaredByActionId:'A-D',declaringControllerId:declaring,
    attackerSide:side,defenderSide,attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[...commitmentIds],
    attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,
    resolution:{dice:{die1:5,die2:5,total:10},crtResult:result,attackerLossSteps:0,defenderLossSteps:0,attackerRetreatSteps:0,defenderRetreatSteps:1,retreatConvertedToLoss:false},
    unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side:defenderSide,steps:1,unitIds:[...defenders],resolved:true,impossible:false},retreatImpossibleExtraLossApplied:false,
    advance:{eligibleUnitIds:[...attackers],advancedUnitIds:[],resolved:true},breakthrough:{eligibleUnitIds:[...eligible],completedUnitIds:[...completed],maxHexesByUnitId:maxima,resolved:false},schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
  const remaining=eligible.filter(id=>!completed.includes(id));
  const owners=[...new Set(remaining.map(id=>st.units[id]?.controllerId).filter(Boolean))];
  st.pendingDecision={kind:'BREAKTHROUGH_OPTION',battleId,side,decisionOwnerControllerId:declaring,eligibleControllerIds:[...new Set([declaring,...owners])].sort(),eligibleUnitIds:[...remaining]};
  return st.combatTransactions[battleId];
}
const go=(st,unitId,path,battleId='B-BT',controllerId=G)=>engine.apply(st,{type:'BREAKTHROUGH',controllerId,battleId,unitId,path});
const pass=(st,battleId='B-BT',controllerId=G)=>engine.apply(st,{type:'PASS_BREAKTHROUGH',controllerId,battleId});
const codes=r=>r.issues.map(i=>i.code);
const sovietFar=()=>unit('d','S-INF','SOVIET','INFANTRY',{q:4,r:4},S);

// step 0/1 armor get two extra hexes; step 2 gets one.
for(const step of [0,1]){
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G,step),st=make([p,sovietFar()]);prepare(st,{result:'D1R'});
  const r=go(st,'p',[{q:1,r:0},{q:2,r:0}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.p.hex,{q:2,r:0});assert.equal(r.state.units.p.hasMoved,true);assert.equal(r.state.units.p.entrenched,false);assert(r.events.some(e=>e.type==='UnitBrokeThrough'));assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');
}
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G,2),st=make([p,sovietFar()]);prepare(st,{result:'D1R'});
  let r=go(st,'p',[{q:1,r:0},{q:2,r:0}]);assert(codes(r).includes('INVALID_BREAKTHROUGH'));
  r=go(st,'p',[{q:1,r:0}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.p.hex,{q:1,r:0});
}

// Non-armor, OOS, non-eligible and repeat execution are rejected.
{
  const i=unit('i','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),st=make([i,sovietFar()]);prepare(st,{attackers:['i'],eligible:['i']});assert(codes(go(st,'i',[{q:1,r:0}])).includes('INVALID_BREAKTHROUGH'));
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0});p.supplyState='OUT_OF_SUPPLY';const st2=make([p,sovietFar()]);prepare(st2);assert(codes(go(st2,'p',[{q:1,r:0}])).includes('INVALID_BREAKTHROUGH'));
  const p1=unit('p1','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),p2=unit('p2','G-PANZER','GERMAN','PANZER',{q:-1,r:1}),st3=make([p1,p2,sovietFar()]);prepare(st3,{attackers:['p1','p2'],eligible:['p1']});assert(codes(go(st3,'p2',[{q:1,r:0}])).includes('INVALID_BREAKTHROUGH'));
  const st4=make([p1,p2,sovietFar()]);prepare(st4,{attackers:['p1','p2'],eligible:['p1','p2']});const first=go(st4,'p1',[{q:1,r:0}]);assert.equal(first.accepted,true);assert(codes(go(first.state,'p1',[])).includes('INVALID_BREAKTHROUGH'));
}

// Path is extra movement after target: cannot bypass target; every extra step must be adjacent.
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),st=make([p,sovietFar()]);prepare(st);assert(codes(go(st,'p',[{q:-2,r:0}])).includes('NON_ADJACENT_HEX'));
  assert(codes(go(st,'p',[{q:1,r:0},{q:3,r:0}])).includes('NON_ADJACENT_HEX'));
}

// LAKE, MARSH and enemy occupation are forbidden on extra path.
for(const [terrain,expected] of [['LAKE','IMPASSABLE_TERRAIN'],['MARSH','INVALID_BREAKTHROUGH']]){
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),st=make([p,sovietFar()]);st.hexes['1,0'].terrain=terrain;prepare(st);assert(codes(go(st,'p',[{q:1,r:0}])).includes(expected));
}
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),e=unit('e','S-INF','SOVIET','INFANTRY',{q:1,r:0},S),st=make([p,e,sovietFar()]);prepare(st,{defenders:['d']});assert(codes(go(st,'p',[{q:1,r:0}])).includes('ENEMY_OCCUPIED_HEX'));
}

// Entering enemy ZOC stops; target-ZOC transit differs from starting a Breakthrough already in target.
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),z=unit('z','S-INF','SOVIET','INFANTRY',{q:2,r:-1},S),st=make([p,z,sovietFar()]);prepare(st,{defenders:['d']});assert(codes(go(st,'p',[{q:1,r:0},{q:1,r:1}])).includes('ENEMY_ZOC_STOP'));

  const transit=unit('transit','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),targetZoc=unit('tz','S-INF','SOVIET','INFANTRY',{q:0,r:-1},S),transitState=make([transit,targetZoc,sovietFar()]);prepare(transitState,{attackers:['transit'],eligible:['transit'],defenders:['d']});assert(codes(go(transitState,'transit',[{q:1,r:0}])).includes('ENEMY_ZOC_STOP'));

  const advanced=unit('advanced','G-PANZER','GERMAN','PANZER',{q:0,r:0}),startZoc=unit('sz','S-INF','SOVIET','INFANTRY',{q:0,r:-1},S),advancedState=make([advanced,startZoc,sovietFar()]);prepare(advancedState,{attackers:['advanced'],eligible:['advanced'],defenders:['d']});assert.equal(go(advancedState,'advanced',[{q:1,r:0}]).accepted,true);

  const p2=unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),z2=unit('z','S-INF','SOVIET','INFANTRY',{q:1,r:-1},S),st2=make([p2,z2,sovietFar()]);prepare(st2,{defenders:['d']});assert(codes(go(st2,'p',[{q:1,r:0}])).includes('ENEMY_ZOC_TO_ZOC'));
}

// Final stacking is enforced, but a full target does not block transient passage by another armor.
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),f1=unit('f1','G-INF','GERMAN','INFANTRY',{q:1,r:0}),f2=unit('f2','G-INF','GERMAN','INFANTRY',{q:1,r:0}),st=make([p,f1,f2,sovietFar()]);prepare(st);assert(codes(go(st,'p',[{q:1,r:0}])).includes('STACKING_LIMIT'));
  const p1=unit('p1','G-PANZER','GERMAN','PANZER',{q:0,r:0}),f=unit('f','G-INF','GERMAN','INFANTRY',{q:0,r:0}),p2=unit('p2','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),st2=make([p1,f,p2,sovietFar()]);prepare(st2,{attackers:['p1','p2'],eligible:['p1','p2'],completed:['p1']});const r=go(st2,'p2',[{q:1,r:0}]);assert.equal(r.accepted,true);assert.deepEqual(r.state.units.p2.hex,{q:1,r:0});
}

// Multiple armor process sequentially; PASS abandons all remaining options.
{
  const p1=unit('p1','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),p2=unit('p2','G-PANZER','GERMAN','PANZER',{q:0,r:-1}),st=make([p1,p2,sovietFar()]);prepare(st,{attackers:['p1','p2'],eligible:['p1','p2'],result:'D1R'});
  let r=go(st,'p1',[{q:1,r:0}]);assert.equal(r.state.combatTransactions['B-BT'].stage,'BREAKTHROUGH_OPTION');assert.deepEqual(r.state.pendingDecision.eligibleUnitIds,['p2']);assert.deepEqual(r.state.combatTransactions['B-BT'].breakthrough.completedUnitIds,['p1']);
  r=go(r.state,'p2',[{q:0,r:1}]);assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');assert.deepEqual(r.state.combatTransactions['B-BT'].breakthrough.completedUnitIds,['p1','p2']);assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);

  const a=unit('a','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),b=unit('b','G-PANZER','GERMAN','PANZER',{q:0,r:-1}),st2=make([a,b,sovietFar()]);prepare(st2,{attackers:['a','b'],eligible:['a','b'],result:'D1R'});let x=go(st2,'a',[{q:1,r:0}]);x=pass(x.state);assert.equal(x.accepted,true);assert.equal(x.state.combatTransactions['B-BT'].breakthrough.resolved,true);assert.deepEqual(x.state.combatTransactions['B-BT'].breakthrough.completedUnitIds,['a']);assert.equal(x.state.combatTransactions['B-BT'].stage,'CLOSED');
}

// Battle-scoped authority covers committed teammate armor without changing permanent owner.
{
  const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G2),st=make([loan,sovietFar()]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-BT',grantorControllerId:G2,authorizedControllerId:G,unitIds:['loan'],createdTurn:st.turn,createdPhase:st.phase,active:true};prepare(st,{attackers:['loan'],eligible:['loan'],result:'D2R',commitmentIds:['c']});
  const r=go(st,'loan',[{q:1,r:0}]);assert.equal(r.accepted,true);assert.equal(r.state.units.loan.controllerId,G2);assert.equal(r.state.pendingDecision?.decisionOwnerControllerId,G);assert(r.state.pendingDecision?.eligibleControllerIds.includes(G2));assert.equal(r.state.unitCommitments.c.active,true);assert.equal(r.state.combatTransactions['B-BT'].stage,'SCHWERPUNKT_OPTION');assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Schwerpunkt boundary: D1R never; D2R/D3R moved step0/1 German armor yes; step2/path=[]/non-German no.
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),st=make([p,sovietFar()]);prepare(st,{result:'D1R'});let r=go(st,'p',[{q:1,r:0}]);assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');
  for(const [result,step] of [['D2R',0],['D3R',1]]){const a=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G,step),x=make([a,sovietFar()]);prepare(x,{result});r=go(x,'p',[{q:1,r:0}]);assert.equal(r.state.combatTransactions['B-BT'].stage,'SCHWERPUNKT_OPTION');assert.deepEqual(r.state.combatTransactions['B-BT'].schwerpunkt.eligibleUnitIds,['p']);assert(r.events.some(e=>e.type==='SchwerpunktAvailable'));}
  const damaged=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G,2),x=make([damaged,sovietFar()]);prepare(x,{result:'D2R'});r=go(x,'p',[{q:1,r:0}]);assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');
  const idle=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),y=make([idle,sovietFar()]);prepare(y,{result:'D2R'});r=go(y,'p',[]);assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');assert.equal(r.events.some(e=>e.type==='UnitBrokeThrough'),false);
  const sTank=unit('s','S-TANK','SOVIET','TANK',{q:-1,r:0},S),gFar=unit('gd','G-INF','GERMAN','INFANTRY',{q:4,r:4},G),z=make([sTank,gFar],'SOVIET');prepare(z,{attackers:['s'],defenders:['gd'],eligible:['s'],result:'D2R',side:'SOVIET',declaring:S});r=go(z,'s',[{q:1,r:0}],'B-BT',S);assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');
}

// Commitments deactivate on actual close.
{
  const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G2),st=make([loan,sovietFar()]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-BT',grantorControllerId:G2,authorizedControllerId:G,unitIds:['loan'],createdTurn:st.turn,createdPhase:st.phase,active:true};prepare(st,{attackers:['loan'],eligible:['loan'],result:'D1R',commitmentIds:['c']});const r=go(st,'loan',[{q:1,r:0}]);assert.equal(r.state.combatTransactions['B-BT'].stage,'CLOSED');assert.equal(r.state.unitCommitments.c.active,false);assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

console.log('Digital Branch Task 002A-3A Actual Breakthrough / Schwerpunkt-boundary smoke checks passed.');
