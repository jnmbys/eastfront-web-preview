// Reconstruct exactly two pre-decision checkpoints from recorded Actions. No games run.
// Temporary instrumentation copies are generated only in ignored .ai-dist.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {initial} from '../../ai/lab/match.mjs';
import {hash} from '../../ai/lab/common.mjs';
import {RulesEngine,defaultRules,defaultScenario} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {getNeighbors,hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {derivePlayerView,rememberPlayerView} from '../../.ai-dist/src/player-view/playerView.js';
import {fairView,publicRules} from '../../.ai-dist/ai/authority/projection.js';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {sha256} from '../../.ai-dist/ai/authority/sha256.js';
import {basicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
const out='evidence/ai-move-007',compiled='.ai-dist/ai/fair/';mkdirSync(out,{recursive:true});
const stable=v=>Array.isArray(v)?'['+v.map(stable).join(',')+']':v&&typeof v==='object'?'{'+Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>JSON.stringify(k)+':'+stable(x)).join(',')+'}':JSON.stringify(v);
let routing=readFileSync(compiled+'routing.js','utf8');
const start=routing.indexOf('    const score = (a) => {'),end=routing.indexOf('    const prefix = (a) => {');
assert(start>0&&end>start);
let region=routing.slice(start,end),i=0;
const reasons=['not-single-hop-or-rejected-edge','eligibility-or-rejected-unit','identified-enemy-adjacency','edge-cost-exceeds-budget','unsafe-or-no-descending-route'];
region=region.replaceAll('return -Infinity;',()=>`return reject(a, '${reasons[i++]}');`);assert.equal(i,reasons.length);
routing=routing.slice(0,start)+region+routing.slice(end);
routing+='\nexport const diagnostics={scoreCalls:[],candidates:null};\nfunction reject(a,reason){diagnostics.scoreCalls.push({intent:a,reason});return -Infinity;}\n';
writeFileSync(compiled+'move007-routing.js',routing);
let candidates=readFileSync(compiled+'candidates.js','utf8').replace("from './routing.js'","from './move007-routing.js'");
candidates="import {diagnostics} from './move007-routing.js';\n"+candidates;
const marker='const base = unique(actions).slice(0, CANDIDATE_LIMIT);';assert(candidates.includes(marker));
candidates=candidates.replace(marker,marker+'\n diagnostics.candidates={branch:view.phase,rawActions:actions,base};');
writeFileSync(compiled+'move007-candidates.js',candidates);
writeFileSync(compiled+'move007-basicAgent.js',readFileSync(compiled+'basicAgent.js','utf8').replace("from './routing.js'","from './move007-routing.js'").replace("from './candidates.js'","from './move007-candidates.js'"));
const {basicAgent:instrumented}=await import('../../.ai-dist/ai/fair/move007-basicAgent.js');
const {diagnostics}=await import('../../.ai-dist/ai/fair/move007-routing.js');
for(const [seed,turn] of [[17,5],[18,4]]){
 const id=`tune-${seed}-GERMAN`,dir=`evidence/ai-move-006/batch/${id}`,record=JSON.parse(readFileSync(dir+'/record.json'));
 const rows=readFileSync(dir+'/trace.ndjson','utf8').trim().split('\n').map(JSON.parse);assert.equal(hash(rows),record.traceHash);
 const target=rows.find(r=>r.turn===turn&&r.side==='GERMAN'&&r.phase==='GERMAN_MOVEMENT');assert(target);
 let state=initial(seed);const engine=new RulesEngine(defaultRules,defaultScenario),knowledge={};
 for(const side of ['GERMAN','SOVIET'])knowledge[side]=rememberPlayerView(derivePlayerView(state,side,defaultRules));
 const history=[];
 for(const row of rows.slice(0,target.n)){
  const before=state,r=engine.apply(state,toCoreAction(row.choice.intent,row.controllerId));assert.equal(r.accepted,row.result.status==='ACCEPTED');
  if(r.accepted){state=r.state;for(const side of ['GERMAN','SOVIET']){const prior=rememberPlayerView(derivePlayerView(before,side,defaultRules,knowledge[side]));knowledge[side]=rememberPlayerView(derivePlayerView(state,side,defaultRules,prior));}}
  if(row.side==='GERMAN')history.push({observationKey:row.observationKey,intent:row.choice.intent,outcome:r.accepted?'ACCEPTED':'REJECTED'});
 }
 const view=fairView(derivePlayerView(state,'GERMAN',defaultRules,knowledge.GERMAN),'GERMAN'),rules=publicRules(defaultRules,defaultScenario);
 const observationKey=sha256(stable({view,rules,deployment:null,reinforcements:null}));assert.equal(observationKey,target.observationKey);
 const input={schema:'fair-player-view-v1',observationKey,scope:{matchId:id,controllerId:'G-HUMAN-1',side:'GERMAN'},view,rules,deployment:null,reinforcements:null,history:history.slice(-16),agentRandom:{seed:101,decisionIndex:history.length}};
 assert.deepEqual(basicAgent(input),target.choice);
 diagnostics.scoreCalls=[];diagnostics.candidates=null;
 assert.deepEqual(instrumented(input),target.choice);
 const dist=u=>Math.min(...rules.objectives.map(g=>hexDistance(u.hex,g)));
 const own=view.units.filter(u=>u.side==='GERMAN'),nearest=Math.min(...own.map(dist)),front=own.filter(u=>dist(u)===nearest);
 const report={seed,turn,n:target.n,line:target.n+1,observationKey,source:'f4c9b9732f3725fb067d4b29a6cff12e66eb3e53',replayedActions:target.n,recordedChoice:target.choice,choiceMatches:true,nearest,
  branch:diagnostics.candidates.branch,rawCandidateCount:diagnostics.candidates.rawActions.length,boundedCandidateCount:diagnostics.candidates.base.length,
  visibleEnemies:view.units.filter(u=>u.side!=='GERMAN'),contacts:view.contacts,lastKnown:view.lastKnown,
  front:front.map(u=>({unit:u,baseMP:Math.max(0,u.stats.movement-(u.supplyState==='OUT_OF_SUPPLY'?rules.oosMovementPenalty:0)),adjacentVisibleEnemies:view.units.filter(e=>e.side!=='GERMAN'&&hexDistance(u.hex,e.hex)<=1).map(e=>e.id),
   beforeCap:diagnostics.candidates.rawActions.filter(a=>a.unitId===u.id),afterCap:diagnostics.candidates.base.filter(a=>a.unitId===u.id),actualScoreBranches:diagnostics.scoreCalls.filter(x=>x.intent.unitId===u.id),
   offlineCoreNeighbors:getNeighbors(u.hex).map(hex=>{const a={type:'MOVE',controllerId:'G-HUMAN-1',unitId:u.id,path:[hex]},v=validateMoveAction(state,defaultRules,a);return {path:a.path,issues:v.issues,spentMP:v.spentMP,maxMP:v.maxMP};})})),stateHash:hash(state)};
 writeFileSync(out+`/seed-${seed}-before.json`,JSON.stringify(report,null,2)+'\n');
 writeFileSync(out+`/seed-${seed}-input.json.gz`,gzipSync(JSON.stringify(input)));
 // Authority checkpoint stays outside Git; only offline validation may read it.
 writeFileSync(`.ai-dist/move007-state-${seed}.json`,JSON.stringify(state));
 console.log(JSON.stringify({seed,turn,n:target.n,choice:target.choice,front:report.front.map(f=>({id:f.unit.id,hex:f.unit.hex,hasMoved:f.unit.friendly.hasMoved,mp:f.baseMP,candidates:f.afterCap.length,reasons:[...new Set(f.actualScoreBranches.map(x=>x.reason))],coreAcceptedNeighbors:f.offlineCoreNeighbors.filter(x=>!x.issues.length).map(x=>x.path)}))}));
}
