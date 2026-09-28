import assert from 'node:assert/strict';
import {
  computeActiveGermanRailNetwork,
  computeSupply,
  computeSovietSupplyProjection,
  createGameState,
  defaultRules,
  defaultScenario,
  hexDistance,
  hexKey,
  makeEdge,
  validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const rail=(a,b,{repairedBy='GERMAN',destroyed=false,present=true,road=false}={})=>makeEdge(a,b,{road,railway:{present,repairedBy,destroyed}});
const road=(a,b)=>makeEdge(a,b,{road:true});
const uniqueCoords=(coords)=>{const m=new Map();for(const h of coords)m.set(hk(h),h);return [...m.values()];};
const hexes=(specs)=>specs.map((entry)=>{
  const coord='coord' in entry?entry.coord:entry;
  return {coord:{...coord},terrain:entry.terrain??'PLAIN',control:null};
});
const unit=(id,side,hex,{alive=true,supplyState='SUPPLIED',temporarySupply=false}={})=>({
  id,templateId:side==='GERMAN'?'G-INF':'S-INF',side,type:'INFANTRY',step:0,alive,hex:{...hex},supplyState,
  entrenched:false,hasMoved:false,hasAttacked:false,controllerId:side==='GERMAN'?G:S,temporarySupply,
  dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null
});
const scenarioFor=(entries,board={paperColumns:9,paperRows:6})=>({...defaultScenario,id:'german-supply-smoke',displayName:'German Supply Smoke',board,germanWestRailEntries:entries.map(h=>({...h})),sovietSupplySources:[],initialUnits:[],deployment:undefined});
const rulesWithRadius=(radius)=>{const rules=structuredClone(defaultRules);rules.supply.germanRadius=radius;return rules;};
function makeState({entries,coords,edges,units=[],rules=defaultRules,board}){
  const scenario=scenarioFor(entries,board);
  const states=coords.map((x)=>'coord' in x?x:{coord:x});
  const state=createGameState({scenario,rules,hexes:hexes(states),edges,units,seed:91});
  return {state,scenario,rules};
}
const assertSorted=(xs)=>assert.deepEqual(xs,[...xs].sort());

// 002G-3R1 — toy subsystem scenarios must not inherit production FA-003 deployment.
{
  const e=H(0,0),a=H(1,0);
  const built=makeState({entries:[e],coords:[e,a],edges:[rail(e,a)],units:[unit('g-fixture','GERMAN',a)]});
  assert.equal(built.scenario.deployment,undefined);
  const deploymentContaminationCodes=new Set([
    'DEPLOYMENT_COMPLETED_SIDE_UNIT_MISSING',
    'DEPLOYMENT_STATE_UNIT_MISMATCH',
    'DEPLOYMENT_ZONE_HEX_INVALID',
    'DEPLOYMENT_STATE_HEX_INVALID',
    'DEPLOYMENT_STATE_UNIT_UNREGISTERED'
  ]);
  const issues=validateGameStateIntegrity(built.state,built.rules,built.scenario);
  assert.equal(issues.some((x)=>deploymentContaminationCodes.has(x.code)),false,
    `toy german-supply scenario must not inherit production deployment integrity: ${JSON.stringify(issues)}`);
}

// A/B — default radius is read from rules: source, exact radius, and radius+1; supplied hexes are real/sorted.
{
  const radius=defaultRules.supply.germanRadius;
  const e=H(0,0),a=H(1,0),atRadius=H(1+radius,0),outside=H(2+radius,0);
  const coords=[];for(let q=0;q<=2+radius;q++)coords.push(H(q,0));
  const units=[unit('g-source','GERMAN',a),unit('g-edge','GERMAN',atRadius),unit('g-out','GERMAN',outside)];
  const {state,scenario}=makeState({entries:[e],coords,edges:[rail(e,a)],units});
  const before=structuredClone(state),result=computeSupply(state,'GERMAN',defaultRules,scenario);
  assert.equal(result.unitSupply['g-source'],'SUPPLIED');
  assert.equal(result.unitSupply['g-edge'],'SUPPLIED');
  assert.equal(result.unitSupply['g-out'],'OUT_OF_SUPPLY');
  assert(result.suppliedHexKeys.includes(hk(e))&&result.suppliedHexKeys.includes(hk(a)));
  assert(result.suppliedHexKeys.every(k=>state.hexes[k]!==undefined));
  assert(result.suppliedHexKeys.every(k=>result.sourceHexKeys.some(s=>hexDistance(state.hexes[k].coord,state.hexes[s].coord)<=radius)));
  assertSorted(result.sourceHexKeys);assertSorted(result.suppliedHexKeys);
  assert.deepEqual(state,before); // N — pure derivation.
}

// A custom radius proves the implementation does not hard-code 5.
{
  const rules=rulesWithRadius(2),e=H(0,0),a=H(1,0),r2=H(3,0),r3=H(4,0);
  const {state,scenario}=makeState({entries:[e],coords:[e,a,H(2,0),r2,r3],edges:[rail(e,a)],units:[unit('r2','GERMAN',r2),unit('r3','GERMAN',r3)],rules});
  const result=computeSupply(state,'GERMAN',rules,scenario);
  assert.equal(result.unitSupply.r2,'SUPPLIED');assert.equal(result.unitSupply.r3,'OUT_OF_SUPPLY');
}

// Empty active network => no sources, no projection, living German unit OOS.
{
  const e=H(0,0),x=H(2,0);
  const {state,scenario}=makeState({entries:[e],coords:[e,x],edges:[],units:[unit('g','GERMAN',x)]});
  assert.deepEqual(computeSupply(state,'GERMAN',defaultRules,scenario),{unitSupply:{g:'OUT_OF_SUPPLY'},sourceHexKeys:[],suppliedHexKeys:[]});
}

// C — disconnected repaired rail is not a source.
{
  const rules=rulesWithRadius(1),e=H(0,0),a=H(1,0),x=H(8,0),y=H(9,0);
  const active=rail(e,a),isolated=rail(x,y);
  const {state,scenario}=makeState({entries:[e],coords:[e,a,x,y],edges:[isolated,active],units:[unit('near-isolated','GERMAN',x)],rules});
  const result=computeSupply(state,'GERMAN',rules,scenario);
  assert.deepEqual(result.sourceHexKeys,[hk(e),hk(a)].sort());
  assert.equal(result.unitSupply['near-isolated'],'OUT_OF_SUPPLY');
}

// D — destroyed/unrepaired gaps prevent forward repaired rail becoming a source.
for (const gapKind of ['destroyed','unrepaired']) {
  const rules=rulesWithRadius(1),e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0),d=H(4,0);
  const gap=gapKind==='destroyed'?rail(a,b,{destroyed:true}):rail(a,b,{repairedBy:null});
  const {state,scenario}=makeState({entries:[e],coords:[e,a,b,c,d],edges:[rail(e,a),gap,rail(b,c),rail(c,d)],units:[unit(`g-${gapKind}`,'GERMAN',d)],rules});
  const result=computeSupply(state,'GERMAN',rules,scenario);
  assert.deepEqual(result.sourceHexKeys,[hk(e),hk(a)].sort());
  assert.equal(result.unitSupply[`g-${gapKind}`],'OUT_OF_SUPPLY');
}

