import{officerDecision}from'../../.logistics-dist/ai/fair/officer.js';
// Trusted read-only adapter. The policy receives only FairHost.observe, never queryModel.
import fs from 'node:fs';import{queryModel,forcedAction,validateIntent}from'../../.logistics-dist/server/gameplay.js';
import{playerSnapshot}from'../../.logistics-dist/server/playerSnapshot.js';
import{RulesEngine,defaultRules,defaultScenario}from'../../.logistics-dist/src/core-adapter/core.js';
import{FairHost}from'../../.logistics-dist/ai/authority/FairHost.js';import{basicAgent}from'../../.logistics-dist/ai/fair/basicAgent.js';
import{isNetworkAction,isQueryDraft}from'../../.logistics-dist/src/multiplayer/gameplayProtocol.js';
const q=JSON.parse(fs.readFileSync(0,'utf8')),core=q.core,assignments=Object.values(core.controllers).map(c=>({controllerId:c.id,coreControllerId:c.id,viewer:c.side,seat:c.side}));
const controller=assignments.find(a=>a.viewer===q.viewer).controllerId;
const match={authoritative:{state:core,rules:defaultRules,scenario:defaultScenario,engine:new RulesEngine(defaultRules,defaultScenario),activeViewerControllerId:controller,lastResult:null,integrityIssues:[]},controllerAssignments:assignments,status:core.phase==='GAME_OVER'?'FINISHED':'ACTIVE',disclosedBattles:Object.fromEntries(assignments.map(a=>[a.controllerId,new Set(core.pendingDecision?.decisionOwnerControllerId===a.controllerId?[core.pendingDecision.battleId]:[])]))};
if(q.action){if(!isNetworkAction(q.action)||validateIntent(match,controller,q.action))throw Error('UNAUTHORIZED_ACTION');console.log(JSON.stringify({controller}));}
else if(q.ai||q.officer){const host=new FairHost({matchId:q.matchId,initialState:core,rules:defaultRules,scenario:defaultScenario,agentSeeds:{GERMAN:101,SOVIET:202}});const input=structuredClone(host.observe(controller));input.history=q.history??[];input.agentRandom.decisionIndex=q.decisionIndex??0;if(q.officer){input.view.resources[q.viewer].rp=Math.min(input.view.resources[q.viewer].rp,q.officer.rp);console.log(JSON.stringify({...officerDecision(input,q.officer.members,q.officer.order,q.officer.profile),observationKey:input.observationKey}));}else console.log(JSON.stringify({decision:basicAgent(input),observationKey:input.observationKey}));}
else{
 if(q.draft&&!isQueryDraft(q.draft))throw Error('INVALID_DRAFT');
 const view=playerSnapshot(match,controller),known=new Set(view.units.map(u=>u.id));
 // As in SUPPLY-UX-020: no invisible opponent in optional human preview queries.
 for(const [id,u]of Object.entries(core.units))if(u.side!==q.viewer&&!known.has(id))delete core.units[id];
 const model=queryModel(match,controller,q.draft);model.playerView=view;model.hexes=view.hexes;model.edges=view.edges;
 if(model.combat){model.combat.attackDraft.artilleryUnitIds=[];model.combat.attackDraft.selectedArtilleryId=null;}
 console.log(JSON.stringify({model,view,canAct:!model.readOnly,status:match.status,forcedAction:forcedAction(match,controller,q.draft),events:[]}));
}
