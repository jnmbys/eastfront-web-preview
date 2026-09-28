import assert from 'node:assert/strict';
import {
  computeActiveGermanRailNetwork,computeActiveSovietRailNetwork,createGameState,defaultRules,defaultScenario,hexKey,
  isSovietRailEdgeActive,isSovietRailHexActive,makeEdge,validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const rail=(a,b,{repairedBy=null,destroyed=false,present=true}={})=>makeEdge(a,b,{railway:{present,repairedBy,destroyed}});
const plain=(coords)=>coords.map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const german=(id,hex,{alive=true}={})=>({id,templateId:'G-INF',side:'GERMAN',type:'INFANTRY',step:0,alive,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:G,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
const uniqueCoords=(coords)=>{const m=new Map();for(const h of coords)m.set(hk(h),h);return [...m.values()];};
const scenarioFor=(exits,coords,board={paperColumns:7,paperRows:4})=>({
  ...defaultScenario,id:'soviet-rail-smoke',displayName:'Soviet Rail Smoke',board,
  germanWestRailEntries:[{...(coords[0]??exits[0])}],sovietEastRailExits:exits.map(x=>({...x})),sovietSupplySources:[],capitalCoreHexes:coords.length?[{...coords[0]}]:[],initialUnits:[],deployment:undefined
});
function stateFor({exits,coords,edges,units=[],board}){
  const all=uniqueCoords(coords);
  const scenario=scenarioFor(exits,all,board);
  const state=createGameState({scenario,rules:defaultRules,hexes:plain(all),edges,units,seed:91});
  return {state,scenario};
}
function net(spec){const {state,scenario}=stateFor(spec);return {state,scenario,network:computeActiveSovietRailNetwork(state,scenario)};}

// A. Connected line from an east exit: all intact edges/endpoints become active.
{
  const e=H(3,0),a=H(2,0),b=H(1,0),c=H(0,0);
  const edges=[rail(a,b),rail(e,a),rail(b,c)];
  const {state,scenario,network}=net({exits:[e],coords:[e,a,b,c],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.deepEqual(network.hexKeys,[e,a,b,c].map(hk).sort());
  assert.deepEqual(network.exitHexKeys,[hk(e)]);
  assert(isSovietRailEdgeActive(network,edges[0].key));
  assert(isSovietRailHexActive(network,hk(c)));
  assert.deepEqual(validateGameStateIntegrity(state,defaultRules,scenario),[]);
}

// B. Intact but isolated rail is legal state and inactive.
{
  const e=H(0,0),x=H(4,0),y=H(5,0),edge=rail(x,y);
  const {network}=net({exits:[e],coords:[e,x,y],edges:[edge]});
  assert.deepEqual(network,{edgeKeys:[],hexKeys:[],exitHexKeys:[]});
}

// C. Destroyed gap stops intact rail beyond it.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0);
  const ea=rail(e,a),gap=rail(a,b,{destroyed:true}),beyond=rail(b,c,{repairedBy:'SOVIET'});
  const {network}=net({exits:[e],coords:[e,a,b,c],edges:[ea,gap,beyond]});
  assert.deepEqual(network.edgeKeys,[ea.key]);
}

// D/E/F. repairedBy is irrelevant for Soviet east-rail connectivity when track is intact.
for (const repairedBy of [null,'SOVIET','GERMAN']) {
  const e=H(0,0),a=H(1,0),edge=rail(e,a,{repairedBy});
  const {network}=net({exits:[e],coords:[e,a],edges:[edge]});
  assert.deepEqual(network.edgeKeys,[edge.key],`repairedBy=${repairedBy}`);
}

// G. Branches all remain active.
{
  const e=H(0,0),j=H(1,0),north=H(2,-1),south=H(1,1);
  const edges=[rail(j,north),rail(j,south,{repairedBy:'GERMAN'}),rail(e,j,{repairedBy:'SOVIET'})];
  const {network}=net({exits:[e],coords:[e,j,north,south],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// H. Cycles terminate without duplicate edge/hex output.
{
  const e=H(0,0),a=H(1,0),b=H(1,-1);
  const edges=[rail(e,a),rail(a,b),rail(b,e)];
  const {network}=net({exits:[e],coords:[e,a,b],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.equal(new Set(network.edgeKeys).size,3);
  assert.equal(new Set(network.hexKeys).size,3);
}

// I. Multiple exits contribute the union and reconnect without duplicates.
{
  const e1=H(0,0),a=H(1,0),mid=H(2,0),b=H(3,0),e2=H(4,0);
  const edges=[rail(e1,a),rail(a,mid),rail(mid,b),rail(b,e2)];
  const {network}=net({exits:[e2,e1],coords:[e1,a,mid,b,e2],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.deepEqual(network.exitHexKeys,[hk(e1),hk(e2)].sort());
}

// J. One occupied exit does not seed; another unoccupied exit remains valid.
{
  const e1=H(0,0),a=H(1,0),e2=H(0,3),b=H(1,3);
  const blocked=rail(e1,a),valid=rail(e2,b);
  const {network}=net({exits:[e1,e2],coords:[e1,a,e2,b],edges:[blocked,valid],units:[german('g-block',e1)]});
  assert.deepEqual(network.edgeKeys,[valid.key]);
  assert.deepEqual(network.exitHexKeys,[hk(e2)]);
}

// K/L. Live German occupation of a middle rail hex cuts the graph; death reconnects automatically.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0);
  const ea=rail(e,a),ab=rail(a,b),bc=rail(b,c),edges=[ea,ab,bc];
  const built=stateFor({exits:[e],coords:[e,a,b,c],edges,units:[german('g-mid',b)]});
  let network=computeActiveSovietRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,[ea.key]);
  assert.deepEqual(network.hexKeys,[e,a].map(hk).sort());
  built.state.units['g-mid'].alive=false;
  network=computeActiveSovietRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// M. German ZOC without occupation does not cut rail.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),z=H(1,1);
  const edges=[rail(e,a),rail(a,b)];
  const {network}=net({exits:[e],coords:[e,a,b,z],edges,units:[german('g-zoc',z)]});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// N. A dead German unit on rail does not block traversal.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),edges=[rail(e,a),rail(a,b)];
  const {network}=net({exits:[e],coords:[e,a,b],edges,units:[german('g-dead',a,{alive:false})]});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// O. Output is deterministic despite insertion order of edges, units, and exits.
{
  const e1=H(0,0),a=H(1,0),b=H(2,0),e2=H(3,0),z=H(1,1);
  const edges=[rail(e1,a,{repairedBy:'GERMAN'}),rail(a,b),rail(b,e2,{repairedBy:'SOVIET'})];
  const one=net({exits:[e1,e2],coords:[e1,a,b,e2,z],edges,units:[german('g-z1',z)]}).network;
  const two=net({exits:[e2,e1],coords:[z,e2,b,a,e1],edges:[...edges].reverse(),units:[german('g-z1',z)]}).network;
  assert.deepEqual(one,two);
  assert.deepEqual(one.edgeKeys,[...one.edgeKeys].sort());
  assert.deepEqual(one.hexKeys,[...one.hexKeys].sort());
  assert.deepEqual(one.exitHexKeys,[...one.exitHexKeys].sort());
}

// P. Non-default board coordinates/exits work; nothing assumes AF/20x32.
{
  const e=H(-8,12),a=H(-7,12),b=H(-6,12),edges=[rail(a,b),rail(e,a)];
  const {network}=net({exits:[e],coords:[e,a,b],edges,board:{paperColumns:3,paperRows:2}});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.deepEqual(network.exitHexKeys,[hk(e)]);
}

// Q. Pure derivation: no GameState mutation.
{
  const e=H(0,0),a=H(1,0),edge=rail(e,a,{repairedBy:'GERMAN'});
  const built=stateFor({exits:[e],coords:[e,a],edges:[edge]});
  const before=structuredClone(built.state);
  computeActiveSovietRailNetwork(built.state,built.scenario);
  assert.deepEqual(built.state,before);
}

// R. Soviet and German graph semantics remain distinct: null repair owner is Soviet-active but German-inactive.
{
  const e=H(0,0),a=H(1,0),edge=rail(e,a,{repairedBy:null});
  const built=stateFor({exits:[e],coords:[e,a],edges:[edge]});
  built.scenario.germanWestRailEntries=[{...e}];
  assert.deepEqual(computeActiveSovietRailNetwork(built.state,built.scenario).edgeKeys,[edge.key]);
  assert.deepEqual(computeActiveGermanRailNetwork(built.state,built.scenario).edgeKeys,[]);
}

// S. Invalid Soviet exit is an integrity issue string, not a Foundation ValidationCode change.
{
  const e=H(0,0),a=H(1,0),bad=H(9,9),edge=rail(e,a);
  const scenario=scenarioFor([bad],[e,a]);
  scenario.germanWestRailEntries=[{...e}];
  const state=createGameState({scenario,rules:defaultRules,hexes:plain([e,a]),edges:[edge],units:[],seed:2});
  const issues=validateGameStateIntegrity(state,defaultRules,scenario);
  const hit=issues.find(x=>x.code==='SOVIET_EAST_RAIL_EXIT_INVALID');
  assert(hit);
  assert.equal(hit.details.exitHexKey,hk(bad));
}

// Exit with no traversable railway adjacency is not reported as a successfully seeded exit.
{
  const e=H(0,0),a=H(3,0),b=H(4,0),edge=rail(a,b);
  const {network}=net({exits:[e],coords:[e,a,b],edges:[edge]});
  assert.deepEqual(network.exitHexKeys,[]);
}

console.log('Digital Branch Task 002B-5A Soviet East Rail Network smoke checks passed.');
