// Read-only extraction/probes. Writes research outputs beside this script only.
// Run from any directory: node docs/rule-history-021/extract-audit.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {defaultRules as rules, defaultScenario as scenario, deriveSovietReinforcementSlots, createGameState, buildCombatContext, movementStepCost} from '../../vendor/eastfront-digital-core/dist/index.js';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
const baseline='813b4072568352e95d0726fe5fe04060c889c554';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(name,obj)=>fs.writeFileSync(path.join(out,name),typeof obj==='string'?obj:JSON.stringify(obj,null,2)+'\n');
const tracked=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/);
const governance=tracked.filter(p=>/(^|\/)(AGENTS|PROJECT_STATE|WORKER_PROTOCOL)\.md$/i.test(p));
const source='core/source/src/scenario/',experimental='experiments/supply-exp-005/core/src/scenario/';
const equal={rules:read(source+'defaultRules.ts')===read(experimental+'defaultRules.ts'),scenario:read(source+'defaultScenario.ts')===read(experimental+'defaultScenario.ts')};
assert.ok(equal.rules&&equal.scenario,'Baseline and supply experiment template/scenario diverged: review before reuse');
// Parse the small, declarative source templates independently to check the shipped JS.
const parsed={};
for(const m of read(source+'defaultRules.ts').matchAll(/'([^']+)': T\('[^']+','([^']+)','([^']+)',\[([\s\S]*?)\]\s*,?(\{[^\n]*?\})?\)/g)){
  const steps=[...m[4].matchAll(/attack:(\d+),defense:(\d+),movement:(\d+)/g)].map(v=>({attack:+v[1],defense:+v[2],movement:+v[3]}));
  parsed[m[1]]={side:m[2],type:m[3],steps};
}
assert.equal(Object.keys(parsed).length,Object.keys(rules.unitTemplates).length);
for(const [id,t] of Object.entries(rules.unitTemplates))assert.deepEqual(parsed[id],{side:t.side,type:t.type,steps:t.steps});
const initial=scenario.deployment.units;
const reinforcements=deriveSovietReinforcementSlots(scenario).map(s=>({...s,templateId:Object.values(rules.unitTemplates).find(t=>t.side==='SOVIET'&&t.type===s.type).id}));
const counts=side=>initial.filter(u=>u.side===side).length;
assert.equal(counts('GERMAN'),26);assert.equal(counts('SOVIET'),32);assert.equal(reinforcements.length,13);
const templates=Object.values(rules.unitTemplates).map(t=>({...t,initialIds:initial.filter(u=>u.templateId===t.id).map(u=>u.id),reinforcementIds:reinforcements.filter(u=>u.templateId===t.id).map(u=>u.id)}));
const unit=(id,templateId,hex,step=0)=>{const t=rules.unitTemplates[templateId];return{id,templateId,side:t.side,type:t.type,step,alive:true,hex,supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:t.side==='GERMAN'?'G-HUMAN-1':'S-AI-1',temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};};
function stateFor(units,terrain='PLAIN'){
  const hexes=[];for(let q=-2;q<=3;q++)for(let r=-2;r<=3;r++)hexes.push({coord:{q,r},terrain,control:null});
  const s=createGameState({rules,scenario,hexes,edges:[],units,seed:123});
  for(const u of Object.values(s.units))u.supplyState='SUPPLIED';
  return s;
}
const movement=[];
for(const id of ['G-INF','G-JAGER','G-MOT','G-PANZER','S-INF','S-MOT','S-TANK'])for(const terrain of ['PLAIN','FOREST','HILL','ROUGH','MARSH']){
  const u=unit('probe',id,{q:0,r:0}),s=stateFor([u],terrain),cost=movementStepCost(s,rules,u,u.hex,{q:1,r:0}).total;
  movement.push({id,terrain,movement:rules.unitTemplates[id].steps[0].movement,cost,uniformTerrainHexes:Math.floor(rules.unitTemplates[id].steps[0].movement/cost)});
}
const combat=[];
for(const defender of ['S-INF','S-ELITE'])for(const terrain of ['PLAIN','FOREST','HILL'])for(const attack of [['G-INF'],['G-JAGER'],['G-PANZER','G-INF'],['G-PANZER','G-JAGER'],['G-MOT']]){
  const attackers=attack.map((id,i)=>unit('A'+i,id,{q:i,r:-1}));
  const s=stateFor([...attackers,unit('D',defender,{q:0,r:0})],terrain);
  const c=buildCombatContext(s,rules,{type:'ATTACK',controllerId:'G-HUMAN-1',attackerUnitIds:attackers.map(u=>u.id),target:{q:0,r:0}});
  combat.push({attack,defender,terrain,context:c});
}
const files=[source+'defaultRules.ts',source+'defaultScenario.ts',experimental+'defaultRules.ts',experimental+'defaultScenario.ts','vendor/eastfront-digital-core/dist/scenario/defaultRules.js','vendor/eastfront-digital-core/dist/scenario/defaultScenario.js','core/source/src/rules/movement.ts','core/source/src/rules/combat.ts','core/source/src/rules/combatLoss.ts','core/source/src/rules/combatTransaction.ts','experiments/supply-exp-005/core/src/rules/unit.ts','experiments/supply-exp-005/core/src/rules/movement.ts','experiments/supply-exp-005/core/src/rules/combat.ts'];
const hashes=Object.fromEntries(files.map(p=>[p,createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
write('current-units.json',{baseline,scenarioId:scenario.id,turnLimit:scenario.turnLimit,board:scenario.board,calendarDate:null,daysPerTurn:null,kmPerHex:null,formalUnitEchelon:null,templates,initial,reinforcements});
write('audit.json',{baseline,governanceFilesFound:governance,equivalence:equal,sourceTemplatesMatchShippedJS:true,counts:{templates:templates.length,germanInitial:26,sovietInitial:32,sovietReinforcements:13,maximumCountersIncludingAllReinforcements:71},terrain:rules.terrain,river:rules.river,road:rules.road,crt:rules.crt,combatRules:rules.combat,movement,combat,sourceSHA256:hashes});
const fmt=step=>`${step.attack}/${step.defense}/${step.movement}`;
let md='# 当前完整单位表（自动提取）\n\n固定基线 `'+baseline+'`。三元组为攻击/防御/移动；step 0、1、2 是损伤档，非行军步数。旗标见下表。\n\n';
md+='|模板|类型|初始数|增援数|step 0|step 1|step 2|承受步损|ZOC|筑垒|装甲|步兵协同|支援|恢复成本/步|\n|---|---|---:|---:|---|---|---|---:|---|---|---|---|---|---:|\n';
for(const t of templates)md+=`|${t.id}|${t.type}|${t.initialIds.length}|${t.reinforcementIds.length}|${t.steps.map(fmt).join('|')}|${t.maxDamageSteps}|${t.exertsZoc}|${t.canEntrench}|${t.isArmor}|${t.infantryCoordination}|${t.isSupport}|${t.recoveryCostPerStep}|\n`;
md+='\n## 全部初始槽位\n\n|ID|阵营|模板|\n|---|---|---|\n';for(const u of initial)md+=`|${u.id}|${u.side}|${u.templateId}|\n`;
md+='\n## 全部增援槽位\n\n|ID|回合|模板|\n|---|---:|---|\n';for(const u of reinforcements)md+=`|${u.id}|${u.scheduledTurn}|${u.templateId}|\n`;
md+='\n总计：17种模板，德军26、苏军32个初始单位，苏军13个增援槽位，全部进入后71个单位；HQ模板存在但初始和增援均为0。\n';
write('CURRENT_UNITS.md',md);
console.log(JSON.stringify({templates:templates.length,initial:initial.length,reinforcements:reinforcements.length,equivalence:equal,combatProbes:combat.length,movementProbes:movement.length,outputs:['CURRENT_UNITS.md','current-units.json','audit.json']}));
