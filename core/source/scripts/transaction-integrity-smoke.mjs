import assert from 'node:assert/strict';
import {
  RulesEngine, defaultRules, defaultScenario, createGameState,
  getBattleIdLifecycle, validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1', G2='G-AI-2', S='S-AI-1';
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
  id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
  hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const hexes=[];
for(let q=-3;q<=4;q++) for(let r=-3;r<=4;r++) hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
const make=(units=[])=>{
  const s=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed:99});
  s.phase='GERMAN_MOVEMENT';s.activeSide='GERMAN';return s;
};
const combat=()=>{
  const s=make([
    unit('g1','G-INF','GERMAN','INFANTRY',{q:-1,r:0},G),
    unit('g2','G-INF','GERMAN','INFANTRY',{q:0,r:-1},G2),
    unit('s1','S-INF','SOVIET','INFANTRY',{q:0,r:0},S)
  ]);
  s.controllers[G2]={id:G2,side:'GERMAN',controllerType:'AI',displayName:'German AI 2'};
  s.phase='GERMAN_COMBAT';return s;
};
const engine=new RulesEngine(defaultRules,defaultScenario);

// P0-1 duplicate actionId must reject without entering canonical actionLog.
{
  const s=make([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0},G)]);
  const first=engine.apply(s,{type:'MOVE',actionId:'X',controllerId:G,unitId:'g',path:[{q:1,r:0}]});
  assert.equal(first.accepted,true);
  const second=engine.apply(first.state,{type:'MOVE',actionId:'X',controllerId:G,unitId:'g',path:[{q:2,r:0}]});
  assert.equal(second.accepted,false);
  assert(second.issues.some(x=>x.code==='ACTION_ID_DUPLICATE'));
  assert.deepEqual(second.state.actionLog.map(x=>x.actionId),['X']);
  assert.deepEqual(validateGameStateIntegrity(second.state,defaultRules),[]);
}

// P0-2 rejected draft attack -> teammate commitment -> retry same battleId.
{
  const s=combat();
  const proposal=engine.apply(s,{type:'ATTACK',actionId:'A-PROPOSE',battleId:'B-JOINT',controllerId:G,attackerUnitIds:['g1','g2'],target:{q:0,r:0}});
  assert.equal(proposal.accepted,false);
  assert(proposal.issues.some(x=>x.code==='UNAUTHORIZED_UNIT_COMMITMENT'));
  assert.equal(getBattleIdLifecycle(proposal.state,'B-JOINT'),'REJECTED_PROPOSAL');
  const grant=engine.apply(proposal.state,{type:'AUTHORIZE_UNIT_COMMITMENT',actionId:'A-GRANT',controllerId:G2,battleId:'B-JOINT',authorizedControllerId:G,unitIds:['g2']});
  assert.equal(grant.accepted,true);
  assert.equal(getBattleIdLifecycle(grant.state,'B-JOINT'),'RESERVED');
  const cid=Object.keys(grant.state.unitCommitments)[0];
  const retry=engine.apply(grant.state,{type:'ATTACK',actionId:'A-RETRY',battleId:'B-JOINT',controllerId:G,attackerUnitIds:['g1','g2'],commitmentIds:[cid],target:{q:0,r:0}});
  assert.equal(retry.accepted,true);
  assert(!retry.issues.some(x=>x.code==='BATTLE_ID_DUPLICATE'));
  assert(!retry.issues.some(x=>x.code==='UNAUTHORIZED_UNIT_COMMITMENT'));
  assert.equal(getBattleIdLifecycle(retry.state,'B-JOINT'),'ESTABLISHED');
  assert(retry.state.combatTransactions['B-JOINT']);
  assert.equal(retry.state.pendingDecision?.kind,'DEFENDER_REACTION');
}

// P0-3 pending decision globally locks the game, except matching decision action.
{
  const s=combat();
  const declared=engine.apply(s,{type:'ATTACK',actionId:'A-LOCK',battleId:'B-PENDING',controllerId:G,attackerUnitIds:['g1'],target:{q:0,r:0}});
  assert.equal(declared.accepted,true);
  const locked=declared.state;
  const blocked=[
    {type:'MOVE',controllerId:G,unitId:'g1',path:[{q:-2,r:0}]},
    {type:'TRANSFER_CONTROL',controllerId:G,assignment:{unitId:'g1',fromControllerId:G,toControllerId:G2}},
    {type:'READY_FOR_PHASE_END',controllerId:G},
    {type:'ATTACK',controllerId:G,battleId:'B-OTHER',attackerUnitIds:['g1'],target:{q:0,r:0}}
  ];
  let current=locked;
  for (const action of blocked) {
    const result=engine.apply(current,action);
    assert.equal(result.accepted,false);
    assert(result.issues.some(x=>x.code==='PENDING_DECISION_BLOCKS_ACTION'));
    current=result.state;
  }
  const matching=engine.apply(current,{type:'PASS_REACTION',controllerId:S,battleId:'B-PENDING'});
  assert.equal(matching.accepted,true);
  assert(!matching.issues.some(x=>x.code==='PENDING_DECISION_BLOCKS_ACTION'));
  assert(matching.events.some(x=>x.type==='DiceRolled'));
  assert(matching.events.some(x=>x.type==='CRTResolved'));
}

// Lightweight integrity additions.
{
  const s=make([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0},G)]);
  s.units.g.type='PANZER';
  s.activeSide='SOVIET';
  const codes=validateGameStateIntegrity(s,defaultRules).map(x=>x.code);
  assert(codes.includes('UNIT_TEMPLATE_TYPE_MISMATCH'));
  assert(codes.includes('ACTIVE_SIDE_PHASE_MISMATCH'));
}

console.log('Digital Branch Task 001.2 transaction-integrity regression checks passed.');
