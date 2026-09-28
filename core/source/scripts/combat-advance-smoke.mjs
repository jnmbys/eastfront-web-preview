import assert from 'node:assert/strict';
import {
  RulesEngine,continueCombatAfterLosses,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',G2='G-AI-2',S='S-AI-1';
const engine=new RulesEngine(defaultRules,defaultScenario);
const plain=(q,r,terrain='PLAIN')=>({coord:{q,r},terrain,control:null});
const grid=(q0=-4,q1=4,r0=-4,r1=4)=>{const out=[];for(let q=q0;q<=q1;q++)for(let r=r0;r<=r1;r++)out.push(plain(q,r));return out;};
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
  id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
  hasMoved:false,hasAttacked:true,controllerId,temporarySupply:false,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
function make(units,hexes=grid()){
  const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed:123});
  for(const u of units)if(u.side==='GERMAN'&&st.units[u.id])st.units[u.id].supplyState=u.supplyState;
  st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';
  return st;
}
function resolution(crtResult='DR'){
  return{dice:{die1:4,die2:4,total:8},crtResult,attackerLossSteps:0,defenderLossSteps:0,attackerRetreatSteps:0,defenderRetreatSteps:crtResult==='DR'?1:0,retreatConvertedToLoss:false};
}
function prepareAdvance(st,{battleId='B-A',attackers=['g'],defenders=['d'],eligible=attackers,result='DR',commitmentIds=[]}={}){
  st.combatTransactions[battleId]={
    battleId,sourceBattleId:null,stage:'ADVANCE_AFTER_COMBAT',declaredByActionId:'A-DECL',declaringControllerId:G,
    attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[...attackers],defenderUnitIds:[...defenders],targetHex:{q:0,r:0},commitmentIds:[...commitmentIds],
    attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,
    resolution:resolution(result),unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},
    retreat:result==='DR'?{side:'SOVIET',steps:1,unitIds:[...defenders],resolved:true,impossible:false}:null,retreatImpossibleExtraLossApplied:false,
    advance:{eligibleUnitIds:[...eligible],advancedUnitIds:[],resolved:false},breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null
  };
  const owners=[...new Set(eligible.map(id=>st.units[id]?.controllerId).filter(Boolean))];
  st.pendingDecision={kind:'ADVANCE_AFTER_COMBAT',battleId,side:'GERMAN',decisionOwnerControllerId:G,eligibleControllerIds:[...new Set([G,...owners])].sort(),eligibleUnitIds:[...eligible]};
  return st.combatTransactions[battleId];
}
function addCommitment(st,battleId='B-A',unitId='loan'){
  st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};
  st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId,grantorControllerId:G2,authorizedControllerId:G,unitIds:[unitId],createdTurn:st.turn,createdPhase:st.phase,active:true};
  return 'c';
}
const codes=r=>r.issues.map(x=>x.code);
const advance=(st,battleId,unitId)=>engine.apply(st,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId,unitId});
const pass=(st,battleId)=>engine.apply(st,{type:'PASS_ADVANCE',controllerId:G,battleId});

