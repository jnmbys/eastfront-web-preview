// Derive compact audit evidence solely from saved replays; never run a match.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const p='evidence/ai-advance-audit-013/';
const json=f=>JSON.parse(readFileSync(p+f,'utf8'));
const save=(f,x)=>writeFileSync(p+f,JSON.stringify(x,null,2)+'\n');
const traces=Object.fromEntries(['baseline','candidate'].map(v=>[v,readFileSync('evidence/ai-eval-012/batch/holdout-1017-'+v+'-GERMAN/trace.ndjson','utf8').trim().split('\n').map(JSON.parse)]));
const timeline=Object.fromEntries(['baseline','candidate'].map(v=>[v,readFileSync(p+v+'-timeline.ndjson','utf8').trim().split('\n').map(JSON.parse)]));
const sum=json('timeline-summary.json');
// Repair the initially empty battle extraction without another replay.
sum.battles=Object.fromEntries(Object.entries(timeline).map(([v,rows])=>[v,rows.flatMap(r=>r.events.filter(e=>e.type==='CRTResolved').map(e=>({n:r.n,turn:r.turn,phase:r.phase,event:e,dice:r.events.find(d=>d.type==='DiceRolled'&&d.battleId===e.battleId),randomBefore:r.randomBefore,randomAfter:r.randomAfter})))]));
save('timeline-summary.json',sum);
const first=traces.baseline.findIndex((r,i)=>JSON.stringify(r.choice)!==JSON.stringify(traces.candidate[i]?.choice));
assert.equal(first,156);assert.equal(traces.baseline[first].observationKey,traces.candidate[first].observationKey);
const front=f=>({distance:f.nearest,leaders:f.leaders.map(u=>({id:u.id,hex:u.hex}))});
const phase=r=>({turn:r.turn,phase:r.phase,baseline:{n:r.baseline.n,...front(r.baseline.front)},candidate:{n:r.candidate.n,...front(r.candidate.front)},delta:r.delta});
assert.equal(sum.firstLag.turn,3);assert.equal(sum.firstLag.phase,'GERMAN_MOVEMENT');
assert.deepEqual(sum.firstLag,sum.firstSustainedLag);
const n199=json('nodes/candidate-n199-check.json'),n219=json('nodes/candidate-n219-check.json');
for(const node of [n199,n219]){const u=node.focusedUnits.find(u=>u.unit.id==='G-MOT-03');assert.equal(u.unit.friendly.hasMoved,false);assert.equal(u.baseMP,4);assert.equal(u.neighbors.length,6);assert(u.neighbors.every(n=>n.hostCandidate&&n.offlineCore.issues.length>0&&n.policyScore==='-Infinity'));}
const rejected=Object.fromEntries(Object.entries(timeline).map(([v,rows])=>[v,rows.filter(r=>r.turn===3&&r.status==='REJECTED').map(r=>({n:r.n,choice:r.choice,issues:r.issues}))]));
assert.equal(rejected.candidate.length,0);
const final=Object.fromEntries(Object.entries(sum.final).map(([v,f])=>[v,front(f)]));assert.equal(final.baseline.distance,10);assert.equal(final.candidate.distance,13);
const leaders=sum.phases.filter(r=>r.phase==='SOVIET_COMBAT').map(phase);
const focus=['G-MOT-03','G-PZ-04','G-REC-02'];
const actions=Object.fromEntries(Object.entries(timeline).map(([v,rows])=>[v,rows.filter(r=>r.turn>=2&&r.turn<=3&&(r.changedGerman.some(c=>focus.includes(c.after.id))||r.choice.attackerUnitIds?.some(id=>focus.includes(id))||r.choice.unitId&&focus.includes(r.choice.unitId))).map(r=>({n:r.n,turn:r.turn,phase:r.phase,choice:r.choice,status:r.status,issues:r.issues,changedGerman:r.changedGerman.filter(c=>focus.includes(c.after.id)),events:r.events}))]));
const integrity=json('integrity.json');assert.equal(integrity.results.length,8);assert.equal(integrity.affectedStatisticalSamples.length,0);
assert.equal(timeline.baseline.find(r=>r.turn===3&&r.phase==='GERMAN_MOVEMENT'&&r.frontAfter.nearest===16).n,198);
assert(timeline.candidate.filter(r=>r.turn===3&&r.phase==='GERMAN_MOVEMENT').every(r=>r.frontAfter.nearest===17));
save('summary.json',{task:'AI-ADVANCE-AUDIT-013',sourceCommit:integrity.base,auditOnly:true,newGames:0,policyChanged:false,integrity:{samples:8,affectedStatisticalSamples:[],details:'integrity.json'},firstDecisionDifference:{n:first,line:first+1,turn:2,phase:'GERMAN_COMBAT',observationKey:traces.baseline[first].observationKey,baseline:traces.baseline[first].choice,candidate:traces.candidate[first].choice},distanceDefinition:'Minimum axial hex distance of any alive German unit to either scenario capital core hex; all tied units retained. Phase-end alignment, not decision-index alignment.',firstPhaseEndLag:phase(sum.firstLag),firstSustainedPhaseEndLag:phase(sum.firstSustainedLag),final,turnEndLeaders:leaders,t3ActualRejections:rejected,focusedActions:actions,battles:sum.battles,limits:['No counterfactual rerun or new match.','Same initial seed does not align later battle dice: candidate extra T2 Soviet combat consumes draws 2..4.','Terminal three-hex difference cannot be apportioned quantitatively among advance, later policies, and combat outcomes.','Offline neighboring MOVE rejection reasons are validation results, not additional submitted actions or actual rejection counts.']});
console.log('PASS: 8 intact samples; first choice divergence n156; first sustained phase-end lag T3 GERMAN_MOVEMENT; 12 frozen MOT neighbor checks; no actual candidate T3 rejections; final 10 vs 13.');
const format=f=>f.leaders.map(u=>`${u.id}@(${u.hex.q},${u.hex.r})`).join('、')+' / '+f.distance;
let md='# 逐回合最近单位（保留全部并列）\n\n按苏军战斗阶段完成后的快照；T16 为自然终局。数值为到任一首都核心格的最小轴坐标六角距离。不能视为单个单位连续轨迹。\n\n| 回合 | 基线：单位@位置 / 距离 | 候选：单位@位置 / 距离 | 差值 C−B |\n|---|---|---|---|\n';
for(const r of leaders)md+=`| T${r.turn} | ${format(r.baseline)} | ${format(r.candidate)} | ${r.delta} |\n`;
md+=`| T16终局 | ${format(final.baseline)} | ${format(final.candidate)} | 3 |\n`;
writeFileSync(p+'turn-leaders.md',md);