// E — Soviet occupation cuts DR-001; killing that unit reconnects projection automatically, with no cache.
{
  const rules=rulesWithRadius(1),e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0),d=H(4,0);
  const edges=[rail(e,a),rail(a,b),rail(b,c),rail(c,d)];
  const blocker=unit('s-block','SOVIET',b),g=unit('g-forward','GERMAN',d);
  const {state,scenario}=makeState({entries:[e],coords:[e,a,b,c,d],edges,units:[blocker,g],rules});
  let result=computeSupply(state,'GERMAN',rules,scenario);
  assert.equal(result.unitSupply['g-forward'],'OUT_OF_SUPPLY');
  assert(!result.sourceHexKeys.includes(hk(d)));
  state.units['s-block'].alive=false;
  result=computeSupply(state,'GERMAN',rules,scenario);
  assert.equal(result.unitSupply['g-forward'],'SUPPLIED');
  assert(result.sourceHexKeys.includes(hk(d)));
  assert.equal('rail' in state,false);
}

// F — enemy ZOC without rail occupation does not affect either active rail or local projection.
{
  const rules=rulesWithRadius(1),e=H(0,0),a=H(1,0),b=H(2,0),z=H(1,1);
  const {state,scenario}=makeState({entries:[e],coords:[e,a,b,z],edges:[rail(e,a),rail(a,b)],units:[unit('s-zoc','SOVIET',z),unit('g','GERMAN',b)],rules});
  const result=computeSupply(state,'GERMAN',rules,scenario);
  assert.equal(result.unitSupply.g,'SUPPLIED');
  assert(result.sourceHexKeys.includes(hk(b)));
}