// Real defender retreat prepares Advance After Combat and preserves battle commitment while open.
{
  const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0});
  const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0});d.hasAttacked=false;
  const st=make([g,d]);
  st.combatTransactions['B-R']={battleId:'B-R',sourceBattleId:null,stage:'RETREAT',declaredByActionId:'A-D',declaringControllerId:G,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:['g'],defenderUnitIds:['d'],targetHex:{q:0,r:0},commitmentIds:[],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:resolution('DR'),unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side:'SOVIET',steps:1,unitIds:['d'],resolved:false,impossible:false},retreatImpossibleExtraLossApplied:false,advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
  st.pendingDecision={kind:'RETREAT',battleId:'B-R',side:'SOVIET',decisionOwnerControllerId:S,eligibleControllerIds:[S],retreatSteps:1,unitIds:['d']};
  const r=engine.apply(st,{type:'RETREAT',controllerId:S,battleId:'B-R',retreats:[{unitId:'d',path:[{q:1,r:0}]}]});
  assert.equal(r.accepted,true);assert.equal(r.state.pendingDecision?.kind,'ADVANCE_AFTER_COMBAT');assert.deepEqual(r.state.combatTransactions['B-R'].advance?.eligibleUnitIds,['g']);assert.equal(r.events.some(e=>e.type==='AdvanceAvailable'),true);
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Valid singular advance: no MP/ZOC movement semantics, target occupation and flags/event.
{
  const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0});g.entrenched=true;g.hasMoved=false;
  const d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  const z=unit('z','S-INF','SOVIET','INFANTRY',{q:1,r:-1});z.hasAttacked=false; // exerts enemy ZOC onto target
  const st=make([g,d,z]);prepareAdvance(st);st.units.g.hasAttacked=true;
  const r=advance(st,'B-A','g');
  assert.equal(r.accepted,true);assert.deepEqual(r.state.units.g.hex,{q:0,r:0});assert.equal(r.state.units.g.hasMoved,true);assert.equal(r.state.units.g.entrenched,false);assert.equal(r.state.units.g.hasAttacked,true);assert.equal(r.state.units.g.controllerId,G);assert.equal(r.state.units.g.step,0);assert.equal(r.state.units.g.supplyState,'SUPPLIED');
  assert.equal(r.events.filter(e=>e.type==='UnitAdvanced').length,1);assert.equal(r.state.combatTransactions['B-A'].stage,'CLOSED');
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// PASS_ADVANCE is a real tactical choice: no movement and no fake UnitAdvanced.
{
  const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0});const d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  const st=make([g,d]);prepareAdvance(st);
  const r=pass(st,'B-A');assert.equal(r.accepted,true);assert.deepEqual(r.state.units.g.hex,{q:-1,r:0});assert.equal(r.events.some(e=>e.type==='UnitAdvanced'),false);
  assert.equal(r.state.combatTransactions['B-A'].advance?.resolved,true);assert.deepEqual(r.state.combatTransactions['B-A'].advance?.advancedUnitIds,[]);assert.equal(r.state.combatTransactions['B-A'].stage,'CLOSED');
}

// Non-eligible, destroyed and non-adjacent attackers are rejected without mutation.
{
  const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),x=unit('x','G-INF','GERMAN','INFANTRY',{q:-1,r:1}),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  let st=make([g,x,d]);prepareAdvance(st,{eligible:['g']});let r=advance(st,'B-A','x');assert.equal(r.accepted,false);assert(codes(r).includes('INVALID_ADVANCE'));
  st=make([g,d]);st.units.g.alive=false;prepareAdvance(st);r=advance(st,'B-A','g');assert.equal(r.accepted,false);assert(codes(r).includes('UNIT_DESTROYED'));
  const far=unit('g','G-INF','GERMAN','INFANTRY',{q:-2,r:0});st=make([far,d]);prepareAdvance(st);r=advance(st,'B-A','g');assert.equal(r.accepted,false);assert(codes(r).includes('NOT_ADJACENT_TO_TARGET'));
}

// Artillery cannot be selected even if a malformed transaction lists it as a direct eligible attacker.
{
  const a=unit('a','G-ARTY','GERMAN','ARTILLERY',{q:-1,r:0}),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  const st=make([a,d]);prepareAdvance(st,{attackers:['a'],defenders:['d'],eligible:['a']});const r=advance(st,'B-A','a');assert.equal(r.accepted,false);assert(codes(r).includes('INVALID_ADVANCE'));
}

// Enemy reoccupation and existing friendly stack limit are respected.
{
  const g=unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  let st=make([g,d]);prepareAdvance(st);const intruder=unit('e','S-INF','SOVIET','INFANTRY',{q:0,r:0});intruder.hasAttacked=false;st.units.e=intruder;
  let r=advance(st,'B-A','g');assert.equal(r.accepted,false);assert(codes(r).includes('INVALID_ADVANCE'));
  const f1=unit('f1','G-INF','GERMAN','INFANTRY',{q:0,r:0}),f2=unit('f2','G-INF','GERMAN','INFANTRY',{q:0,r:0});
  st=make([g,d,f1,f2]);prepareAdvance(st);r=advance(st,'B-A','g');assert.equal(r.accepted,false);assert(codes(r).includes('STACKING_LIMIT'));
}

