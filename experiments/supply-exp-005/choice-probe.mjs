// Authoritative test fixture helper only; never imported by server or player UI.
import fs from 'node:fs';import * as c from './core/dist/index.js';
const s=JSON.parse(fs.readFileSync(0,'utf8')),p=s.pendingDecision,e=new c.RulesEngine(c.defaultRules,c.defaultScenario),r=c.defaultRules,out=[];
const add=a=>{if(e.apply(s,a).accepted)out.push(a)},b=p&&{controllerId:p.decisionOwnerControllerId,battleId:p.battleId};
if(p?.kind==='LOSS_ALLOCATION'){function seq(a){if(a.length===p.lossSteps){add({...b,type:'ALLOCATE_LOSSES',unitIdsByStep:a});return}for(const id of p.eligibleUnitIds)if(a.filter(x=>x===id).length<c.remainingDamageCapacity(s,r,id))seq([...a,id])}seq([])}
if(p?.kind==='RETREAT'){let visited=0;const options=p.unitIds.map(id=>{const u=s.units[id];let paths=[[]],front=[[]];for(let k=0;k<p.retreatSteps;k++){let next=[];for(const path of front)for(const to of c.getLegalRetreatStepOptions(s,r,u,path.at(-1)||u.hex)){if([u.hex,...path].some(h=>c.hexKey(h)===c.hexKey(to)))continue;next.push([...path,to])}paths.push(...next);front=next}return paths.sort((a,b)=>b.length-a.length)});function joint(i,rs){if(++visited>20000||out.length>=8)return;if(i===p.unitIds.length){add({...b,type:'RETREAT',retreats:rs});return}for(const path of options[i])joint(i+1,[...rs,{unitId:p.unitIds[i],path}])}joint(0,[])}
if(p?.kind==='ADVANCE_AFTER_COMBAT'){for(const unitId of p.eligibleUnitIds)add({...b,type:'ADVANCE_AFTER_COMBAT',unitId});add({...b,type:'PASS_ADVANCE'})}
if(p?.kind==='BREAKTHROUGH_OPTION'){for(const unitId of p.eligibleUnitIds)for(const to of c.getNeighbors(s.units[unitId].hex))add({...b,type:'BREAKTHROUGH',unitId,path:[to]});add({...b,type:'PASS_BREAKTHROUGH'})}
if(p?.kind==='SCHWERPUNKT_OPTION'){for(const unitId of p.eligibleUnitIds)for(const target of c.getNeighbors(s.units[unitId].hex))add({type:'SCHWERPUNKT_ATTACK',controllerId:b.controllerId,sourceBattleId:b.battleId,unitId,target});add({...b,type:'PASS_SCHWERPUNKT'})}
if(p?.kind==='DEFENDER_REACTION')add({...b,type:'PASS_REACTION'});
console.log(JSON.stringify(out));
