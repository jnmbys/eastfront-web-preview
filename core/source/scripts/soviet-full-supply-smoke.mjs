import assert from 'node:assert/strict';
import {
  computeActiveSovietRailNetwork,
  computeActiveSovietSupplyRailNetwork,
  computeSovietEastRailSupplyProjection,
  computeSovietSupplyProjection,
  computeSupply,
  createGameState,
  defaultRules,
  defaultScenario,
  getActiveSovietIndependentSupplySourceHexKeys,
  hexKey,
  makeEdge,
  parsePaperHex,
  validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const cloneRules=(radius=defaultRules.supply.sovietRadius)=>structuredClone({...defaultRules,supply:{...defaultRules.supply,sovietRadius:radius}});
const rail=(a,b,{repairedBy=null,destroyed=false,present=true}={})=>makeEdge(a,b,{railway:{present,repairedBy,destroyed}});
const soviet=(id,hex,over={})=>({id,templateId:'S-INF',side:'SOVIET',type:'INFANTRY',step:0,alive:true,hex:{...hex},supplyState:'OUT_OF_SUPPLY',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null,...over});
const german=(id,hex,over={})=>({id,templateId:'G-INF',side:'GERMAN',type:'INFANTRY',step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:G,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null,...over});
const uniqueCoords=(coords)=>{const m=new Map();for(const h of coords)m.set(hk(h),h);return [...m.values()];};
const hexes=(coords)=>coords.map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
function scenarioFor({coords,exits=[],sources=[],capitalCoreHexes=[],capitalOuterHexes=[],board={paperColumns:7,paperRows:7}}){
  const fallback=coords[0]??H(0,0);
  return {...defaultScenario,id:'soviet-full-supply-smoke',displayName:'Soviet Full Supply Smoke',board,
    germanWestRailEntries:[{...fallback}],sovietEastRailExits:exits.map(x=>({...x})),sovietSupplySources:sources.map(x=>({...x})),
    capitalCoreHexes:capitalCoreHexes.map(x=>({...x})),capitalOuterHexes:capitalOuterHexes.map(x=>({...x})),initialUnits:[],deployment:undefined};
}
function makeState({coords,exits=[],sources=[],edges=[],units=[],rules=defaultRules,capitalCoreHexes=[],capitalOuterHexes=[],board}){
  const all=uniqueCoords(coords);
  const scenario=scenarioFor({coords:all,exits,sources,capitalCoreHexes,capitalOuterHexes,board});
  const state=createGameState({scenario,rules,hexes:hexes(all),edges,units,seed:61});
  // Fixture precondition: this pure-projection smoke deliberately supplies stale/temporary UnitState inputs.
  for(const u of units) if(state.units[u.id]) state.units[u.id].supplyState=u.supplyState;
  return {state,scenario,rules};
}
function full(spec){const built=makeState(spec);return {...built,result:computeSovietSupplyProjection(built.state,built.rules,built.scenario)};}

// A. Default scenario explicitly configures AC10/AC11 only; AD10 is not an independent source.
{
  const configured=(defaultScenario.sovietSupplySources??[]).map(hk).sort();
  assert.deepEqual(configured,[hk(parsePaperHex('AC10')),hk(parsePaperHex('AC11'))].sort());
  assert(!configured.includes(hk(parsePaperHex('AD10'))));
}

// B/C/R/S. City/capital metadata alone does not imply supply; explicit config does, outer capital does not.
{
  const city=H(0,0),outer=H(5,0),far=H(10,0),rules=cloneRules(0);
  let built=makeState({coords:[city,outer,far],sources:[],capitalCoreHexes:[city],capitalOuterHexes:[outer],units:[soviet('s-city',city),soviet('s-outer',outer)],rules});
  let result=computeSovietSupplyProjection(built.state,rules,built.scenario);
  assert.equal(result.unitSupply['s-city'],'OUT_OF_SUPPLY');
  assert.equal(result.unitSupply['s-outer'],'OUT_OF_SUPPLY');
  built=makeState({coords:[city,outer,far],sources:[city],capitalCoreHexes:[],capitalOuterHexes:[outer],units:[soviet('s-city',city),soviet('s-outer',outer)],rules});
  result=computeSovietSupplyProjection(built.state,rules,built.scenario);
  assert.equal(result.unitSupply['s-city'],'SUPPLIED');
  assert.equal(result.unitSupply['s-outer'],'OUT_OF_SUPPLY');
}

// D/E/Q. Isolated explicit source directly projects supply, honors custom radius, and remains a source without rail adjacency.
{
  const source=H(0,0),d2=H(2,0),d3=H(3,0),rules=cloneRules(2);
  const {result}=full({coords:[source,d2,d3],sources:[source],units:[soviet('s2',d2),soviet('s3',d3)],rules});
  assert.deepEqual(result.sourceHexKeys,[hk(source)]);
  assert.equal(result.unitSupply.s2,'SUPPLIED');
  assert.equal(result.unitSupply.s3,'OUT_OF_SUPPLY');
}

// F/H. Independent source can seed intact rail disconnected from East; 5A east-only API remains unchanged.
{
  const source=H(0,0),a=H(1,0),b=H(2,0),east=H(10,0),edges=[rail(source,a),rail(a,b)];
  const built=makeState({coords:[source,a,b,east],sources:[source],exits:[east],edges});
  const eastOnly=computeActiveSovietRailNetwork(built.state,built.scenario);
  const fullRail=computeActiveSovietSupplyRailNetwork(built.state,built.scenario);
  assert.deepEqual(eastOnly.edgeKeys,[]);
  assert.deepEqual(fullRail.edgeKeys,edges.map(e=>e.key).sort());
  assert(fullRail.seedHexKeys.includes(hk(source)));
}

// G/P. East-exit network and independent-source network union; full sources are rail hexes + independent source, unique/sorted.
{
  const source=H(0,0),sa=H(1,0),east=H(8,0),ea=H(7,0),edges=[rail(source,sa),rail(east,ea)];
  const built=makeState({coords:[source,sa,east,ea],sources:[source],exits:[east],edges});
  const network=computeActiveSovietSupplyRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,edges.map(e=>e.key).sort());
  assert.deepEqual(network.hexKeys,[source,sa,east,ea].map(hk).sort());
  const result=computeSovietSupplyProjection(built.state,built.rules,built.scenario);
  assert.deepEqual(result.sourceHexKeys,[...new Set([...network.hexKeys,hk(source)])].sort());
  assert.deepEqual(result.sourceHexKeys,[...new Set(result.sourceHexKeys)].sort());
}