// Declaring controller can advance a committed teammate unit without changing permanent owner.
{
  const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G2),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  const st=make([loan,d]);const cid=addCommitment(st);prepareAdvance(st,{attackers:['loan'],defenders:['d'],eligible:['loan'],commitmentIds:[cid]});
  assert.equal(st.unitCommitments.c.active,true);const r=advance(st,'B-A','loan');assert.equal(r.accepted,true);assert.equal(r.state.units.loan.controllerId,G2);assert.equal(r.state.combatTransactions['B-A'].stage,'CLOSED');assert.equal(r.state.unitCommitments.c.active,false);
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Battle-scoped authority regression: owner stays declaring controller after its own attacker dies and only committed teammate retreats.
{
  const own=unit('own','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G);own.step=2;
  const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:1},G2);const d=unit('d','S-INF','SOVIET','INFANTRY',{q:0,r:0});d.hasAttacked=false;
  const st=make([own,loan,d]);const cid=addCommitment(st,'B-AUTH','loan');
  const tx={battleId:'B-AUTH',sourceBattleId:null,stage:'LOSS_ALLOCATION',declaredByActionId:'A-D',declaringControllerId:G,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:['own','loan'],defenderUnitIds:['d'],targetHex:{q:0,r:0},commitmentIds:[cid],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:resolution('A3R'),unresolvedLosses:[{side:'GERMAN',steps:1,eligibleUnitIds:['own'],reason:'CRT'}],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side:'GERMAN',steps:1,unitIds:['own','loan'],resolved:false,impossible:false},retreatImpossibleExtraLossApplied:false,advance:null,breakthrough:null,schwerpunkt:null,isSchwerpunktSecondAttack:false,completedByActionId:null};
  st.combatTransactions['B-AUTH']=tx;const events=[];continueCombatAfterLosses(st,defaultRules,tx,'A-L',events);
  assert.equal(st.units.own.alive,false);assert.equal(st.pendingDecision?.kind,'RETREAT');assert.equal(st.pendingDecision?.decisionOwnerControllerId,G);assert(st.pendingDecision?.eligibleControllerIds.includes(G2));
  const r=engine.apply(st,{type:'RETREAT',controllerId:G,battleId:'B-AUTH',retreats:[{unitId:'loan',path:[{q:-2,r:1}]}]});assert.equal(r.accepted,true);assert.equal(r.state.units.loan.controllerId,G2);
}

// D1R/D2R/D3R create the multi-armor Breakthrough Option after either advance or pass.
for(const result of ['D1R','D2R','D3R']){
  const p0=unit('p0','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),p2=unit('p2','G-PANZER','GERMAN','PANZER',{q:0,r:-1});p2.step=2;
  const d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  const st=make([p0,p2,d]);prepareAdvance(st,{attackers:['p0','p2'],defenders:['d'],eligible:['p0','p2'],result});
  const r=result==='D1R'?advance(st,'B-A','p0'):pass(st,'B-A');assert.equal(r.accepted,true);assert.equal(r.state.combatTransactions['B-A'].stage,'BREAKTHROUGH_OPTION');assert.equal(r.state.pendingDecision?.kind,'BREAKTHROUGH_OPTION');
  assert.deepEqual(r.state.combatTransactions['B-A'].breakthrough?.eligibleUnitIds,['p0','p2']);assert.deepEqual(r.state.combatTransactions['B-A'].breakthrough?.maxHexesByUnitId,{p0:2,p2:1});
  assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// OOS-only armor and MARSH target suppress Breakthrough and close combat.
{
  const p=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0});p.supplyState='OUT_OF_SUPPLY';const d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  let st=make([p,d]);prepareAdvance(st,{attackers:['p'],defenders:['d'],eligible:['p'],result:'D1R'});let r=pass(st,'B-A');assert.equal(r.state.combatTransactions['B-A'].stage,'CLOSED');assert.equal(r.state.combatTransactions['B-A'].breakthrough,null);
  const p2=unit('p','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),d2=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d2.hasAttacked=false;
  const hexes=grid().map(h=>h.coord.q===0&&h.coord.r===0?plain(0,0,'MARSH'):h);st=make([p2,d2],hexes);prepareAdvance(st,{attackers:['p'],defenders:['d'],eligible:['p'],result:'D1R'});r=pass(st,'B-A');assert.equal(r.state.combatTransactions['B-A'].stage,'CLOSED');assert.equal(r.state.combatTransactions['B-A'].breakthrough,null);
}

// Commitment remains active through Advance -> Breakthrough boundary and deactivates only on actual CLOSED.
{
  const loan=unit('loan','G-PANZER','GERMAN','PANZER',{q:-1,r:0},G2),d=unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0});d.hasAttacked=false;
  const st=make([loan,d]);const cid=addCommitment(st);prepareAdvance(st,{attackers:['loan'],defenders:['d'],eligible:['loan'],result:'D1R',commitmentIds:[cid]});
  const r=pass(st,'B-A');assert.equal(r.state.combatTransactions['B-A'].stage,'BREAKTHROUGH_OPTION');assert.equal(r.state.unitCommitments.c.active,true);assert.equal(r.state.pendingDecision?.decisionOwnerControllerId,G);assert(r.state.pendingDecision?.eligibleControllerIds.includes(G2));assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

console.log('Digital Branch Task 002A-2B-3 Advance After Combat / breakthrough-boundary smoke checks passed.');
