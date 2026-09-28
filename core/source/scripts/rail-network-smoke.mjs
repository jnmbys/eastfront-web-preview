import assert from 'node:assert/strict';
import {
  computeActiveGermanRailNetwork,createGameState,defaultRules,defaultScenario,hexKey,
  isGermanRailEdgeActive,isGermanRailHexActive,makeEdge,validateGameStateIntegrity
} from '../dist/index.js';

const G='G-HUMAN-1',S='S-AI-1';
const H=(q,r)=>({q,r});
const hk=(h)=>hexKey(h);
const rail=(a,b,{repairedBy='GERMAN',destroyed=false,present=true}={})=>makeEdge(a,b,{railway:{present,repairedBy,destroyed}});
const plain=(coords)=>coords.map(coord=>({coord:{...coord},terrain:'PLAIN',control:null}));
const soviet=(id,hex)=>({id,templateId:'S-INF',side:'SOVIET',type:'INFANTRY',step:0,alive:true,hex:{...hex},supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:S,temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null});
const uniqueCoords=(coords)=>{
  const m=new Map();for(const h of coords)m.set(hk(h),h);return [...m.values()];
};
const scenarioFor=(entries,board={paperColumns:7,paperRows:4})=>({...defaultScenario,id:'rail-smoke',displayName:'Rail Smoke',board,germanWestRailEntries:entries.map(x=>({...x})),sovietEastRailExits:entries.map(x=>({...x})),sovietSupplySources:[],capitalCoreHexes:entries.length?[{...entries[0]}]:[],initialUnits:[],deployment:undefined});
function stateFor({entries,coords,edges,units=[],board}){
  const scenario=scenarioFor(entries,board);
  const state=createGameState({scenario,rules:defaultRules,hexes:plain(uniqueCoords(coords)),edges,units,seed:77});
  return {state,scenario};
}
function net(spec){const {state,scenario}=stateFor(spec);return {state,scenario,network:computeActiveGermanRailNetwork(state,scenario)};}

// 1 one repaired line from a non-default west entry -> every connected edge/endpoint is active.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0);
  const edges=[rail(a,b),rail(e,a),rail(b,c)]; // intentionally shuffled
  const {state,scenario,network}=net({entries:[e],coords:[e,a,b,c],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.deepEqual(network.hexKeys,[e,a,b,c].map(hk).sort());
  assert.deepEqual(network.entryHexKeys,[hk(e)]);
  assert(isGermanRailEdgeActive(network,edges[0].key));
  assert(isGermanRailHexActive(network,hk(c)));
  assert.deepEqual(validateGameStateIntegrity(state,defaultRules,scenario),[]);
  assert.equal('rail' in state,false);
  assert.equal('maxActiveRailheads' in defaultRules.rail,false);
}

// 2 repaired isolated segment is legal state but inactive.
{
  const e=H(0,0),x=H(4,0),y=H(5,0),edge=rail(x,y);
  const {state,scenario,network}=net({entries:[e],coords:[e,x,y],edges:[edge]});
  assert.deepEqual(network,{edgeKeys:[],hexKeys:[],entryHexKeys:[]});
  assert.deepEqual(validateGameStateIntegrity(state,defaultRules,scenario),[]);
}

// 3 unrepaired edge is inactive.
{
  const e=H(0,0),a=H(1,0),edge=rail(e,a,{repairedBy:null});
  const {network}=net({entries:[e],coords:[e,a],edges:[edge]});
  assert.deepEqual(network.edgeKeys,[]);
}

// 4 destroyed repaired edge stops the network; rail beyond it stays inactive.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0);
  const first=rail(e,a),destroyed=rail(a,b,{destroyed:true}),beyond=rail(b,c);
  const {network}=net({entries:[e],coords:[e,a,b,c],edges:[first,destroyed,beyond]});
  assert.deepEqual(network.edgeKeys,[first.key]);
  assert.deepEqual(network.hexKeys,[e,a].map(hk).sort());
}

// 5 an unrepaired gap likewise makes repaired rail beyond the gap inactive.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0);
  const first=rail(e,a),gap=rail(a,b,{repairedBy:null}),beyond=rail(b,c);
  const {network}=net({entries:[e],coords:[e,a,b,c],edges:[beyond,gap,first]});
  assert.deepEqual(network.edgeKeys,[first.key]);
}