// I/J/K. German occupation disables only the occupied source; another source survives; death restores the first.
{
  const c1=H(0,0),c2=H(6,0),units=[german('g-block',c1),soviet('s1',c1),soviet('s2',c2)],rules=cloneRules(0);
  const built=makeState({coords:[c1,c2],sources:[c1,c2],units,rules});
  let active=getActiveSovietIndependentSupplySourceHexKeys(built.state,built.scenario);
  let result=computeSovietSupplyProjection(built.state,rules,built.scenario);
  assert.deepEqual(active,[hk(c2)]);
  assert.equal(result.unitSupply.s1,'OUT_OF_SUPPLY');assert.equal(result.unitSupply.s2,'SUPPLIED');
  built.state.units['g-block'].alive=false;
  active=getActiveSovietIndependentSupplySourceHexKeys(built.state,built.scenario);
  result=computeSovietSupplyProjection(built.state,rules,built.scenario);
  assert.deepEqual(active,[hk(c1),hk(c2)].sort());assert.equal(result.unitSupply.s1,'SUPPLIED');
}

// L. German ZOC-only adjacency does not disable an independent source.
{
  const source=H(0,0),zoc=H(0,1),rules=cloneRules(0);
  const {result}=full({coords:[source,zoc],sources:[source],units:[german('g-zoc',zoc),soviet('s',source)],rules});
  assert.equal(result.unitSupply.s,'SUPPLIED');
}

// M. Source-seeded branch + cycle traverses once without duplicates.
{
  const source=H(0,0),a=H(1,0),b=H(1,-1),branch=H(2,0);
  const edges=[rail(source,a),rail(a,b),rail(b,source),rail(a,branch)];
  const built=makeState({coords:[source,a,b,branch],sources:[source],edges});
  const network=computeActiveSovietSupplyRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,edges.map(e=>e.key).sort());
  assert.equal(new Set(network.edgeKeys).size,network.edgeKeys.length);
  assert.equal(new Set(network.hexKeys).size,network.hexKeys.length);
}

// N. Destroyed gap stops source-seeded rail propagation beyond the gap.
{
  const source=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0),edges=[rail(source,a),rail(a,b,{destroyed:true}),rail(b,c)];
  const built=makeState({coords:[source,a,b,c],sources:[source],edges});
  const network=computeActiveSovietSupplyRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,[edges[0].key]);
  assert(!network.hexKeys.includes(hk(c)));
}

// O. repairedBy is irrelevant to Soviet full rail traversal.
for (const repairedBy of [null,'SOVIET','GERMAN']) {
  const source=H(0,0),a=H(1,0),edge=rail(source,a,{repairedBy});
  const built=makeState({coords:[source,a],sources:[source],edges:[edge]});
  assert(computeActiveSovietSupplyRailNetwork(built.state,built.scenario).edgeKeys.includes(edge.key));
}

