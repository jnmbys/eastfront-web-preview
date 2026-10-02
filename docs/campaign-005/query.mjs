// Read-only diagnostics and deterministic mandatory-choice selection on clones.
// No state returned here is used as a committed game state.
import fs from 'node:fs';import {pathToFileURL} from 'node:url';
const req=JSON.parse(fs.readFileSync(0,'utf8'));
const c=await import(pathToFileURL(req.coreFile).href),r=c.defaultRules,e=new c.RulesEngine(r,c.defaultScenario);
const s=structuredClone(req.state);
// Identical projection to pinned core-bridge.mjs; Python supplies original live.effects.
if(req.effects){s.expSupplyMode=true;for(const u of Object.values(s.units)){
 const tx=s.pendingDecision&&s.combatTransactions[s.pendingDecision.battleId];
 const locked=tx&&!tx.resolution&&tx.attackerUnitIds.includes(u.id)&&!['ATTACK','SCHWERPUNKT_ATTACK'].includes(req.action?.type);
 if(locked&&u.expSupply)continue;const p=req.effects[u.id];
 u.expSupply={attackFactor:p?.factor??1,movementCap:p?.cap??null};u.supplyState=p?.exhausted?'OUT_OF_SUPPLY':'SUPPLIED';u.temporarySupply=false;
}}
let out={};
if(req.op==='integrity')out={issues:c.validateGameStateIntegrity(s,r,c.defaultScenario)};
else if(req.op==='inspect'){
 out={units:Object.fromEntries(Object.values(s.units).map(u=>[u.id,{unit:u,stats:c.getUnitStats(u,r)}])),hexes:s.hexes};
}else if(req.op==='attack'){
 const issues=c.validateAttackAction(s,r,req.action);out={issues,context:issues.length?null:c.buildCombatContext(s,r,req.action)};
}else if(req.op==='move')out=c.validateMoveAction(s,r,req.action);
else if(req.op==='pending'){
 const p=s.pendingDecision;let chosen=null,visited=0;
 const base={controllerId:p.decisionOwnerControllerId,battleId:p.battleId};
 const accept=a=>{if(++visited>100000)throw Error('POLICY_SEARCH_CAP');if(e.apply(structuredClone(s),a).accepted){chosen=a;return true}return false};
 if(p.kind==='LOSS_ALLOCATION'){
  const ids=[...p.eligibleUnitIds].sort();function dfs(xs){if(xs.length===p.lossSteps)return accept({...base,type:'ALLOCATE_LOSSES',unitIdsByStep:xs});for(const id of ids)if(xs.filter(x=>x===id).length<c.remainingDamageCapacity(s,r,id)&&dfs([...xs,id]))return true;return false}dfs([]);
 }else if(p.kind==='RETREAT'){
  const ids=[...p.unitIds].sort();const cmp=(a,b)=>{if(a.length!==b.length)return b.length-a.length;for(let i=0;i<a.length;i++){const d=a[i].q-b[i].q||a[i].r-b[i].r;if(d)return d}return 0};
  const options=ids.map(id=>{const u=s.units[id];let paths=[[]],front=[[]];for(let k=0;k<p.retreatSteps;k++){const next=[];for(const path of front)for(const to of c.getLegalRetreatStepOptions(s,r,u,path.at(-1)||u.hex)){if([u.hex,...path].some(h=>c.hexKey(h)===c.hexKey(to)))continue;next.push([...path,to]);if(next.length>100000)throw Error('POLICY_SEARCH_CAP')}paths.push(...next);front=next}return paths.sort(cmp)});
  function joint(i,rs){if(i===ids.length)return accept({...base,type:'RETREAT',retreats:rs});for(const path of options[i])if(joint(i+1,[...rs,{unitId:ids[i],path}]))return true;return false}joint(0,[]);
 }else if(p.kind==='ADVANCE_AFTER_COMBAT'){
  const ids=[...new Set([...req.priority,...p.eligibleUnitIds.slice().sort()])];for(const unitId of ids)if(p.eligibleUnitIds.includes(unitId)&&accept({...base,type:'ADVANCE_AFTER_COMBAT',unitId}))break;
  if(!chosen)accept({...base,type:'PASS_ADVANCE'});
 }else {const type={DEFENDER_REACTION:'PASS_REACTION',BREAKTHROUGH_OPTION:'PASS_BREAKTHROUGH',SCHWERPUNKT_OPTION:'PASS_SCHWERPUNKT'}[p.kind];if(!type)throw Error('UNKNOWN_PENDING:'+p.kind);accept({...base,type});}
 if(!chosen)throw Error('NO_LEGAL_POLICY_CHOICE');out={action:chosen,candidatesExamined:visited,pending:p};
}else throw Error('UNKNOWN_QUERY');
console.log(JSON.stringify(out));