// 6 branch: every repaired connected branch is active; there is no branch-count cap.
{
  const e=H(0,0),j=H(1,0),north=H(2,-1),south=H(1,1);
  const edges=[rail(j,north),rail(j,south),rail(e,j)];
  const {network}=net({entries:[e],coords:[e,j,north,south],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// 7 cycle completes without recursion/duplicates.
{
  const e=H(0,0),a=H(1,0),b=H(1,-1);
  const edges=[rail(e,a),rail(a,b),rail(b,e)];
  const {network}=net({entries:[e],coords:[e,a,b],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.equal(new Set(network.edgeKeys).size,3);
  assert.equal(new Set(network.hexKeys).size,3);
}

// 8 two west entries seed networks that reconnect/merge without duplicates.
{
  const w1=H(0,0),a=H(1,0),mid=H(2,0),b=H(3,0),w2=H(4,0);
  const edges=[rail(w1,a),rail(a,mid),rail(mid,b),rail(b,w2)];
  const {network}=net({entries:[w2,w1],coords:[w1,a,mid,b,w2],edges});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
  assert.deepEqual(network.entryHexKeys,[hk(w1),hk(w2)].sort());
}

// 9 a Soviet-occupied west entry cannot seed, while another valid entry still does.
{
  const w1=H(0,0),a=H(1,0),w2=H(0,3),b=H(1,3);
  const blockedEdge=rail(w1,a),validEdge=rail(w2,b);
  const {network}=net({entries:[w1,w2],coords:[w1,a,w2,b],edges:[blockedEdge,validEdge],units:[soviet('s-block',w1)]});
  assert.deepEqual(network.edgeKeys,[validEdge.key]);
  assert.deepEqual(network.entryHexKeys,[hk(w2)]);
}

// 10 Soviet occupation of a middle railway hex cuts the network before that hex; removing it reconnects automatically.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),c=H(3,0);
  const ea=rail(e,a),ab=rail(a,b),bc=rail(b,c),edges=[ea,ab,bc];
  const built=stateFor({entries:[e],coords:[e,a,b,c],edges,units:[soviet('s-mid',b)]});
  let network=computeActiveGermanRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,[ea.key]);
  assert.deepEqual(network.hexKeys,[e,a].map(hk).sort());
  built.state.units['s-mid'].alive=false;
  network=computeActiveGermanRailNetwork(built.state,built.scenario);
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// 11 enemy ZOC without occupation does not cut rail.
{
  const e=H(0,0),a=H(1,0),b=H(2,0),zocUnit=H(1,1);
  const edges=[rail(e,a),rail(a,b)];
  const {network}=net({entries:[e],coords:[e,a,b,zocUnit],edges,units:[soviet('s-zoc',zocUnit)]});
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// 12 output is canonical/sorted and the algorithm is independent of the Strategic Reset F board size/entry labels.
{
  const e=H(-3,7),a=H(-2,7),b=H(-1,7);
  const edges=[rail(a,b),rail(e,a)];
  const {network}=net({entries:[e],coords:[e,a,b],edges,board:{paperColumns:3,paperRows:2}});
  assert.deepEqual(network.edgeKeys,[...network.edgeKeys].sort());
  assert.deepEqual(network.hexKeys,[...network.hexKeys].sort());
  assert.deepEqual(network.entryHexKeys,[...network.entryHexKeys].sort());
  assert.deepEqual(network.edgeKeys,edges.map(x=>x.key).sort());
}

// 13 integrity: scenario west entries must exist; repairedBy requires a present railway.
{
  const e=H(0,0),a=H(1,0);
  const scenario=scenarioFor([H(9,9)]);
  const badRail=rail(e,a,{present:false,repairedBy:'GERMAN'});
  const state=createGameState({scenario,rules:defaultRules,hexes:plain([e,a]),edges:[badRail],units:[],seed:1});
  const codes=validateGameStateIntegrity(state,defaultRules,scenario).map(x=>x.code);
  assert(codes.includes('GERMAN_WEST_RAIL_ENTRY_INVALID'));
  assert(codes.includes('RAILWAY_REPAIR_WITHOUT_TRACK'));
}

console.log('Digital Branch Task 002B-1 Active German Rail Network / DR-001 smoke checks passed.');
