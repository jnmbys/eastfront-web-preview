import assert from 'node:assert/strict';
import {
  defaultRules, defaultScenario, createGameState, makeEdge,
  movementStepCost, validateMoveAction, buildCombatContext,
  paperToAxial, axialToPaper, hexDistance, SeededRNG
} from '../dist/index.js';

const G='G-HUMAN-1', S='S-AI-1';
const unit=(id,templateId,side,type,hex,controllerId=side==='GERMAN'?G:S)=>({
  id,templateId,side,type,step:0,alive:true,hex,supplyState:'SUPPLIED',entrenched:false,
  hasMoved:false,hasAttacked:false,controllerId,temporarySupply:false,dedicatedRailRepair:false,
  reconZocIgnoreUsed:false,lastHQCommandTurn:null
});
const hexes=[];
for(let q=-2;q<=4;q++)for(let r=-3;r<=4;r++)hexes.push({coord:{q,r},terrain:'PLAIN',control:null});
const make=(units,edges=[])=>{const s=createGameState({scenario:defaultScenario,rules:defaultRules,hexes,edges,units,seed:77});for(const u of Object.values(s.units))if(u.alive&&u.side==='GERMAN')u.supplyState='SUPPLIED';s.phase='GERMAN_MOVEMENT';s.activeSide='GERMAN';return s;};

// Hex roundtrip
for(const label of ['A1','J6','R10','AC10','AF20']){
  const m=/^([A-Z]+)(\d+)$/.exec(label);
  assert.equal(axialToPaper(paperToAxial(m[1],Number(m[2]))).label,label);
}
assert.equal(hexDistance({q:0,r:0},{q:3,r:-2}),3);

// Road + bridge movement
{
  const a={q:0,r:0},b={q:1,r:0};
  const u=unit('g','G-INF','GERMAN','INFANTRY',a);
  const st=make([u],[makeEdge(a,b,{road:true,river:'MAJOR',bridge:{kind:'ROAD',destroyed:false}})]);
  st.hexes['1,0'].terrain='FOREST';
  assert.equal(movementStepCost(st,defaultRules,u,a,b).total,1);
}

// ZOC stop
{
  const st=make([unit('g','G-INF','GERMAN','INFANTRY',{q:0,r:0}),unit('s','S-INF','SOVIET','INFANTRY',{q:2,r:0})]);
  const v=validateMoveAction(st,defaultRules,{type:'MOVE',controllerId:G,unitId:'g',path:[{q:1,r:0},{q:1,r:-1}]});
  assert(v.issues.some(x=>x.code==='ENEMY_ZOC_STOP'));
}

// Combined arms + forest breakdown
{
  const target={q:0,r:0};
  const st=make([
    unit('pz','G-PANZER','GERMAN','PANZER',{q:-1,r:0}),
    unit('inf','G-INF','GERMAN','INFANTRY',{q:0,r:-1}),
    unit('s','S-INF','SOVIET','INFANTRY',target)
  ]);
  st.phase='GERMAN_COMBAT';
  st.hexes['0,0'].terrain='FOREST';
  const c=buildCombatContext(st,defaultRules,{type:'ATTACK',controllerId:G,attackerUnitIds:['pz','inf'],target});
  assert.equal(c.modifiers.combinedArmsShift,1);
  assert.equal(c.modifiers.terrainShift,-1);
}

// RNG replay
{
  const a=new SeededRNG(12345),b=new SeededRNG(12345);
  assert.deepEqual(Array.from({length:12},()=>a.roll2D6()),Array.from({length:12},()=>b.roll2D6()));
}
console.log('Digital Branch smoke checks passed.');
