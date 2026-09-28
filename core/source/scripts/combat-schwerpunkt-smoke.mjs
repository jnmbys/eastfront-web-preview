import assert from 'node:assert/strict';
import {RulesEngine,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity} from '../dist/index.js';

const G='G-HUMAN-1',G2='G-AI-2',S='S-AI-1';
const engine=new RulesEngine(defaultRules,defaultScenario);
const hexes=[];for(let q=-6;q<=6;q++)for(let r=-6;r<=6;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S,step=0)=>({id,templateId,side,type,step,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:true,hasAttacked:true,controllerId,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
function make(units,seed=321){const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed});/* Fixture precondition: Schwerpunkt cases explicitly declare unit supply. */for(const u of units)if(st.units[u.id])st.units[u.id].supplyState=u.supplyState;st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;}
function installSource(st,{battleId='B-SRC',unitId='p',result='D2R',declaring=G,commitmentIds=[]}={}){
  st.units[unitId].hasAttacked=true;
  st.combatTransactions[battleId]={battleId,sourceBattleId:null,stage:'SCHWERPUNKT_OPTION',declaredByActionId:'A-SOURCE',declaringControllerId:declaring,attackerSide:'GERMAN',defenderSide:'SOVIET',attackerUnitIds:[unitId],defenderUnitIds:['old-d'],targetHex:{q:-1,r:0},commitmentIds:[...commitmentIds],attackerArtilleryUnitId:null,defenderArtilleryUnitId:null,attackerHQEffect:null,defenderHQEffect:null,defenderReactionPassed:true,context:null,resolution:{dice:{die1:5,die2:5,total:10},crtResult:result,attackerLossSteps:0,defenderLossSteps:result==='D2R'?2:3,attackerRetreatSteps:0,defenderRetreatSteps:2,retreatConvertedToLoss:false},unresolvedLosses:[],lossesApplied:{GERMAN:{},SOVIET:{}},retreat:{side:'SOVIET',steps:2,unitIds:['old-d'],resolved:true,impossible:false},retreatImpossibleExtraLossApplied:false,advance:{eligibleUnitIds:[unitId],advancedUnitIds:[],resolved:true},breakthrough:{eligibleUnitIds:[unitId],completedUnitIds:[unitId],maxHexesByUnitId:{[unitId]:2},resolved:true},schwerpunkt:{eligibleUnitIds:[unitId],selectedUnitId:null,childBattleId:null,resolved:false},isSchwerpunktSecondAttack:false,completedByActionId:null};
  st.pendingDecision={kind:'SCHWERPUNKT_OPTION',battleId,side:'GERMAN',decisionOwnerControllerId:declaring,eligibleControllerIds:[...new Set([declaring,st.units[unitId].controllerId])].sort(),eligibleUnitIds:[unitId]};
  st.actionLog.push({index:st.actionLog.length,actionId:'A-BREAK',battleId,turn:st.turn,phase:st.phase,action:{type:'BREAKTHROUGH',actionId:'A-BREAK',controllerId:declaring,battleId,unitId,path:[{q:0,r:0}]},accepted:true,validationCodes:[]});
}
const sp=(st,extra={})=>engine.apply(st,{type:'SCHWERPUNKT_ATTACK',controllerId:G,sourceBattleId:'B-SRC',unitId:'p',target:{q:1,r:0},...extra});
const codes=r=>r.issues.map(x=>x.code);