// G — continuous roads never extend supply beyond germanRadius.
{
  const rules=rulesWithRadius(2),e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0),d=H(4,0);
  const {state,scenario}=makeState({entries:[e],coords:[e,a,b,c,d],edges:[rail(e,a),road(a,b),road(b,c),road(c,d)],units:[unit('road-out','GERMAN',d)],rules});
  assert.equal(computeSupply(state,'GERMAN',rules,scenario).unitSupply['road-out'],'OUT_OF_SUPPLY');
}

// H — terrain does not alter the geometric radius.
{
  const rules=rulesWithRadius(2),e=H(0,0),a=H(1,0);
  const terrainHexes=[
    {coord:H(2,0),terrain:'FOREST'},{coord:H(2,-1),terrain:'HILL'},{coord:H(1,1),terrain:'MARSH'},
    {coord:H(0,2),terrain:'CITY'},{coord:H(-1,2),terrain:'ROUGH'}
  ];
  const units=terrainHexes.map((x,i)=>unit(`t${i}`,'GERMAN',x.coord));
  const {state,scenario}=makeState({entries:[e],coords:[{coord:e},{coord:a},...terrainHexes],edges:[rail(e,a)],units,rules});
  const result=computeSupply(state,'GERMAN',rules,scenario);
  for(const u of units)assert.equal(result.unitSupply[u.id],'SUPPLIED');
}

// I — multiple entries/branches: all active rail endpoints are sources; radius union is duplicate-free.
{
  const rules=rulesWithRadius(1),w1=H(0,0),j=H(1,0),n=H(2,-1),s=H(1,1),w2=H(3,-1);
  const edges=[rail(w1,j),rail(j,n),rail(j,s),rail(n,w2)];
  const coords=[w1,j,n,s,w2,H(2,0),H(0,1)];
  const {state,scenario}=makeState({entries:[w2,w1],coords,edges,units:[],rules});
  const result=computeSupply(state,'GERMAN',rules,scenario),network=computeActiveGermanRailNetwork(state,scenario);
  assert.deepEqual(result.sourceHexKeys,network.hexKeys);
  assert.equal(new Set(result.sourceHexKeys).size,result.sourceHexKeys.length);
  assert.equal(new Set(result.suppliedHexKeys).size,result.suppliedHexKeys.length);
}

// J — non-default board, negative/custom axial coordinates, and nonstandard west entry.
{
  const rules=rulesWithRadius(1),e=H(-7,11),a=H(-6,11),x=H(-5,11);
  const {state,scenario}=makeState({entries:[e],coords:[e,a,x],edges:[rail(e,a)],units:[unit('custom','GERMAN',x)],rules,board:{paperColumns:2,paperRows:2}});
  assert.equal(computeSupply(state,'GERMAN',rules,scenario).unitSupply.custom,'SUPPLIED');
}

// K/L/M/N — filtering, stale supply values, TEMPORARY_SUPPLY ignored, deterministic unit record, no mutation.
{
  const rules=rulesWithRadius(1),e=H(0,0),a=H(1,0),near=H(2,0),far=H(8,0);
  const units=[
    unit('z-near','GERMAN',near,{supplyState:'OUT_OF_SUPPLY'}),
    unit('a-far','GERMAN',far,{supplyState:'SUPPLIED'}),
    unit('m-temp','GERMAN',far,{supplyState:'TEMPORARY_SUPPLY',temporarySupply:true}),
    unit('dead-g','GERMAN',near,{alive:false}),
    unit('s-live','SOVIET',far)
  ];
  const {state,scenario}=makeState({entries:[e],coords:[e,a,near,far],edges:[rail(e,a)],units,rules});
  const before=structuredClone(state),result=computeSupply(state,'GERMAN',rules,scenario);
  assert.deepEqual(Object.keys(result.unitSupply),['a-far','m-temp','z-near']);
  assert.equal(result.unitSupply['z-near'],'SUPPLIED');
  assert.equal(result.unitSupply['a-far'],'OUT_OF_SUPPLY');
  assert.equal(result.unitSupply['m-temp'],'OUT_OF_SUPPLY');
  assert.equal(result.unitSupply['dead-g'],undefined);assert.equal(result.unitSupply['s-live'],undefined);
  assert.deepEqual(state,before);
}

// O — Task 002B-5C makes generic Soviet computeSupply delegate to the full Soviet projection.
{
  const e=H(0,0),a=H(1,0);
  const {state,scenario}=makeState({entries:[e],coords:[e,a],edges:[rail(e,a)],units:[]});
  assert.deepEqual(computeSupply(state,'SOVIET',defaultRules,scenario),computeSovietSupplyProjection(state,defaultRules,scenario));
}

console.log('Digital Branch Task 002B-2 German Supply Projection smoke checks passed.');
