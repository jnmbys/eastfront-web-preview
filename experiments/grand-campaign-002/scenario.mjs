import fs from 'node:fs';
import * as core from '../../vendor/eastfront-digital-core/dist/index.js';
import {config,sides,hex,key} from '../grand-campaign-001/scenario.mjs';
export {config,sides,hex,key};
export const layout=JSON.parse(fs.readFileSync(new URL('./layout.json',import.meta.url),'utf8'));
const hydro=JSON.parse(fs.readFileSync(new URL('./hydrology.json',import.meta.url),'utf8'));
const pixel=h=>({x:Math.sqrt(3)*(h.q+h.r/2),y:1.5*h.r}),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),vk=p=>`${Math.round(p.x*1e6)},${Math.round(p.y*1e6)}`;
const inside=([x,y],poly)=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const[a,b]=poly[i],[c,d]=poly[j];if((b>y)!==(d>y)&&x<(c-a)*(y-b)/(d-b)+a)yes=!yes;}return yes;};
function shortest(start,end,neighbors,heuristic=()=>0){
 const open=[{id:start,f:heuristic(start),g:0}],cost=new Map([[start,0]]),prev=new Map();
 while(open.length){open.sort((a,b)=>a.f-b.f||a.id.localeCompare(b.id));const n=open.shift();if(n.g!==cost.get(n.id))continue;if(n.id===end){const out=[end];while(out[0]!==start)out.unshift(prev.get(out[0]));return out;}
  for(const x of neighbors(n.id)){const g=n.g+x.cost;if(g<(cost.get(x.id)??Infinity)){cost.set(x.id,g);prev.set(x.id,n.id);open.push({id:x.id,g,f:g+heuristic(x.id)});}}}
 throw Error(`NO_PATH ${start} ${end}`);
}
let geometryCache;
export function buildGeography({cache=true}={}){
 if(cache&&geometryCache)return structuredClone(geometryCache);
 const raw={rows:32,cols:40,terrain:{},roads:[],rails:[],rivers:[]},cells=new Map(),vertices=new Map(),borders=new Map(),vertexAdj=new Map(),riverEdges=new Map(),riverTracks=[];
 for(let c=1;c<=40;c++)for(let r=1;r<=32;r++){
  const h=hex(c,r),id=core.hexKey(h),p=pixel(h);cells.set(id,{id,h,p,cell:[c,r]});let t='plain';
  if(layout.forests.some(a=>inside([c,r],a)))t='forest';if(layout.hills.some(a=>inside([c,r],a)))t='hill';if(layout.wetlands.some(a=>inside([c,r],a)))t='marsh';raw.terrain[`${c},${r}`]=t;
  const corners=Array.from({length:6},(_,i)=>({x:p.x+Math.cos((30+60*i)*Math.PI/180),y:p.y+Math.sin((30+60*i)*Math.PI/180)}));
  for(let i=0;i<6;i++){const a=corners[i],b=corners[(i+1)%6],va=vk(a),vb=vk(b),bid=[va,vb].sort().join('|');vertices.set(va,a);vertices.set(vb,b);if(!borders.has(bid))borders.set(bid,{va,vb,cells:[]});borders.get(bid).cells.push(id);}
 }
 for(const b of borders.values())if(b.cells.length===2){for(const[a,z]of[[b.va,b.vb],[b.vb,b.va]]){if(!vertexAdj.has(a))vertexAdj.set(a,[]);vertexAdj.get(a).push({id:z,cost:1,b});}}
 const project=([lon,lat])=>{const q=(lon-hydro.bbox[0])/(hydro.bbox[2]-hydro.bbox[0])*39,r=(hydro.bbox[3]-lat)/(hydro.bbox[3]-hydro.bbox[1])*31-q/2;return pixel({q,r});};
 const nearest=p=>[...vertexAdj.keys()].sort((a,b)=>dist(vertices.get(a),p)-dist(vertices.get(b),p))[0];
 for(const f of hydro.features.filter(f=>f.kind==='river'))for(const part of f.parts){
  const pts=part.map(project),anchors=[];for(const p of pts)if(!anchors.length||dist(p,anchors.at(-1))>.8)anchors.push(p);anchors.push(pts.at(-1));
  const path=[];for(let i=1;i<anchors.length;i++){const a=nearest(anchors[i-1]),b=nearest(anchors[i]);if(a===b)continue;const line=shortest(a,b,id=>vertexAdj.get(id)??[],id=>dist(vertices.get(id),vertices.get(b)));path.push(...(path.length?line.slice(1):line));}
  const edges=[];for(let i=1;i<path.length;i++){const border=borders.get([path[i-1],path[i]].sort().join('|'));if(!border||border.cells.length!==2)throw Error('INVALID_RIVER_BORDER');const[a,b]=border.cells.map(id=>cells.get(id)),id=core.canonicalEdgeKey(a.h,b.h),kind=['Dnieper','Daugava','Berezina','Sozh'].includes(f.name)?'main':'small';if(!riverEdges.has(id)||kind==='main')riverEdges.set(id,{a:a.cell,b:b.cell,kind});edges.push(id);}
  riverTracks.push({name:f.name,vertices:path,edges});
 }
 // Natural Earth simplification can leave a sub-hex gap at a confluence.
 // Join only this named, geographically attested tributary, within 1.01 edge units.
 const confluenceAdjustments=[];
 for(const [child,parent] of [['Berezina','Dnieper'],['Drut','Dnieper'],['Ula','Daugava']]){
  const children=riverTracks.filter(t=>t.name===child),parents=riverTracks.filter(t=>t.name===parent);
  const pairs=children.flatMap(t=>[t.vertices[0],t.vertices.at(-1)].flatMap(a=>parents.flatMap(p=>p.vertices.map(b=>({t,a,b,d:dist(vertices.get(a),vertices.get(b))}))))).sort((a,b)=>a.d-b.d);
  const pair=pairs[0];if(!pair||pair.d>1.01)throw Error(`CONFLUENCE_GAP ${child}`);
  if(pair.d>0){const path=shortest(pair.a,pair.b,id=>vertexAdj.get(id)??[]),edges=[];
   for(let i=1;i<path.length;i++){const border=borders.get([path[i-1],path[i]].sort().join('|')), [a,b]=border.cells.map(id=>cells.get(id)), id=core.canonicalEdgeKey(a.h,b.h);riverEdges.set(id,{a:a.cell,b:b.cell,kind:child==='Berezina'?'main':'small'});edges.push(id);}
   riverTracks.push({name:child,vertices:path,edges,confluenceRepair:true});confluenceAdjustments.push({child,parent,gap:pair.d,edges});
  }
 }
 raw.rivers=[...riverEdges.values()];
 const lakeCells=[];for(const f of hydro.features.filter(f=>f.kind==='lake')){
  const pts=f.parts.flat().map(project),p={x:pts.reduce((a,n)=>a+n.x,0)/pts.length,y:pts.reduce((a,n)=>a+n.y,0)/pts.length};const lake=[...cells.values()].sort((a,b)=>dist(a.p,p)-dist(b.p,p))[0];raw.terrain[lake.cell.join(',')]='lake';lakeCells.push({name:f.name,cell:lake.cell});
 }
 const nodes=[];for(const side of sides){const data=layout.sides[side];for(const[role,positions]of[['industry',data.industries],['depot',data.depots]])positions.forEach((cell,i)=>{
  if(raw.terrain[cell.join(',')]==='lake')throw Error('FACILITY_ON_LAKE');raw.terrain[cell.join(',')]='city';nodes.push({id:`${side}-${role}-${i+1}`,side,initialOwner:side,hex:key(...cell),label:`${core.columnToLetters(cell[0])}${cell[1]} ${role==='industry'?'工区':'站场'}`,role,incomeI:role==='industry'?config.economy.industrialIncome:0,sourceQ:role==='industry'?config.supply.sourceQPerLane:0,vp:role==='industry'?config.victory.industryVP:config.victory.junctionVP});
 });const cell=data.capital;raw.terrain[cell.join(',')]='maincity';nodes.push({id:side==='GERMAN'?'WEST-CAPITAL':'EAST-CAPITAL',hex:key(...cell),label:side==='GERMAN'?'西部战区总部':'东部战区总部',side,initialOwner:side,role:'capital',incomeI:0,sourceQ:0,vp:config.victory.capitalVP});}
 for(const o of layout.objectives){raw.terrain[o.cell.join(',')]='city';nodes.push({id:o.id,side:null,initialOwner:null,hex:key(...o.cell),label:o.label,role:'junction',incomeI:2,sourceQ:0,vp:config.victory.corridorObjectiveVP});}
 for(const p of layout.towns)if(raw.terrain[p.join(',')]!=='lake')raw.terrain[p.join(',')]='city';
 const lines=[],roadKeys=new Set(),railKeys=new Set();
 function route(name,via,rail,side){const path=[];for(let i=1;i<via.length;i++){
  const start=key(...via[i-1]),end=key(...via[i]);const chain=shortest(start,end,id=>core.getNeighbors(cells.get(id).h).filter(h=>cells.has(core.hexKey(h))).map(h=>cells.get(core.hexKey(h))).filter(n=>raw.terrain[n.cell.join(',')]!=='lake'&&(!side||owner(n.cell)===side)).map(n=>({id:n.id,cost:1+({plain:0,city:0,maincity:0,forest:.6,hill:1.2,marsh:3}[raw.terrain[n.cell.join(',')]]??0)+(riverEdges.has(core.canonicalEdgeKey(cells.get(id).h,n.h))?3:0)})),id=>core.hexDistance(cells.get(id).h,cells.get(end).h));path.push(...(path.length?chain.slice(1):chain));}
  for(let i=1;i<path.length;i++){const a=cells.get(path[i-1]),b=cells.get(path[i]),k=core.canonicalEdgeKey(a.h,b.h);if(!roadKeys.has(k)){roadKeys.add(k);raw.roads.push([a.cell,b.cell]);}if(rail&&!railKeys.has(k)){railKeys.add(k);raw.rails.push([a.cell,b.cell]);}}
  lines.push({name,rail,side:side??null,path});
 }
 function owner([c,r]){return c<=25?'GERMAN':c>=27?'SOVIET':null;}
 for(const side of sides){const d=layout.sides[side];for(let i=0;i<5;i++)route(`${side}后方支线${i+1}`,[d.industries[i],d.depots[i]],true,side);for(let i=1;i<5;i++){route(`${side}后方联络${i}`,[d.industries[i-1],d.industries[i]],true,side);route(`${side}前线纵向${i}`,[d.depots[i-1],d.depots[i]],true,side);}route(`${side}总部道路`,[d.capital,d.industries[2]],false,side);}
 for(const line of layout.crossings)route(line.name,line.via,line.rail);
 for(const town of layout.towns){const to=[...nodes].sort((a,b)=>core.hexDistance(hex(...town),cells.get(a.hex).h)-core.hexDistance(hex(...town),cells.get(b.hex).h))[0];route(`聚落${town.join(',')}支路`,[town,cells.get(to.hex).cell],false);}
 const map=core.importLegacyMap(raw),edgeMap=new Map(map.edges.map(e=>[e.key,e])),objectiveKeys=new Set(layout.objectives.map(o=>key(...o.cell)));
 for(const h of map.hexes)h.control=objectiveKeys.has(core.hexKey(h.coord))?null:owner(cells.get(core.hexKey(h.coord)).cell);
 const controls=new Map(map.hexes.map(h=>[core.hexKey(h.coord),h.control]));for(const e of map.edges)if(e.railway)e.railway.repairedBy=controls.get(core.hexKey(e.a))==='GERMAN'&&controls.get(core.hexKey(e.b))==='GERMAN'?'GERMAN':'SOVIET';
 const placements=[],counts=new Map();
 for(const side of sides)layout.sides[side].depots.forEach((depot,i)=>{
  const origin=key(...depot),reachable=new Map([[origin,0]]),queue=[origin];for(let at=0;at<queue.length;at++){const k=queue[at],d=reachable.get(k);if(d>=3)continue;for(const h of core.getNeighbors(cells.get(k).h)){const n=core.hexKey(h),e=edgeMap.get(core.canonicalEdgeKey(cells.get(k).h,h));if(!cells.has(n)||controls.get(n)!==side||raw.terrain[cells.get(n).cell.join(',')]==='lake'||e?.river==='MAJOR'&&!e.bridge)continue;if(!reachable.has(n)){reachable.set(n,d+1);queue.push(n);}}}
  for(let j=0;j<12;j++){const n=i*12+j,id=`${side==='GERMAN'?'G':'S'}-${String(n+1).padStart(3,'0')}`,direction=layout.sides[side].frontDirection,target=n>=58?hex(...depot):hex(depot[0]+(j<4?direction*2:j<8?0:-direction),depot[1]+[-1,0,1,2][j%4]);
   const available=[...reachable.keys()].filter(k=>(counts.get(k)??0)<(n>=58?2:1));available.sort((a,b)=>core.hexDistance(cells.get(a).h,target)-core.hexDistance(cells.get(b).h,target)||reachable.get(a)-reachable.get(b)||a.localeCompare(b));if(!available.length)throw Error('DEPLOYMENT_NO_SERVICE_CELL');const k=available[0];counts.set(k,(counts.get(k)??0)+1);placements.push({id,side,hex:cells.get(k).h,army:`${side==='GERMAN'?'西':'东'}-${i+1}集团军`,step:n>=58?1:0});
  }
 });
 const geometry={raw,nodes,placements,map,geography:{classification:layout.classification,extent:layout.referenceExtent,confluenceAdjustments,rivers:riverTracks,lakes:lakeCells,lines}};if(cache)geometryCache=geometry;return structuredClone(geometry);
}
export function createScenario(){return createScenarioFromGeography(buildGeography(),layout);}
export function createScenarioFromGeography(g,layout){
 const rules=structuredClone(core.defaultRules),scenario=structuredClone(core.defaultScenario);rules.id='grand-001-experimental';rules.recovery.initialRP={GERMAN:0,SOVIET:0};rules.recovery.maxUnitsPerTurn={GERMAN:config.recovery.unitsPerSidePerTurn,SOVIET:[{fromTurn:1,maxUnits:config.recovery.unitsPerSidePerTurn}]};for(const t of Object.values(rules.unitTemplates))t.recoveryCostPerStep=0;
 Object.assign(scenario,{id:layout.id,displayName:layout.label,board:{paperColumns:40,paperRows:32},rulesId:rules.id,turnLimit:config.turns,victoryMode:'HOST_FULL_TURN',initialUnits:[],reinforcements:[],capitalCoreHexes:[hex(...layout.sides.SOVIET.capital)],capitalOuterHexes:[],controllers:sides.map(side=>({id:side,side,controllerType:'HUMAN'})),germanWestRailEntries:layout.sides.GERMAN.industries.map(p=>hex(...p)),sovietEastRailExits:layout.sides.SOVIET.industries.map(p=>hex(...p)),sovietSupplySources:layout.sides.SOVIET.industries.map(p=>hex(...p))});
 const roster=g.placements.map((p,n)=>({id:p.id,side:p.side,templateId:(p.side==='GERMAN'?['G-INF','G-INF','G-INF','G-INF','G-PANZER','G-MOT','G-ARTY','G-ENG','G-RECON','G-INF','G-INF','G-INF']:['S-INF','S-INF','S-INF','S-INF','S-TANK','S-MOT','S-ARTY','S-ENG','S-AT','S-INF','S-INF','S-INF'])[n%12]}));
 scenario.deployment={sequence:['SOVIET','GERMAN'],hiddenUntilBothComplete:true,zones:Object.fromEntries(sides.map(side=>[side,{kind:'EXPLICIT_HEXES',hexes:g.map.hexes.filter(h=>h.control===side&&h.terrain!=='LAKE').map(h=>h.coord)}])),units:roster};
 let state=core.createDeploymentGameState({scenario,rules,...g.map,seed:config.seed});const engine=new core.RulesEngine(rules,scenario);
 for(const side of ['SOVIET','GERMAN']){for(const p of g.placements.filter(p=>p.side===side)){const r=engine.apply(state,{type:'DEPLOY_INITIAL_UNIT',controllerId:side,deploymentUnitId:p.id,hex:p.hex});if(!r.accepted)throw Error(JSON.stringify(r.issues));state=r.state;}const r=engine.apply(state,{type:'READY_FOR_PHASE_END',controllerId:side});if(!r.accepted)throw Error(JSON.stringify(r.issues));state=r.state;}
 for(const p of g.placements)state.units[p.id].step=p.step;const issues=core.validateGameStateIntegrity(state,rules,scenario);if(issues.length)throw Error(JSON.stringify(issues));return {rules,scenario,state,engine,...g};
}
