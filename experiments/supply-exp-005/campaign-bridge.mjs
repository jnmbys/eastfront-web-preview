// Lifecycle metadata only. No AI/provider and no hidden legal-path oracle.
import fs from 'node:fs';import * as c from './core/dist/index.js';
const r=JSON.parse(fs.readFileSync(0,'utf8')),rules=c.defaultRules,scenario=c.defaultScenario;
let s=r.state;
if(r.op==='init'){
 const m=JSON.parse(fs.readFileSync(new URL('./data/core-map.json',import.meta.url)));
 s=c.createDeploymentGameState({scenario,rules,seed:r.seed??17,hexes:m.nodes.map(n=>({coord:n.coord,terrain:n.terrain,control:n.control})),edges:m.edges.filter(e=>e.core).map(e=>e.core)});
 const issues=c.validateGameStateIntegrity(s,rules,scenario);if(issues.length)throw Error(JSON.stringify(issues));
 console.log(JSON.stringify(s));
}else{
 const side=r.viewer==='G'?'GERMAN':'SOVIET',own=Object.values(s.units).filter(u=>u.side===side);
 const deployment=c.isDeploymentPhase(s);
 // Public zone, own roster, public reinforcement entry geography. Core validates occupancy on action.
 console.log(JSON.stringify({phase:s.phase,turn:s.turn,turn_limit:scenario.turnLimit,victory:s.victory,
  deployment:deployment?{roster:scenario.deployment.units.filter(u=>u.side===side).map(u=>({...u,placed:own.some(x=>x.id===u.id)})),zone:c.deploymentHexKeysForSide(s,scenario,side).map(k=>s.hexes[k].coord)}:null,
  reinforcements:side==='SOVIET'&&s.phase==='SOVIET_REINFORCEMENT_SUPPLY'?c.getAvailableSovietReinforcements(s,scenario):[],
  entry_hexes:side==='SOVIET'?scenario.sovietEastRailExits:[]}));
}
