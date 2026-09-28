import assert from 'node:assert/strict';
import {
  computeActiveSovietRailNetwork,computeSovietEastRailSupplyProjection,computeSovietSupplyProjection,computeSupply,
  createGameState,defaultRules,defaultScenario,hexKey,makeEdge
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const cloneRules=(radius=defaultRules.supply.sovietRadius)=>structuredClone({...defaultRules,supply:{...defaultRules.supply,sovietRadius:radius}});
const rail=(a,b,{repairedBy=null,destroyed=false,present=true,road=false}={})=>makeEdge(a,b,{road,railway:{present,repairedBy,destroyed}});
const road=(a,b)=>makeEdge(a,b,{road:true});
const soviet=(id,hex,over={})=>({id,templateId:'S-INF',side:'SOVIET',type:'INFANTRY',step:0,alive:true,hex:{...hex},supplyState:'OUT_OF_SUPPLY',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null,...over});
const german=(id,hex,over={})=>({id,templateId:'G-INF',side:'GERMAN',type:'INFANTRY',step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:G,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null,...over});
const uniqueCoords=(coords)=>{const m=new Map();for(const h of coords)m.set(hk(h),h);return [...m.values()];};
const hexes=(coords,terrainByKey={})=>coords.map(coord=>({coord:{...coord},terrain:terrainByKey[hk(coord)]??'PLAIN',control:null}));
function scenarioFor(exits,coords,{capitalCoreHexes=[],capitalOuterHexes=[],sovietSupplySources=[],board={paperColumns:9,paperRows:7}}={}){
  return {...defaultScenario,id:'soviet-east-supply-smoke',displayName:'Soviet East Supply Smoke',board,
    germanWestRailEntries:[{...(coords[0]??exits[0])}],sovietEastRailExits:exits.map(x=>({...x})),
    sovietSupplySources:sovietSupplySources.map(x=>({...x})),
    capitalCoreHexes:capitalCoreHexes.map(x=>({...x})),capitalOuterHexes:capitalOuterHexes.map(x=>({...x})),initialUnits:[],deployment:undefined};
}
function makeState({exits,coords,edges,units=[],rules=defaultRules,terrainByKey={},scenarioOptions={}}){
  const all=uniqueCoords(coords);
  const scenario=scenarioFor(exits,all,scenarioOptions);
  const state=createGameState({scenario,rules,hexes:hexes(all,terrainByKey),edges,units,seed:57});
  // Fixture precondition: this pure-projection smoke deliberately supplies stale/temporary UnitState inputs.
  for(const u of units) if(state.units[u.id]) state.units[u.id].supplyState=u.supplyState;
  return {state,scenario,rules};
}
function projection(spec){const built=makeState(spec);return {...built,result:computeSovietEastRailSupplyProjection(built.state,built.rules,built.scenario)};}

// A/B. Base radius and custom radius prove no hard-coded 5.
{
  const rules=cloneRules(5),e=H(0,0),a=H(1,0),d5=H(-5,0),d6=H(-6,0);
  const {result}=projection({exits:[e],coords:[e,a,d5,d6],edges:[rail(e,a)],units:[soviet('s0',e),soviet('s5',d5),soviet('s6',d6)],rules});
  assert.equal(result.unitSupply.s0,'SUPPLIED');assert.equal(result.unitSupply.s5,'SUPPLIED');assert.equal(result.unitSupply.s6,'OUT_OF_SUPPLY');
  const rules2=cloneRules(2),d2=H(-2,0),d3=H(-3,0);
  const p2=projection({exits:[e],coords:[e,a,d2,d3],edges:[rail(e,a)],units:[soviet('s2',d2),soviet('s3',d3)],rules:rules2}).result;
  assert.equal(p2.unitSupply.s2,'SUPPLIED');assert.equal(p2.unitSupply.s3,'OUT_OF_SUPPLY');
}

// C/D. Sources exactly mirror 5A; supplied hexes are real, unique, sorted, and include sources.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),near=H(2,1),far=H(20,20),edges=[rail(a,b),rail(e,a)];
  const built=makeState({exits:[e],coords:[far,near,b,a,e],edges});
  const network=computeActiveSovietRailNetwork(built.state,built.scenario);
  const result=computeSovietEastRailSupplyProjection(built.state,built.rules,built.scenario);
  assert.deepEqual(result.sourceHexKeys,network.hexKeys);
  assert.deepEqual(result.sourceHexKeys,[...result.sourceHexKeys].sort());
  assert.deepEqual(result.suppliedHexKeys,[...new Set(result.suppliedHexKeys)].sort());
  assert(result.sourceHexKeys.every(k=>result.suppliedHexKeys.includes(k)));
  assert(result.suppliedHexKeys.every(k=>Boolean(built.state.hexes[k])));
  assert(!result.suppliedHexKeys.includes(hk(far)));
}