// PASS closes source, creates no child, and does not consume the once-per-turn ability.
{
 const st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0})]);installSource(st);
 const r=engine.apply(st,{type:'PASS_SCHWERPUNKT',controllerId:G,battleId:'B-SRC'});assert.equal(r.accepted,true);assert.equal(r.state.combatTransactions['B-SRC'].stage,'CLOSED');assert.equal(r.state.combatTransactions['B-SRC'].schwerpunkt.childBattleId,null);assert.equal(r.state.schwerpunktUsedOnTurn,null);assert(r.events.some(e=>e.type==='SchwerpunktPassed'));const ordinary=engine.apply(r.state,{type:'ATTACK',controllerId:G,attackerUnitIds:['p'],target:{q:1,r:0}});assert(codes(ordinary).includes('UNIT_ALREADY_ATTACKED'));assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Valid singular Schwerpunkt creates child, closes source, marks ability used, preserves hasAttacked=true.
{
 const st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0})]);installSource(st);
 const r=sp(st);assert.equal(r.accepted,true);const childId=r.battleId,child=r.state.combatTransactions[childId];assert(child);assert.equal(child.sourceBattleId,'B-SRC');assert.equal(child.isSchwerpunktSecondAttack,true);assert.deepEqual(child.attackerUnitIds,['p']);assert.equal(child.stage,'DEFENDER_REACTION');assert.equal(r.state.combatTransactions['B-SRC'].stage,'CLOSED');assert.equal(r.state.combatTransactions['B-SRC'].schwerpunkt.childBattleId,childId);assert.equal(r.state.schwerpunktUsedOnTurn,r.state.turn);assert.equal(r.state.units.p.hasAttacked,true);assert(r.events.some(e=>e.type==='SchwerpunktDeclared'));assert(r.events.some(e=>e.type==='CombatDeclared'&&e.battleId===childId&&e.sourceBattleId==='B-SRC'));
 const ordinary=engine.apply(r.state,{type:'ATTACK',controllerId:G,attackerUnitIds:['p'],target:{q:1,r:0}});assert(codes(ordinary).includes('PENDING_DECISION_BLOCKS_ACTION'));
 assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Target adjacency/enemy presence and once-per-turn gate.
{
 let st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:2,r:0})]);installSource(st);let r=sp(st,{target:{q:2,r:0}});assert(codes(r).includes('NOT_ADJACENT_TO_TARGET'));
 st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4})]);installSource(st);r=sp(st);assert(codes(r).includes('NO_DEFENDER'));
 st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0})]);installSource(st);st.schwerpunktUsedOnTurn=st.turn;r=sp(st);assert(codes(r).includes('SCHWERPUNKT_UNAVAILABLE'));
}

// Attacker artillery may be used once if owned by declaring controller; already-used or teammate artillery is rejected.
{
 let art=unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:0,r:1});art.hasAttacked=false;let st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0}),art]);installSource(st);let r=sp(st,{support:{attackerArtilleryUnitId:'ga'}});assert.equal(r.accepted,true);assert.equal(r.state.units.ga.artillerySupportUsed,true);assert.equal(r.state.combatTransactions[r.battleId].attackerArtilleryUnitId,'ga');
 art=unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:0,r:1});art.artillerySupportUsed=true;st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0}),art]);installSource(st);st.units.ga.artillerySupportUsed=true;r=sp(st,{support:{attackerArtilleryUnitId:'ga'}});assert(codes(r).includes('ARTILLERY_ALREADY_USED'));
 art=unit('ga','G-ARTY','GERMAN','ARTILLERY',{q:0,r:1},G2);st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0}),art]);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};installSource(st);r=sp(st,{support:{attackerArtilleryUnitId:'ga'}});assert(codes(r).includes('NOT_UNIT_CONTROLLER'));
}

// Committed teammate armor inherits battle-scoped authority into child through deterministic child commitment.
{
 const loan=unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0},G2),st=make([loan,unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0})],53);st.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI'};st.unitCommitments.c={id:'c',grantActionId:'A-C',battleId:'B-SRC',grantorControllerId:G2,authorizedControllerId:G,unitIds:['p'],createdTurn:st.turn,createdPhase:st.phase,active:true};installSource(st,{commitmentIds:['c']});const r=sp(st);assert.equal(r.accepted,true);const child=r.state.combatTransactions[r.battleId];assert.equal(child.declaringControllerId,G);assert.equal(child.commitmentIds.length,1);const inherited=r.state.unitCommitments[child.commitmentIds[0]];assert.equal(inherited.grantorControllerId,G2);assert.equal(inherited.authorizedControllerId,G);assert.equal(inherited.battleId,r.battleId);assert.equal(inherited.active,true);assert.equal(r.state.unitCommitments.c.active,false);let done=engine.apply(r.state,{type:'PASS_REACTION',controllerId:S,battleId:r.battleId});assert.equal(done.state.combatTransactions[r.battleId].stage,'CLOSED');assert.equal(done.state.unitCommitments[child.commitmentIds[0]].active,false);assert.deepEqual(validateGameStateIntegrity(done.state,defaultRules),[]);
}

