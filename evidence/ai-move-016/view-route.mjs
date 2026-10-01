// Offline evidence helper only. Receives the authorized DTO, never GameState/Core.
// Screens an already supplied ordinary-unit route against observable constraints.
// This is NOT a replacement policy, legality oracle, or exhaustive route search.
import assert from 'node:assert/strict';
import {hexKey,hexDistance,getNeighbors} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
export function viewRoute(input,unitId,path){
 const {view,rules}=input,u=view.units.find(u=>u.id===unitId);assert(u?.friendly);assert.notEqual(u.type,'RECON');assert(path.length>0&&path.length<=2);assert(!rules.road.wholeMoveBonusEnabled);
 const enemies=view.units.filter(e=>e.side!==view.viewer),board=new Map(view.hexes.map(h=>[hexKey(h.coord),h]));
 const zoc=new Set(enemies.filter(e=>{const ts=Object.values(rules.templates).filter(t=>t.side===e.side&&t.type===e.type);return ts.length&&ts.every(t=>t.exertsZoc);}).flatMap(e=>getNeighbors(e.hex).map(hexKey)));
 const edgeKey=(a,b)=>[hexKey(a),hexKey(b)].sort().join('|'),edges=new Map(view.edges.map(e=>[edgeKey(e.a,e.b),e]));
 const at=h=>({hex:h,identifiedHex:view.identifiedHexKeys.includes(hexKey(h)),knownZoc:zoc.has(hexKey(h)),adjacentEnemies:enemies.filter(e=>hexDistance(h,e.hex)===1).map(e=>e.id),visibleEnemies:enemies.filter(e=>hexKey(e.hex)===hexKey(h)).map(e=>e.id),contacts:view.contacts.filter(c=>hexKey(c.hex)===hexKey(h)).map(c=>c.contactId),friendlyOccupants:view.units.filter(v=>v.side===view.viewer&&v.id!==unitId&&hexKey(v.hex)===hexKey(h)).map(v=>v.id)});
 const maxMP=Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?rules.oosMovementPenalty:0));let from=u.hex,spent=0,entered=false;const steps=[],issues=[];
 if(!u.friendly.alive||u.friendly.hasMoved||u.friendly.dedicatedRailRepair)issues.push('KNOWN_INELIGIBLE');
 for(const [i,to] of path.entries()){
  const cell=board.get(hexKey(to)),e=edges.get(edgeKey(from,to)),facts=at(to),terrain=rules.terrainMovementCost[cell?.terrain];
  const road=e?.road===true,bridge=road&&e?.bridge&&!e.bridge.destroyed&&['ROAD','BOTH'].includes(e.bridge.kind);
  const terrainCost=road?rules.road.movementCost:u.type==='JAGER'&&['FOREST','HILL'].includes(cell?.terrain)?Math.max(1,terrain-1):terrain;
  const cost=Number.isFinite(terrainCost)?terrainCost+(e?.river&&!(bridge&&rules.road.bridgeCancelsRiverMovementSurcharge)?rules.riverMovementSurcharge[e.river]??0:0):Infinity;
  if(hexDistance(from,to)!==1||!cell||terrain==='IMPASSABLE')issues.push('KNOWN_BAD_STEP');
  if(facts.visibleEnemies.length||facts.contacts.length)issues.push('KNOWN_OCCUPIED_OR_CONTACT');
  if(entered)issues.push('CONTINUED_AFTER_KNOWN_ZOC_ENTRY');
  if(zoc.has(hexKey(from))&&facts.knownZoc)issues.push('KNOWN_ZOC_TO_ZOC');
  if(!zoc.has(hexKey(from))&&facts.knownZoc)entered=true;
  if(i===path.length-1&&facts.friendlyOccupants.length>=rules.stackingLimit)issues.push('KNOWN_END_STACK_FULL');
  spent+=cost;steps.push({...facts,terrain:cell?.terrain,edge:e??null,cost,cumulativeMP:spent});from=to;
 }
 if(spent>maxMP)issues.push('KNOWN_MP_EXCEEDED');
 return {unitId,origin:at(u.hex),path,steps,spentMP:spent,maxMP,issues:[...new Set(issues)],proposalSupported:issues.length===0,limits:{maxSuppliedSteps:2,noEnumeration:true,noCore:true,unknownEnemiesNotExcluded:true,notCovered:['recon exception','enabled road bonus','future occupancy','unknown enemy ZOC or blockers']}};
}
