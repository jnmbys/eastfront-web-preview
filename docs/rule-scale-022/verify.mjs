// Offline research only. Imports shipped Core; patches ONLY in-memory clones.
// node docs/rule-scale-022/verify.mjs --check (default writes research outputs)
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {defaultRules,defaultScenario,deriveSovietReinforcementSlots,createGameState,buildCombatContext,movementStepCost} from '../../vendor/eastfront-digital-core/dist/index.js';
import {selectCRTColumn,shiftedCRTColumn,resolveCRTResult,parseCRTResult} from '../../vendor/eastfront-digital-core/dist/rules/crt.js';
import {applyLossSequence,analyzeLossRequirement,remainingDamageCapacity} from '../../vendor/eastfront-digital-core/dist/rules/combatLoss.js';
import {applyRecoveryAction} from '../../vendor/eastfront-digital-core/dist/rules/recovery.js';
const out=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(out,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const spec=JSON.parse(read('docs/rule-scale-022/candidate.json'));
const current=structuredClone(defaultRules),fine=structuredClone(defaultRules),double=structuredClone(defaultRules);
assert.equal(Object.keys(spec.templates).length,17);
assert.deepEqual(Object.keys(spec.templates).sort(),Object.keys(current.unitTemplates).sort());
for(const [id,curve] of Object.entries(spec.templates)){
  const t=fine.unitTemplates[id];t.maxDamageSteps=curve.length;
  t.steps=curve.map(([attack,defense,movement])=>({attack,defense,movement}));
  while(t.steps.length<3)t.steps.push({attack:0,defense:0,movement:0}); // unreachable dead-state padding; not deployable TS config
  for(const s of double.unitTemplates[id].steps){s.attack*=2;s.defense*=2;}
}
fine.unitTemplates['S-CAV-L']={...structuredClone(fine.unitTemplates['S-INF']),id:'S-CAV-L',type:'CAVALRY',maxDamageSteps:2,...spec.cavalry.flags,steps:[...spec.cavalry.steps.map(([attack,defense,movement])=>({attack,defense,movement})),{attack:0,defense:0,movement:0}]};
const coarse=structuredClone(fine);
for(const t of Object.values(coarse.unitTemplates))for(const s of t.steps){s.attack=Math.round(s.attack/2);s.defense=Math.round(s.defense/2);}
const profiles={current,double,coarse,fine};
const initial=defaultScenario.deployment.units;
const slots=deriveSovietReinforcementSlots(defaultScenario).map(s=>({...s,templateId:Object.values(current.unitTemplates).find(t=>t.side==='SOVIET'&&t.type===s.type).id,side:'SOVIET'}));
assert.equal(initial.length,58);assert.equal(slots.length,13);
assert.equal(initial.filter(u=>spec.cavalry.replaceInitialIds.includes(u.id)).length,2);
assert.ok(initial.filter(u=>spec.cavalry.replaceInitialIds.includes(u.id)).every(u=>u.templateId==='S-INF'));
const inventory=[];
for(const profile of ['current','double','fine'])for(const stage of ['initial','all'])for(const side of ['GERMAN','SOVIET']){
  const us=(stage==='initial'?initial:[...initial,...slots]).filter(u=>u.side===side),r=profiles[profile];
  let a=0,d=0,capacity=0,b=0;for(const u of us){const id=profile==='fine'&&spec.cavalry.replaceInitialIds.includes(u.id)?'S-CAV-L':u.templateId,t=r.unitTemplates[id];a+=t.steps[0].attack;d+=t.steps[0].defense;capacity+=t.maxDamageSteps;b+=['PANZER','TANK','HEAVY_TANK','MOTORIZED'].includes(t.type)?8:4;}
  inventory.push({profile,stage,side,counters:us.length,nominalAttackSum:a,nominalDefenseSum:d,fullDamageCapacity:capacity,maintenanceSP:b/4});
}
const coord=[{q:0,r:-1},{q:1,r:-1},{q:1,r:0},{q:0,r:1}];
function unit(rules,id,tid,hex,step=0){const t=rules.unitTemplates[tid];assert.ok(step<t.maxDamageSteps);return {id,templateId:tid,side:t.side,type:t.type,step,alive:true,hex,supplyState:'SUPPLIED',entrenched:false,hasMoved:false,hasAttacked:false,controllerId:t.side==='GERMAN'?'G-HUMAN-1':'S-AI-1',temporarySupply:false,dedicatedRailRepair:false,reconZocIgnoreUsed:false,artillerySupportUsed:false,lastHQCommandTurn:null};}
function state(rules,units,terrain='PLAIN'){
  const hexes=[];for(let q=-3;q<=3;q++)for(let r=-3;r<=3;r++)hexes.push({coord:{q,r},terrain,control:null});
  const s=createGameState({rules,scenario:defaultScenario,hexes,edges:[],units,seed:123});
  for(const u of Object.values(s.units))u.supplyState='SUPPLIED';return s;
}
const asPair=x=>Array.isArray(x)?x:[x,0];
function combat(rules,attackers,defenders,terrain='PLAIN',options={}){
  const aa=attackers.map((x,i)=>{const [t,step]=asPair(x);return unit(rules,'A'+i,t,coord[i],step);});
  const dd=defenders.map((x,i)=>{const [t,step]=asPair(x);return unit(rules,'D'+i,t,{q:0,r:0},step);});
  assert.ok(aa.every(u=>u.side===aa[0].side)&&dd.every(u=>u.side!==aa[0].side));
  const s=state(rules,[...aa,...dd],terrain);
  for(const a of aa)if(options.oos)s.units[a.id].supplyState='OUT_OF_SUPPLY';
  if(options.surroundedOOS){
    for(const d of dd)s.units[d.id].supplyState='OUT_OF_SUPPLY';
    const ring=[...coord,{q:-1,r:1},{q:-1,r:0}];
    for(const [i,h] of ring.entries())if(!aa.some(a=>a.hex.q===h.q&&a.hex.r===h.r))s.units['B'+i]=unit(rules,'B'+i,aa[0].templateId,h);
  }
  if(options.entrenched)for(const d of dd)s.units[d.id].entrenched=true;
  const c=buildCombatContext(s,rules,{type:'ATTACK',controllerId:aa[0].controllerId,attackerUnitIds:aa.map(u=>u.id),target:{q:0,r:0}});
  assert.equal(c.baseCRTColumn,selectCRTColumn(c.attackStrength,c.defenseStrength,rules));
  assert.equal(c.finalCRTColumn,shiftedCRTColumn(c.baseCRTColumn,c.modifiers.rawShift,rules));
  if(options.surroundedOOS)assert.equal(c.oosSurroundedDefenseHalved,true);
  return {attack:c.attackStrength,defense:c.defenseStrength,ratio:c.attackStrength/c.defenseStrength,base:c.baseOdds,baseColumn:c.baseCRTColumn,modifiers:c.modifiers,final:c.finalCRTColumnLabel,finalColumn:c.finalCRTColumn};
}
const cases=[];
const add=(label,a,d,t='PLAIN',opt={})=>{const results={};for(const [p,r] of Object.entries(profiles))if([...a,...d].every(x=>{const[id,s]=asPair(x);return r.unitTemplates[id]&&s<r.unitTemplates[id].maxDamageSteps;}))results[p]=combat(r,a,d,t,opt);cases.push({label,attackers:a,defenders:d,terrain:t,options:opt,results});};
for(const t of ['PLAIN','FOREST','HILL']){
  for(const g of ['G-INF','G-JAGER']){add(`${g} → S-INF / ${t}`,[g],['S-INF'],t);add(`S-INF → ${g} / ${t}`,['S-INF'],[g],t);}
  add(`S-CAV-L → G-INF / ${t}`,['S-CAV-L'],['G-INF'],t);
  add(`G-INF → S-CAV-L / ${t}`,['G-INF'],['S-CAV-L'],t);
  add(`G-INF ×2 → S-INF / ${t}`,['G-INF','G-INF'],['S-INF'],t);
  add(`G-PANZER + G-INF → S-INF / ${t}`,['G-PANZER','G-INF'],['S-INF'],t);
  add(`G-PANZER + G-JAGER → S-INF / ${t}`,['G-PANZER','G-JAGER'],['S-INF'],t);
}
for(const d of [['S-AT'],['S-INF','S-AT'],['S-INF'],['S-HEAVY'],['S-TANK']])for(const a of [['G-PANZER'],['G-PANZER','G-INF']])add(`${a.join(' + ')} → ${d.join(' + ')}`,a,d);
add('S-TANK → G-INF',['S-TANK'],['G-INF']);add('S-HEAVY → G-INF',['S-HEAVY'],['G-INF']);
for(const step of [1,2]){
  for(const g of ['G-INF','G-JAGER']){add(`${g} damaged ${step} → full S-INF`,[[g,step]],['S-INF']);add(`full ${g} → damaged S-INF ${step}`,[g],[['S-INF',step]]);}
  add(`G-PANZER damaged ${step} → S-INF`,[['G-PANZER',step]],['S-INF']);
}
add('S-TANK damaged 1 → G-INF',[['S-TANK',1]],['G-INF']);
add('S-CAV-L damaged 1 → G-INF',[['S-CAV-L',1]],['G-INF']);
add('S-INF ×2 OOS → G-INF',['S-INF','S-INF'],['G-INF'],'PLAIN',{oos:true});
add('G-INF OOS → S-ELITE',['G-INF'],['S-ELITE'],'PLAIN',{oos:true});
add('token damaged JAGER + PANZER → forest S-INF',[['G-JAGER',2],'G-PANZER'],['S-INF'],'FOREST');
add('armor → entrenched forest INF+AT cap',['G-PANZER'],['S-INF','S-AT'],'FOREST',{entrenched:true});
add('G-INF → surrounded OOS S-INF',['G-INF'],['S-INF'],'PLAIN',{surroundedOOS:true});
add('G-INF → surrounded OOS INF+AT',['G-INF'],['S-INF','S-AT'],'PLAIN',{surroundedOOS:true});
add('G-INF → surrounded OOS INF×2',['G-INF'],['S-INF','S-INF'],'PLAIN',{surroundedOOS:true});
// All baseline cross-side live state ratios: uniform doubling is neutral absent rounding.
let scaleNeutral=0;for(const a of Object.values(current.unitTemplates))for(const d of Object.values(current.unitTemplates))if(a.side!==d.side)for(let ai=0;ai<a.maxDamageSteps;ai++)for(let di=0;di<d.maxDamageSteps;di++){
  const x=a.steps[ai],y=d.steps[di];assert.equal(selectCRTColumn(x.attack,y.defense,current),selectCRTColumn(x.attack*2,y.defense*2,double));scaleNeutral++;
}
// Exact engine threshold boundaries, not rounded displayed ratios.
const boundaries=current.crt.thresholds.map(t=>({threshold:t,below:selectCRTColumn(t-1e-9,1,current),at:selectCRTColumn(t,1,current),above:selectCRTColumn(t+1e-9,1,current)}));
for(const [i,b] of boundaries.entries()){assert.equal(b.at,i);assert.equal(b.below,Math.max(0,i-1));assert.equal(b.above,i);}
const rounding=[];for(const t of Object.values(fine.unitTemplates))for(let step=0;step<t.maxDamageSteps;step++)for(const f of [.5,.625,.75,.875,1]){
  const a=t.steps[step].attack;rounding.push({id:t.id,step,factor:f,exact:a*f,ceil:Math.ceil(a*f),error:Math.ceil(a*f)-a*f});
}
const movement=[];for(const rname of ['current','fine'])for(const tid of ['G-INF','G-JAGER','G-PANZER','G-MOT','S-INF','S-TANK','S-HEAVY','S-CAV-L'])if(profiles[rname].unitTemplates[tid])for(const terrain of ['PLAIN','FOREST','HILL','ROUGH','MARSH']){
  const r=profiles[rname],u=unit(r,'M',tid,{q:0,r:0}),s=state(r,[u],terrain),cost=movementStepCost(s,r,u,u.hex,{q:1,r:0}).total,mp=r.unitTemplates[tid].steps[0].movement;
  movement.push({profile:rname,id:tid,terrain,mp,cost,unopposedUniformHexes:Math.floor(mp/cost)});
}
const durability=[];
for(const [id,t] of Object.entries(fine.unitTemplates)){
  const s=state(fine,[unit(fine,'U',id,{q:0,r:0})]);
  for(let n=0;n<t.maxDamageSteps;n++){assert.equal(remainingDamageCapacity(s,fine,'U'),t.maxDamageSteps-n);applyLossSequence(s,fine,'probe',t.side,['U'],'offline',true);if(n<t.maxDamageSteps-1)assert.equal(s.units.U.step,n+1);}
  assert.equal(s.units.U.alive,false);assert.equal(remainingDamageCapacity(s,fine,'U'),0);
  let recovery=null;if(t.maxDamageSteps>1){const rs=state(fine,[unit(fine,'R',id,{q:0,r:0},1)]),rp=rs.rp[t.side];applyRecoveryAction(rs,fine,{type:'REPAIR_UNIT',unitId:'R',controllerId:rs.units.R.controllerId});assert.equal(rs.units.R.step,0);assert.equal(rp-rs.rp[t.side],t.recoveryCostPerStep);recovery={deltaAttack:t.steps[0].attack-t.steps[1].attack,deltaDefense:t.steps[0].defense-t.steps[1].defense,rp:t.recoveryCostPerStep};}
  durability.push({id,lossesToDestroy:t.maxDamageSteps,recovery});
}
const fairState=state(fine,[unit(fine,'I','S-INF',{q:0,r:0}),unit(fine,'T','S-TANK',{q:0,r:0})]);
const fairness=analyzeLossRequirement(fairState,fine,{side:'SOVIET',eligibleUnitIds:['I','T'],steps:4});assert.deepEqual(fairness.uniqueSequence,['I','T','I','T']);
applyLossSequence(fairState,fine,'probe','SOVIET',fairness.uniqueSequence,'offline',true);assert.equal(fairState.units.I.step,2);assert.equal(fairState.units.T.alive,false);
const crtDistribution=current.crt.columns.map((label,col)=>{let a=0,d=0,dr=0;for(let roll=2;roll<=12;roll++){const weight=6-Math.abs(7-roll),r=parseCRTResult(resolveCRTResult(roll,col,current));a+=weight*r.attackerLossSteps;d+=weight*r.defenderLossSteps;if(r.defenderRetreatSteps)dr+=weight;}return {label,expectedAttackerLossSteps:a/36,expectedDefenderLossSteps:d/36,defenderRetreatProbability:dr/36};});
const paths=['core/source/src/core/types.ts','core/source/src/scenario/defaultRules.ts','core/source/src/scenario/defaultScenario.ts','core/source/src/rules/crt.ts','core/source/src/rules/combat.ts','core/source/src/rules/movement.ts','core/source/src/rules/combatLoss.ts','core/source/src/rules/recovery.ts','core/source/src/rules/combatTransaction.ts','experiments/supply-exp-005/core/src/rules/unit.ts','experiments/supply-exp-005/core/src/rules/combat.ts','experiments/supply-exp-005/legalmap.py','experiments/supply-exp-005/live.py','experiments/supply-exp-005/model.py','ai/fair/minimalAgent.ts','ai/fair/candidates.ts','core/source/reference/legacy-v6-operational-graph-simulator.py'];
const hashes=Object.fromEntries(paths.map(p=>[p,createHash('sha256').update(read(p)).digest('hex')]));
for(const p of paths)assert.equal(execFileSync('git',['show',`${spec.baseline}:${p}`],{cwd:root,encoding:'utf8'}).replaceAll('\r\n','\n'),read(p).replaceAll('\r\n','\n'),'Runtime changed: '+p);
const report={baseline:spec.baseline,design:spec.id,scope:'static contexts and direct loss/recovery primitives; no games; no candidate TS build; experimental supply rounding formula audited, not rebuilt',counts:{templates:17,cavalryExtension:1,cases:cases.length,scaleNeutral,rounding:rounding.length,movement:movement.length,durability:durability.length},inventory,cases,boundaries,rounding,movement,durability,fairness,crtDistribution,sourceSHA256:hashes};
let md='# 离线算例（自动生成）\n\n`A:D；基础列→最终列`。current=现行；double=仅攻防乘2；coarse=推荐攻防除2四舍五入；fine=推荐。空白表示基线没有骑兵。损伤、移动、补给规则不会一起乘倍数。\n\n|算例|current|double|coarse|fine|\n|---|---|---|---|---|\n';
const fmt=x=>x?`${x.attack}:${x.defense}；${x.base}→${x.final}`:'—';for(const c of cases)md+=`|${c.label}|${['current','double','coarse','fine'].map(p=>fmt(c.results[p])).join('|')}|\n`;
md+='\n## 每列2D6分布（未经战损容量截断）\n\n|列|攻击方期望步损|防御方期望步损|防御方退却概率|\n|---|---:|---:|---:|\n';for(const c of crtDistribution)md+=`|${c.label}|${c.expectedAttackerLossSteps.toFixed(3)}|${c.expectedDefenderLossSteps.toFixed(3)}|${c.defenderRetreatProbability.toFixed(3)}|\n`;
for(const [name,value] of [['validation.json',JSON.stringify(report,null,2)+'\n'],['CASES.md',md]]){
  const p=path.join(out,name);if(process.argv.includes('--check'))assert.equal(fs.readFileSync(p,'utf8'),value,`Stale output ${name}`);else fs.writeFileSync(p,value);
}
console.log(JSON.stringify({ok:true,...report.counts,mode:process.argv.includes('--check')?'check':'write'}));