// -1 modifier comes from GameRules; total shift still obeys the existing +/-2 cap. Defensive reaction remains normal.
{
 const p=unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),d=unit('d','S-AT','SOVIET','ANTI_TANK',{q:1,r:0}),da=unit('da','S-ARTY','SOVIET','ARTILLERY',{q:1,r:2});da.hasAttacked=false;const st=make([p,unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),d,da],2722);st.hexes['1,0'].terrain='FOREST';installSource(st);let r=sp(st);const childId=r.battleId;r=engine.apply(r.state,{type:'COMBAT_REACTION',controllerId:S,battleId:childId,reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'da'}});assert.equal(r.accepted,true);r=engine.apply(r.state,{type:'PASS_REACTION',controllerId:S,battleId:childId});const ctx=r.state.combatTransactions[childId].context;assert.equal(ctx.modifiers.secondAttackShift,defaultRules.combat.schwerpunktSecondAttackShift);assert.equal(ctx.modifiers.secondAttackShift,-1);assert.equal(ctx.finalShift,-2);assert.equal(r.state.combatTransactions[childId].breakthrough,null);
}

// Last Stand works normally in child.
{
 const h=unit('hq','S-HQ','SOVIET','HQ',{q:2,r:0});h.hasAttacked=false;const st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0}),h],5392);st.cp.SOVIET=2;installSource(st);let r=sp(st);const childId=r.battleId;r=engine.apply(r.state,{type:'COMBAT_REACTION',controllerId:S,battleId:childId,reaction:{kind:'DEFENDER_HQ_COMMAND',hqUnitId:'hq',command:'LAST_STAND'}});assert.equal(r.accepted,true);r=engine.apply(r.state,{type:'PASS_REACTION',controllerId:S,battleId:childId});assert.equal(r.state.combatTransactions[childId].context.modifiers.hqShift,-1);
}

// Child D1R/D2R/D3R never creates Breakthrough/Schwerpunkt; normal Advance remains available and closes child afterward.
for(const [seed,expected,retreatPath] of [[5392,'D1R',[{q:2,r:0}]],[8246,'D2R',[{q:2,r:0},{q:3,r:0}]],[10785,'D3R',[]]]){
 const st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0})],seed);installSource(st);let r=sp(st);const childId=r.battleId;r=engine.apply(r.state,{type:'PASS_REACTION',controllerId:S,battleId:childId});const tx=r.state.combatTransactions[childId];assert.equal(tx.resolution.crtResult,expected);assert.equal(tx.breakthrough,null);assert.equal(tx.schwerpunkt,null);
 if(r.state.pendingDecision?.kind==='RETREAT')r=engine.apply(r.state,{type:'RETREAT',controllerId:S,battleId:childId,retreats:[{unitId:'d',path:retreatPath}]});
 assert.equal(r.state.pendingDecision?.kind,'ADVANCE_AFTER_COMBAT');r=engine.apply(r.state,{type:'ADVANCE_AFTER_COMBAT',controllerId:G,battleId:childId,unitId:'p'});assert.equal(r.accepted,true);assert.equal(r.state.combatTransactions[childId].stage,'CLOSED');assert.equal(r.state.combatTransactions[childId].breakthrough,null);assert.equal(r.state.combatTransactions[childId].schwerpunkt,null);assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Deterministic replay: source + child ids, action/random/state are identical.
{
 const build=()=>{const st=make([unit('p','G-PANZER','GERMAN','PANZER',{q:0,r:0}),unit('old-d','S-INF','SOVIET','INFANTRY',{q:4,r:4}),unit('d','S-INF','SOVIET','INFANTRY',{q:1,r:0})],2722);installSource(st);return st;};
 const a=sp(build()),b=sp(build());assert.equal(a.battleId,b.battleId);assert.deepEqual(a.action,b.action);assert.deepEqual(a.state.random,b.state.random);assert.deepEqual(a.state,b.state);
}

console.log('Digital Branch Task 002A-3B Schwerpunkt Second Attack smoke checks passed.');