// E. Empty active network means no supplied hexes and all living Soviets OOS.
{
  const e=H(0,0),x=H(8,0),y=H(9,0);
  const {result}=projection({exits:[e],coords:[e,x,y],edges:[rail(x,y)],units:[soviet('s-e',e),soviet('s-x',x)]});
  assert.deepEqual(result.sourceHexKeys,[]);assert.deepEqual(result.suppliedHexKeys,[]);
  assert.deepEqual(result.unitSupply,{'s-e':'OUT_OF_SUPPLY','s-x':'OUT_OF_SUPPLY'});
}

// F/G. Disconnected intact rail and intact rail beyond a destroyed gap are not sources.
{
  const rules=cloneRules(1),e=H(0,0),a=H(1,0),x=H(8,0),y=H(9,0);
  let {result}=projection({exits:[e],coords:[e,a,x,y],edges:[rail(e,a),rail(x,y)],units:[soviet('s-iso',x)],rules});
  assert(!result.sourceHexKeys.includes(hk(x)));assert.equal(result.unitSupply['s-iso'],'OUT_OF_SUPPLY');
  const b=H(2,0),c=H(3,0),d=H(4,0);
  result=projection({exits:[e],coords:[e,a,b,c,d],edges:[rail(e,a),rail(a,b,{destroyed:true}),rail(b,c),rail(c,d)],units:[soviet('s-gap',d)],rules}).result;
  assert(!result.sourceHexKeys.includes(hk(d)));assert.equal(result.unitSupply['s-gap'],'OUT_OF_SUPPLY');
}

// H/I. Live German occupation cuts 5A sources; death restores them and theoretical supply.
{
  const rules=cloneRules(0),e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0),edges=[rail(e,a),rail(a,b),rail(b,c)];
  const built=makeState({exits:[e],coords:[e,a,b,c],edges,units:[german('g-block',b),soviet('s-front',c)],rules});
  let result=computeSovietEastRailSupplyProjection(built.state,rules,built.scenario);
  assert.equal(result.unitSupply['s-front'],'OUT_OF_SUPPLY');assert(!result.sourceHexKeys.includes(hk(c)));
  built.state.units['g-block'].alive=false;
  result=computeSovietEastRailSupplyProjection(built.state,rules,built.scenario);
  assert.equal(result.unitSupply['s-front'],'SUPPLIED');assert(result.sourceHexKeys.includes(hk(c)));
}

// J. German ZOC only does not affect local projection/network.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),z=H(1,1),edges=[rail(e,a),rail(a,b)];
  const {result}=projection({exits:[e],coords:[e,a,b,z],edges,units:[german('g-zoc',z),soviet('s-zoc',b)]});
  assert.equal(result.unitSupply['s-zoc'],'SUPPLIED');assert(result.sourceHexKeys.includes(hk(b)));
}

// K. repairedBy null/SOVIET/GERMAN all remain valid Soviet east-rail sources.
for (const repairedBy of [null,'SOVIET','GERMAN']) {
  const e=H(0,0),a=H(1,0),edge=rail(e,a,{repairedBy});
  const {result}=projection({exits:[e],coords:[e,a],edges:[edge],units:[soviet(`s-${repairedBy}`,a)]});
  assert(result.sourceHexKeys.includes(hk(a)),`repair owner ${repairedBy}`);
}

// L/M. Roads do not extend radius; terrain is irrelevant to geometric distance.
{
  const rules=cloneRules(2),e=H(0,0),a=H(1,0),d2=H(-2,0),d3=H(-3,0),r1=H(-1,0);
  const edges=[rail(e,a),road(e,r1),road(r1,d2),road(d2,d3)];
  const terrainByKey={[hk(e)]:'FOREST',[hk(d2)]:'MARSH',[hk(d3)]:'ROUGH'};
  const {result}=projection({exits:[e],coords:[e,a,r1,d2,d3],edges,units:[soviet('s-terrain',d2),soviet('s-road',d3)],rules,terrainByKey});
  assert.equal(result.unitSupply['s-terrain'],'SUPPLIED');assert.equal(result.unitSupply['s-road'],'OUT_OF_SUPPLY');
}