// T/U. Full projection filters units, ignores stale/temporary normal state, and does not mutate those fields.
{
  const source=H(0,0),far=H(5,0),rules=cloneRules(0);
  const units=[
    soviet('z-near',source,{supplyState:'OUT_OF_SUPPLY'}),
    soviet('a-far',far,{supplyState:'SUPPLIED'}),
    soviet('m-temp',far,{supplyState:'TEMPORARY_SUPPLY',temporarySupply:true}),
    soviet('dead-s',source,{alive:false,supplyState:'SUPPLIED'}),
    german('g-live',far)
  ];
  const built=makeState({coords:[source,far],sources:[source],units,rules});
  const result=computeSovietSupplyProjection(built.state,rules,built.scenario);
  assert.deepEqual(Object.keys(result.unitSupply),['a-far','m-temp','z-near']);
  assert.equal(result.unitSupply['z-near'],'SUPPLIED');assert.equal(result.unitSupply['a-far'],'OUT_OF_SUPPLY');assert.equal(result.unitSupply['m-temp'],'OUT_OF_SUPPLY');
  assert.equal(result.unitSupply['dead-s'],undefined);assert.equal(result.unitSupply['g-live'],undefined);
  assert.equal(built.state.units['m-temp'].temporarySupply,true);assert.equal(built.state.units['m-temp'].supplyState,'TEMPORARY_SUPPLY');
}

// V. Full projection is a pure query.
{
  const source=H(0,0),a=H(1,0),built=makeState({coords:[source,a],sources:[source],edges:[rail(source,a)],units:[soviet('s',a)]});
  const before=structuredClone(built.state);computeSovietSupplyProjection(built.state,built.rules,built.scenario);assert.deepEqual(built.state,before);
}

// W/Y. Deterministic across configured source/exits/edge/unit/hex insertion order; duplicate source config dedupes.
{
  const s1=H(0,0),s2=H(5,0),a=H(1,0),e=H(10,0),ea=H(9,0),edges=[rail(s1,a),rail(e,ea)],units=[soviet('s-b',a),soviet('s-a',s2)];
  const one=makeState({coords:[s1,s2,a,e,ea],sources:[s2,s1,s1],exits:[e],edges,units});
  const two=makeState({coords:[ea,e,a,s2,s1],sources:[s1,s2],exits:[e],edges:[...edges].reverse(),units:[...units].reverse()});
  const r1=computeSovietSupplyProjection(one.state,one.rules,one.scenario),r2=computeSovietSupplyProjection(two.state,two.rules,two.scenario);
  assert.deepEqual(r1,r2);
  assert.deepEqual(getActiveSovietIndependentSupplySourceHexKeys(one.state,one.scenario),[hk(s1),hk(s2)].sort());
}

// X. Invalid configured independent source is an integrity issue; duplicates are not fatal by themselves.
{
  const real=H(0,0),missing=H(99,99),built=makeState({coords:[real],sources:[real,real]});
  assert(!validateGameStateIntegrity(built.state,built.rules,built.scenario).some(x=>x.code==='SOVIET_SUPPLY_SOURCE_INVALID'));
  const badScenario={...built.scenario,sovietSupplySources:[real,missing]};
  assert(validateGameStateIntegrity(built.state,built.rules,badScenario).some(x=>x.code==='SOVIET_SUPPLY_SOURCE_INVALID'&&x.details?.sourceHexKey===hk(missing)));
}

// Z. Generic Soviet computeSupply is exactly the full Soviet projection.
{
  const source=H(0,0),built=makeState({coords:[source],sources:[source],units:[soviet('s',source)]});
  assert.deepEqual(computeSupply(built.state,'SOVIET',built.rules,built.scenario),computeSovietSupplyProjection(built.state,built.rules,built.scenario));
}

// AA. East-only projection remains east-exit-only while full projection uses isolated independent source.
{
  const source=H(0,0),east=H(10,0),rules=cloneRules(0),built=makeState({coords:[source,east],sources:[source],exits:[east],units:[soviet('s',source)],rules});
  assert.equal(computeSovietSupplyProjection(built.state,rules,built.scenario).unitSupply.s,'SUPPLIED');
  assert.equal(computeSovietEastRailSupplyProjection(built.state,rules,built.scenario).unitSupply.s,'OUT_OF_SUPPLY');
}

console.log('Digital Branch Task 002B-5C Soviet Full Supply Sources smoke checks passed.');
