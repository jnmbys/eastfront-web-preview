// Server-only adapter: reuse the main game's authorized models and Action validation.
import fs from 'node:fs';
import {queryModel,forcedAction,validateIntent} from '../../.integrate-dist/server/gameplay.js';
import {playerSnapshot} from '../../.integrate-dist/server/match.js';
import {isNetworkAction,isQueryDraft} from '../../.integrate-dist/src/multiplayer/gameplayProtocol.js';
import {RulesEngine,defaultRules,defaultScenario} from '../../.integrate-dist/src/core-adapter/core.js';
import {derivePresentationEvents} from '../../.integrate-dist/src/presentation/events.js';
import {filterPresentationEvents} from '../../.integrate-dist/src/player-view/presentationVisibility.js';
const req=JSON.parse(fs.readFileSync(0,'utf8'));
function match(core){
 const assignments=Object.values(core.controllers).map(c=>({controllerId:c.id,coreControllerId:c.id,viewer:c.side,seat:c.side}));
 return {authoritative:{state:core,rules:defaultRules,scenario:defaultScenario,engine:new RulesEngine(defaultRules,defaultScenario),activeViewerControllerId:assignments[0].controllerId,lastResult:null,integrityIssues:[]},controllerAssignments:assignments,status:core.phase==='GAME_OVER'?'FINISHED':'ACTIVE',disclosedBattles:Object.fromEntries(assignments.map(a=>[a.controllerId,new Set(req.memory?.[a.viewer]??[])]))};
}
try {
 const m=match(req.core),controller=m.controllerAssignments.find(a=>a.viewer===req.viewer)?.controllerId;
 if(!controller)throw Error('viewer');
 if(req.action){if(!isNetworkAction(req.action)||validateIntent(m,controller,req.action))throw Error('invalid/unauthorized Action');console.log(JSON.stringify({controller}));process.exit(0);}
 if(req.draft&&!isQueryDraft(req.draft))throw Error('draft');
 const memory=req.memory??{GERMAN:[],SOVIET:[]};let events=[];
 if(req.previous&&req.entry){
  const previous=match(req.previous),entry=req.entry;
  const result={accepted:true,state:req.core,action:entry.core_actions.at(-1),events:[...entry.events,...entry.supply_events],issues:[]};
  const all=derivePresentationEvents(req.previous,result);
  for(const a of m.controllerAssignments){
   const safe=filterPresentationEvents(all,playerSnapshot(previous,a.controllerId),playerSnapshot(m,a.controllerId));
   for(const e of safe)if(e.battleId)m.disclosedBattles[a.controllerId].add(e.battleId);
   if(req.core.pendingDecision?.side===a.viewer)m.disclosedBattles[a.controllerId].add(req.core.pendingDecision.battleId);
   memory[a.viewer]=[...m.disclosedBattles[a.controllerId]];
   if(a.controllerId===controller)events=safe.map((e,i)=>({...e,id:`s:${req.revision}:${i}`,actionId:`s:${req.revision}`}));
  }
 }
 if(req.core.pendingDecision?.side===req.viewer)m.disclosedBattles[controller].add(req.core.pendingDecision.battleId);
 const view=playerSnapshot(m,controller),visible=new Set(view.units.map(u=>u.id));
 // Query availability must not probe invisible enemies. Real actions always use the full authority.
 const query=match(structuredClone(req.core));query.disclosedBattles=m.disclosedBattles;
 for(const [id,u] of Object.entries(query.authoritative.state.units))if(u.side!==req.viewer&&!visible.has(id))delete query.authoritative.state.units[id];
 for(const [id,effect] of Object.entries(req.effects??{})){
  const u=query.authoritative.state.units[id];if(u?.expSupply&&!req.core.pendingDecision)u.expSupply={attackFactor:effect.factor,movementCap:effect.cap};
 }
 const model=queryModel(query,controller,req.draft);model.playerView=view;model.hexes=view.hexes;model.edges=view.edges;
 // Optional attack-support selection is outside frozen sandbox live.execute's allowlist.
 if(model.combat){model.combat.attackDraft.artilleryUnitIds=[];model.combat.attackDraft.selectedArtilleryId=null;}
 console.log(JSON.stringify({view,model,events,memory,forcedAction:forcedAction(query,controller,req.draft),canAct:!model.readOnly,status:m.status}));
} catch(e){console.error(String(e));process.exitCode=1;}
