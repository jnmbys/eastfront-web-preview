import assert from 'node:assert/strict';
import {RulesEngine,createGameState,defaultRules,defaultScenario,validateGameStateIntegrity} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
 id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
 hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
 reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const hexes=[];for(let q=-4;q<=4;q++)for(let r=-4;r<=4;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
const engine=new RulesEngine(defaultRules,defaultScenario);
function make(seed,{artillery=false,hq=false}={}){
 const units=[unit('g','G-INF','GERMAN','INFANTRY',{q:-1,r:0}),unit('s','S-ELITE','SOVIET','ELITE_INFANTRY',{q:0,r:0})];
 if(artillery)units.push(unit('sa','S-ARTY','SOVIET','ARTILLERY',{q:0,r:2}));
 if(hq)units.push(unit('shq','S-HQ','SOVIET','HQ',{q:1,r:0}));
 const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges:[],units,seed});
 // Fixture precondition: this combat smoke tests combat mechanics, not supply topology.
 for(const u of Object.values(st.units))if(u.alive)u.supplyState='SUPPLIED';
 st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function declare(st,battleId='B-C'){
 return engine.apply(st,{type:'ATTACK',battleId,controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0}});
}

// Declaration creates canonical transaction and global reaction lock.
{
 const d=declare(make(2722),'B-DECLARE');assert.equal(d.accepted,true);assert(d.state.combatTransactions['B-DECLARE']);assert.equal(d.state.pendingDecision?.kind,'DEFENDER_REACTION');
 assert(d.events.some(e=>e.type==='CombatDeclared'));assert.equal(d.state.units.g.hasAttacked,true);
 const blocked=engine.apply(d.state,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:-2,r:0}]});assert.equal(blocked.accepted,false);assert(blocked.issues.some(x=>x.code==='PENDING_DECISION_BLOCKS_ACTION'));
 assert.deepEqual(validateGameStateIntegrity(d.state,defaultRules),[]);
}

// Same seed/actions => identical deterministic dice, CRT and transaction resolution.
{
 const a=declare(make(2722),'B-DET');const b=declare(make(2722),'B-DET');
 const ra=engine.apply(a.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-DET'});const rb=engine.apply(b.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-DET'});
 assert.equal(ra.accepted,true);assert.equal(rb.accepted,true);assert.deepEqual(ra.state.combatTransactions['B-DET'].resolution,rb.state.combatTransactions['B-DET'].resolution);assert.deepEqual(ra.events,rb.events);
 assert(ra.events.some(e=>e.type==='DiceRolled'));assert(ra.events.some(e=>e.type==='CRTResolved'));
}

// 1:1 + seed 2722 rolls 8 => NE and closes immediately.
{
 const d=declare(make(2722),'B-NE');const r=engine.apply(d.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-NE'});const tx=r.state.combatTransactions['B-NE'];
 assert.equal(tx.resolution.crtResult,'NE');assert.equal(tx.stage,'CLOSED');assert.equal(r.state.pendingDecision,null);assert(r.events.some(e=>e.type==='CombatCompleted'));assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// A unique A1 allocation now auto-resolves in 002A-2A instead of creating a useless decision.
{
 const d=declare(make(22),'B-LOSS');const r=engine.apply(d.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-LOSS'});const tx=r.state.combatTransactions['B-LOSS'];
 assert.equal(tx.resolution.crtResult,'A1');assert.equal(r.state.units.g.step,1);assert.equal(tx.stage,'CLOSED');assert.equal(r.state.pendingDecision,null);assert(r.events.some(e=>e.type==='LossesAllocated'&&e.automatic===true));assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Retreat-only result creates RETREAT pending (seed 5392 => total 9 => DR at 1:1).
{
 const d=declare(make(5392),'B-RET');const r=engine.apply(d.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-RET'});const tx=r.state.combatTransactions['B-RET'];
 assert.equal(tx.resolution.crtResult,'DR');assert.equal(tx.stage,'RETREAT');assert.equal(r.state.pendingDecision?.kind,'RETREAT');assert.equal(r.state.pendingDecision?.side,'SOVIET');assert.deepEqual(validateGameStateIntegrity(r.state,defaultRules),[]);
}

// Defensive artillery is a defender-owned reaction, shifts CRT and is consumed once.
{
 const d=declare(make(2722,{artillery:true}),'B-ART');const a=engine.apply(d.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-ART',reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'sa'}});assert.equal(a.accepted,true);assert.equal(a.state.units.sa.artillerySupportUsed,true);
 const dup=engine.apply(a.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-ART',reaction:{kind:'DEFENDER_ARTILLERY',artilleryUnitId:'sa'}});assert.equal(dup.accepted,false);assert(dup.issues.some(x=>x.code==='INVALID_REACTION'||x.code==='ARTILLERY_ALREADY_USED'));
 const p=engine.apply(a.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-ART'});assert.equal(p.state.combatTransactions['B-ART'].context.modifiers.defenderArtilleryShift,-1);
}

// Last Stand validates, immediately spends CP/marks HQ, then contributes -1 CRT shift.
{
 const st=make(2722,{hq:true});st.cp.SOVIET=2;const d=declare(st,'B-LS');const ls=engine.apply(d.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-LS',reaction:{kind:'DEFENDER_HQ_COMMAND',hqUnitId:'shq',command:'LAST_STAND'}});assert.equal(ls.accepted,true);assert.equal(ls.state.cp.SOVIET,0);assert.equal(ls.state.units.shq.lastHQCommandTurn,ls.state.turn);
 const p=engine.apply(ls.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-LS'});assert.equal(p.state.combatTransactions['B-LS'].context.modifiers.hqShift,-1);
}


// Last Stand converts defender retreat to one extra loss instead of entering RETREAT.
{
 const st=make(8246,{hq:true});st.cp.SOVIET=2;
 const d=declare(st,'B-LS-CONVERT');
 const ls=engine.apply(d.state,{type:'COMBAT_REACTION',controllerId:S,battleId:'B-LS-CONVERT',reaction:{kind:'DEFENDER_HQ_COMMAND',hqUnitId:'shq',command:'LAST_STAND'}});
 const p=engine.apply(ls.state,{type:'PASS_REACTION',controllerId:S,battleId:'B-LS-CONVERT'});
 const tx=p.state.combatTransactions['B-LS-CONVERT'];
 assert.equal(tx.resolution.defenderRetreatSteps,0);
 assert.equal(tx.resolution.retreatConvertedToLoss,true);
 assert.equal(p.state.units.s.step,1);
 assert.equal(tx.stage,'CLOSED');
}

// Unvalidated attacker HQ effect cannot be smuggled through ATTACK payload.
{
 const st=make(22,{hq:true});const r=engine.apply(st,{type:'ATTACK',battleId:'B-HQ-SMUGGLE',controllerId:G,attackerUnitIds:['g'],target:{q:0,r:0},support:{attackerHQUnitId:'shq',attackerHQCommand:'FORCE_ATTACK'}});assert.equal(r.accepted,false);assert(r.issues.some(x=>x.code==='RULE_NOT_IMPLEMENTED'));assert.equal(r.state.combatTransactions['B-HQ-SMUGGLE'],undefined);
}

console.log('Digital Branch Task 002A-1 combat declaration/reaction/CRT smoke checks passed.');