// N. Multiple exits/branches: every active rail hex is a source and radius union has no duplicates.
{
  const e1=H(0,0),j=H(1,0),n=H(2,-1),s=H(1,1),e2=H(4,0),b=H(3,0),edges=[rail(e1,j),rail(j,n),rail(j,s),rail(e2,b)];
  const {result}=projection({exits:[e2,e1],coords:[e1,j,n,s,e2,b],edges,units:[]});
  assert.deepEqual(result.sourceHexKeys,[e1,j,n,s,e2,b].map(hk).sort());
  assert.equal(new Set(result.suppliedHexKeys).size,result.suppliedHexKeys.length);
}

// O. Non-default map / unusual negative axial coordinates work without board generation.
{
  const rules=cloneRules(1),e=H(-11,7),a=H(-10,7),near=H(-10,8),far=H(-8,10);
  const {result}=projection({exits:[e],coords:[far,near,a,e],edges:[rail(e,a)],units:[soviet('s-neg-near',near),soviet('s-neg-far',far)],rules,scenarioOptions:{board:{paperColumns:2,paperRows:2}}});
  assert.equal(result.unitSupply['s-neg-near'],'SUPPLIED');assert.equal(result.unitSupply['s-neg-far'],'OUT_OF_SUPPLY');
}

// P/Q/R/S. Filtering, stale state, TEMPORARY_SUPPLY ignore, and pure query.
{
  const rules=cloneRules(1),e=H(0,0),a=H(1,0),far=H(8,0);
  const units=[
    soviet('z-near',a,{supplyState:'OUT_OF_SUPPLY'}),
    soviet('a-far',far,{supplyState:'SUPPLIED'}),
    soviet('m-temp',far,{supplyState:'TEMPORARY_SUPPLY',temporarySupply:true}),
    soviet('dead-s',a,{alive:false,supplyState:'SUPPLIED'}),
    german('g-live',far)
  ];
  const built=makeState({exits:[e],coords:[e,a,far],edges:[rail(e,a)],units,rules});
  const before=structuredClone(built.state),result=computeSovietEastRailSupplyProjection(built.state,rules,built.scenario);
  assert.deepEqual(Object.keys(result.unitSupply),['a-far','m-temp','z-near']);
  assert.equal(result.unitSupply['z-near'],'SUPPLIED');assert.equal(result.unitSupply['a-far'],'OUT_OF_SUPPLY');assert.equal(result.unitSupply['m-temp'],'OUT_OF_SUPPLY');
  assert.equal(result.unitSupply['dead-s'],undefined);assert.equal(result.unitSupply['g-live'],undefined);
  assert.equal(built.state.units['m-temp'].temporarySupply,true);assert.equal(built.state.units['m-temp'].supplyState,'TEMPORARY_SUPPLY');
  assert.deepEqual(built.state,before);
}

// T. Deterministic across hex/edge/unit/exit insertion order.
{
  const rules=cloneRules(2),e1=H(0,0),a=H(1,0),b=H(2,0),e2=H(3,0),near=H(1,1),edges=[rail(e1,a,{repairedBy:'GERMAN'}),rail(a,b),rail(b,e2,{repairedBy:'SOVIET'})];
  const units=[soviet('s-b',near),soviet('s-a',b),german('g-z',H(8,8))],coords=[e1,a,b,e2,near,H(8,8)];
  const one=projection({exits:[e1,e2],coords,edges,units,rules}).result;
  const two=projection({exits:[e2,e1],coords:[...coords].reverse(),edges:[...edges].reverse(),units:[...units].reverse(),rules}).result;
  assert.deepEqual(one,two);
}

// U. Capital is NOT silently an independent source in 5B.
{
  const rules=cloneRules(1),e=H(0,0),a=H(1,0),capital=H(12,12);
  const {result}=projection({exits:[e],coords:[e,a,capital],edges:[rail(e,a)],units:[soviet('s-capital',capital)],rules,scenarioOptions:{capitalCoreHexes:[capital]}});
  assert.equal(result.unitSupply['s-capital'],'OUT_OF_SUPPLY');assert(!result.sourceHexKeys.includes(hk(capital)));
}

// V. Generic Soviet computeSupply now exposes the full 5C projection while East-only remains separate.
{
  const e=H(0,0),a=H(1,0),built=makeState({exits:[e],coords:[e,a],edges:[rail(e,a)]});
  assert.deepEqual(computeSupply(built.state,'SOVIET',built.rules,built.scenario),computeSovietSupplyProjection(built.state,built.rules,built.scenario));
}

console.log('Digital Branch Task 002B-5B Soviet East-Rail Supply Projection smoke checks passed.');
