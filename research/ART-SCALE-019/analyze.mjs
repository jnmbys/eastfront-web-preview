// Read-only map audit. Writes research output only; no map/template generation.
import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {importLegacyMap} from '../../candidate/vendor/eastfront-digital-core/dist/scenario/importLegacyFMap.js';
import {axialToPaper, hexDistance, hexKey} from '../../candidate/vendor/eastfront-digital-core/dist/core/hex.js';
import {defaultScenario} from '../../candidate/vendor/eastfront-digital-core/dist/scenario/defaultScenario.js';
const root = new URL('../../', import.meta.url);
const rawBytes = await readFile(new URL('candidate/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',root));
const raw = JSON.parse(rawBytes), imported = importLegacyMap(raw);
const recorded = JSON.parse(await readFile(new URL('evidence/ART-MAP-015/semantic-map.json',root)));
const hash = createHash('sha256').update(rawBytes).digest('hex');
assert.equal(hash,'150ed628f53e9d1d3b2663157ec9a02678c0e09a840c03e404469a1a850ce0d3');
const cells = imported.hexes.map(h=>({...h,label:axialToPaper(h.coord).label}));
const byLabel = new Map(cells.map(c=>[c.label,c]));
assert.equal(cells.length,640);
assert.equal(new Set(cells.map(c=>hexKey(c.coord))).size,640);
assert.deepEqual(cells.map(c=>[c.label,c.terrain]).sort(),recorded.cells.map(c=>[c.label,c.terrain]).sort());
const edges = imported.edges.map(e=>({key:e.key,a:axialToPaper(e.a).label,b:axialToPaper(e.b).label,road:!!e.road,rail:!!e.railway?.present,river:e.river??null,bridge:e.bridge??null}));
const normalize = e=>JSON.stringify([...[e.a,e.b].sort(),e.road,e.rail,e.river,e.bridge]);
assert.deepEqual(edges.map(normalize).sort(),recorded.edges.map(normalize).sort());
for(const e of edges){assert(byLabel.has(e.a)&&byLabel.has(e.b));assert.equal(hexDistance(byLabel.get(e.a).coord,byLabel.get(e.b).coord),1);}
const railEdges = edges.filter(e=>e.rail), graph = new Map();
for(const {a,b} of railEdges){if(!graph.has(a))graph.set(a,new Set());if(!graph.has(b))graph.set(b,new Set());graph.get(a).add(b);graph.get(b).add(a);}
function distances(start){const d=new Map([[start,0]]),q=[start];for(let i=0;i<q.length;i++)for(const n of graph.get(q[i])??[])if(!d.has(n)){d.set(n,d.get(q[i])+1);q.push(n);}return d;}
function components(omit=null){const seen=new Set(),groups=[];for(const v of graph.keys()){if(v===omit||seen.has(v))continue;const q=[v];seen.add(v);for(let i=0;i<q.length;i++)for(const n of graph.get(q[i]))if(n!==omit&&!seen.has(n)){seen.add(n);q.push(n);}groups.push(q.sort());}return groups;}
const groups = components(), degreeHistogram={};
for(const ns of graph.values())degreeHistogram[ns.size]=(degreeHistogram[ns.size]??0)+1;
assert.equal([...graph.values()].reduce((s,ns)=>s+ns.size,0),2*railEdges.length);
const cities=cells.filter(c=>c.terrain.includes('CITY'));
const isCapital=c=>['MAIN_CITY','OUTER_CITY'].includes(c.terrain);
const cityStats=cities.map(c=>{
 const d=distances(c.label), other=cities.filter(o=>o!==c&&!(isCapital(c)&&isCapital(o)));
 const nearestRail=other.map(o=>({label:o.label,edges:d.get(o.label)??null})).filter(x=>x.edges!==null).sort((a,b)=>a.edges-b.edges);
 return {label:c.label,terrain:c.terrain,railDegree:graph.get(c.label)?.size??0,
  nearestOtherComplexByRail:nearestRail[0]??null,
  nearestOtherComplexHexDistance:Math.min(...other.map(o=>hexDistance(c.coord,o.coord))),
  ring1:cells.filter(o=>hexDistance(c.coord,o.coord)===1).map(o=>({label:o.label,terrain:o.terrain})),
  ring2NonLakeCells:cells.filter(o=>hexDistance(c.coord,o.coord)===2&&o.terrain!=='LAKE').length};
});
const labelList=coords=>coords.map(c=>axialToPaper(c).label);
const ports={westRailEntries:labelList(defaultScenario.germanWestRailEntries),eastRailExits:labelList(defaultScenario.sovietEastRailExits),sovietSupplySources:labelList(defaultScenario.sovietSupplySources)};
const allPorts=[...ports.westRailEntries,...ports.eastRailExits];
assert(allPorts.every(p=>graph.has(p)));
const occupied=new Map();for(const f of recorded.fixtures){const p=axialToPaper(f.hex).label;occupied.set(p,(occupied.get(p)??0)+1);}
const summary={
 inputs:{baseline:'f09b0fb7eef0325604b71ae8640fcde9f5061b94',formalMapSHA256:hash,method:'Unweighted undirected intact rail graph. No ownership, damage, enemy, supply, movement or VP simulation.'},
 terrainCounts:cells.reduce((a,c)=>(a[c.terrain]=(a[c.terrain]??0)+1,a),{}),
 network:{uniqueFeatureEdges:edges.length,roadEdges:edges.filter(e=>e.road).length,railEdges:railEdges.length,riverEdges:edges.filter(e=>e.river).length,roadRailOverlaps:edges.filter(e=>e.road&&e.rail).length,
  riverTransportCrossings:edges.filter(e=>e.bridge).map(e=>({a:e.a,b:e.b,road:e.road,rail:e.rail,bridge:e.bridge})),
  railCells:graph.size,railCellSharePercent:100*graph.size/640,degreeHistogram,componentCount:groups.length,cycleRank:railEdges.length-graph.size+groups.length,
  terminals:[...graph].filter(([,n])=>n.size===1).map(([p])=>p).sort(),
  junctions:[...graph].filter(([,n])=>n.size>=3).map(([p,n])=>({label:p,degree:n.size,terrain:byLabel.get(p).terrain})).sort((a,b)=>a.label.localeCompare(b.label)),
  articulationCells:[...graph.keys()].filter(p=>components(p).length>groups.length).sort(),
  cityRailDistances:cities.map(c=>({from:c.label,to:Object.fromEntries(cities.map(o=>[o.label,distances(c.label).get(o.label)??null]))})),
  ports,portReachability:allPorts.map(p=>({from:p,reachesPorts:allPorts.filter(o=>distances(p).has(o)),reachesCities:cities.filter(o=>distances(p).has(o.label)).map(o=>o.label)}))},
 cities:cityStats,
 displayFixtures:{units:recorded.fixtures.length,occupiedCells:occupied.size,stackHistogram:[...occupied.values()].reduce((a,n)=>(a[n]=(a[n]??0)+1,a),{}),notice:'Display fixtures, not a strategic roster or stack stress test.'},
 industrialBudgetExamples:[4,6,8].map(n=>({clusters:n,reservationCells:[2*n,3*n],sharePercent:[200*n/640,300*n/640],status:n===8?'stress-case only':'proposed planning range, not actual locations or rule occupancy'})),
 checks:{formalHash:'PASS',terrainAndEdgesMatch015:'PASS',allEdgesAdjacent:'PASS',railDegreeSum:'PASS',boundaryPortsOnRail:'PASS'},
 limitations:['Static graph connectivity is not valid current supply or legal movement.','No map/renderer/assets/rules changed.','No startup, GPU, Huawei, browser or physical touch acceptance performed.']
};
await writeFile(new URL('audit.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',terrain:summary.terrainCounts,network:{...summary.network,cityRailDistances:undefined,portReachability:undefined},cities:cityStats.map(({ring1,...c})=>({...c,ring1NonLake:ring1.filter(c=>c.terrain!=='LAKE').length})),fixtures:summary.displayFixtures},null,2));
