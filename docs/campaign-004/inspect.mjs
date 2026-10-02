// Read-only queries of the pinned actual Core. No mutation, fake deployment, or path allocator.
import fs from 'node:fs';
import * as c from './.runtime/experiments/supply-exp-005/core/dist/index.js';
const {state:s}=JSON.parse(fs.readFileSync(0,'utf8'));
const rules=c.defaultRules, scenario=c.defaultScenario;
const map=JSON.parse(fs.readFileSync(new URL('./.runtime/experiments/supply-exp-005/data/core-map.json',import.meta.url)));
const names=Object.fromEntries(map.nodes.map(n=>[c.hexKey(n.coord),n.id]));
const paper=x=>names[typeof x==='string'?x:c.hexKey(x)];
const bases=Object.fromEntries(['GERMAN','SOVIET'].map(side=>[side,c.computeRecoveryBaseHexKeys(s,side,scenario).map(paper)]));
const units=Object.values(s.units).filter(u=>u.alive).map(u=>{
 const repair={type:'REPAIR_UNIT',controllerId:u.controllerId,unitId:u.id};
 return {id:u.id,hex:paper(u.hex),step:u.step,supplyState:u.supplyState,
  repairIssues:c.validateRecoveryAction(s,rules,scenario,repair),
  moves:c.getNeighbors(u.hex).flatMap(to=>{
   const action={type:'MOVE',controllerId:u.controllerId,unitId:u.id,path:[to]};
   const v=c.validateMoveAction(s,rules,action);
   return v.issues.length?[]:[{action,to:paper(to),spentMP:v.spentMP,maxMP:v.maxMP}];
  })};
});
const railG=c.computeActiveGermanRailNetwork(s,scenario),railS=c.computeActiveSovietSupplyRailNetwork(s,scenario);
const sites=['J7','J6','I7','M14','M15','N15','R9','R10','S10','AD9','AD10','AE10','A5','A10','A16','AF4','AF10','AF16','AC10','AC11'];
const siteFacts=sites.map(id=>{
 const n=map.nodes.find(n=>n.id===id),key=c.hexKey(n.coord),h=s.hexes[key];
 return {id,key,terrain:h.terrain,control:h.control,occupants:Object.values(s.units).filter(u=>u.alive&&c.hexKey(u.hex)===key).map(u=>u.id),
  recoveryBaseG:bases.GERMAN.includes(id),recoveryBaseS:bases.SOVIET.includes(id),
  incidentEdges:Object.values(s.edges).filter(e=>c.hexKey(e.a)===key||c.hexKey(e.b)===key).map(e=>({...e,a:paper(e.a),b:paper(e.b)}))};
});
const pairs=[['J7','J6'],['M14','M15'],['R9','R10'],['AD9','AD10']].map(([a,b])=>{
 const x=map.nodes.find(n=>n.id===a),y=map.nodes.find(n=>n.id===b);
 const edge=Object.values(s.edges).find(e=>[paper(e.a),paper(e.b)].includes(a)&&[paper(e.a),paper(e.b)].includes(b));
 return {a,b,hexDistance:c.hexDistance(x.coord,y.coord),coreEdge:edge??null};
});
console.log(JSON.stringify({phase:s.phase,turn:s.turn,hexCount:Object.keys(s.hexes).length,scenario,rules,
 integrity:c.validateGameStateIntegrity(s,rules,scenario),bases,units,siteFacts,pairs,
 railG:{...railG,paperHexes:railG.hexKeys.map(paper)},railS:{...railS,paperHexes:railS.hexKeys.map(paper)},
 sovietEntryBoardFacts:c.computeLegalSovietReinforcementEntryHexKeys(s,rules,scenario).map(paper),
 sovietAvailable:c.getAvailableSovietReinforcements(s,scenario),
 slots:c.deriveSovietReinforcementSlots(scenario)}));
