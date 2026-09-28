import assert from 'node:assert/strict';
import {
  buildCombatContext,createGameState,defaultRules,defaultScenario,
  getLegalRetreatStepOptions,hasLegalRetreatExit,validateRetreatStep
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const center={q:0,r:0},attackerHex={q:-1,r:0};
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
 id,templateId,side,type,step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,
 hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
 reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const hexes=()=>{const out=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++)out.push({coord:{q,r},terrain:'PLAIN',control:null});return out;};
function state(defender,extras=[]){
 const initial=[unit('g','G-INF','GERMAN','INFANTRY',attackerHex,G),defender,...extras];
 const st=createGameState({scenario:defaultScenario,rules:defaultRules,hexes:hexes(),edges:[],units:initial,seed:123});
 // Fixture precondition: these retreat/encirclement cases explicitly choose defender supply states.
 for(const u of initial) if(u.side==='SOVIET'&&st.units[u.id]) st.units[u.id].supplyState=u.supplyState;
 st.phase='GERMAN_COMBAT';st.activeSide='GERMAN';return st;
}
function terrain(st,h,t){st.hexes[`${h.q},${h.r}`]={coord:{...h},terrain:t,control:null};}
function surround(st){for(const h of [{q:1,r:0},{q:1,r:-1},{q:0,r:-1},{q:-1,r:1},{q:0,r:1}])terrain(st,h,'LAKE');}

// normal empty adjacent legal
{
 const d=unit('d','S-INF','SOVIET','INFANTRY',center,S),st=state(d),to={q:1,r:0};
 assert.equal(validateRetreatStep(st,defaultRules,d,center,to).legal,true);
 assert(getLegalRetreatStepOptions(st,defaultRules,d,center).some(h=>h.q===1&&h.r===0));
 assert.equal(hasLegalRetreatExit(st,defaultRules,d,center),true);
}
// lake, enemy occupied, enemy ZOC, stacking full illegal
{
 const d=unit('d','S-INF','SOVIET','INFANTRY',center,S);let st=state(d);terrain(st,{q:1,r:0},'LAKE');
 assert(validateRetreatStep(st,defaultRules,d,center,{q:1,r:0}).issues.some(x=>x.code==='IMPASSABLE_TERRAIN'));
 assert(validateRetreatStep(st,defaultRules,d,center,attackerHex).issues.some(x=>x.code==='ENEMY_OCCUPIED_HEX'));
 assert(validateRetreatStep(st,defaultRules,d,center,{q:0,r:-1}).issues.some(x=>x.code==='ENEMY_ZOC_STOP'));
 st=state(d,[unit('f1','S-INF','SOVIET','INFANTRY',{q:1,r:0},S),unit('f2','S-INF','SOVIET','INFANTRY',{q:1,r:0},S)]);
 assert(validateRetreatStep(st,defaultRules,d,center,{q:1,r:0}).issues.some(x=>x.code==='STACKING_LIMIT'));
}
// OOS with exit unchanged
{
 const d=unit('d','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d.supplyState='OUT_OF_SUPPLY';const st=state(d);
 const c=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
 assert.equal(c.rawDefenseStrength,7);assert.equal(c.finalDefenseStrength,7);assert.equal(c.oosSurroundedDefenseHalved,false);
}
// all OOS + no exit => ceil(7/2)=4
{
 const d=unit('d','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d.supplyState='OUT_OF_SUPPLY';const st=state(d);surround(st);
 assert.equal(hasLegalRetreatExit(st,defaultRules,d,center),false);
 const c=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
 assert.equal(c.rawDefenseStrength,7);assert.equal(c.finalDefenseStrength,4);assert.equal(c.defenseStrength,4);assert.equal(c.oosSurroundedDefenseHalved,true);
}
// one supplied defender prevents halving
{
 const a=unit('a','S-HEAVY','SOVIET','HEAVY_TANK',center,S);a.supplyState='OUT_OF_SUPPLY';const b=unit('b','S-INF','SOVIET','INFANTRY',center,S);const st=state(a,[b]);surround(st);
 const c=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
 assert.equal(c.rawDefenseStrength,10);assert.equal(c.finalDefenseStrength,10);assert.equal(c.oosSurroundedDefenseHalved,false);
}
// temporary supplied prevents halving
{
 const d=unit('d','S-HEAVY','SOVIET','HEAVY_TANK',center,S);d.supplyState='TEMPORARY_SUPPLY';d.temporarySupply=true;const st=state(d);surround(st);
 const c=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['g'],target:center});
 assert.equal(c.finalDefenseStrength,7);assert.equal(c.oosSurroundedDefenseHalved,false);
}
console.log('Digital Branch Task 002A-2B-1 shared retreat legality / encirclement smoke checks passed.');
