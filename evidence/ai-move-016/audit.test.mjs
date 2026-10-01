import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {execFileSync} from 'node:child_process';
import {hash,atomic} from '../../ai/lab/common.mjs';
import {basicAgent,scoreIntent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {createMoveScorer,ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT,ROUTE_PATH_LIMIT} from '../../.ai-dist/ai/fair/routing.js';
import {observationCandidates,CANDIDATE_LIMIT} from '../../.ai-dist/ai/fair/candidates.js';
import {agentOrder} from '../../.ai-dist/ai/fair/minimalAgent.js';
import {host,G,RulesEngine,defaultRules,defaultScenario} from '../../ai/tests/helpers.mjs';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {validateMoveAction} from '../../.ai-dist/vendor/eastfront-digital-core/dist/rules/movement.js';
import {viewRoute} from './view-route.mjs';
const out='evidence/ai-move-016',base='69d1638d6c292346e27ddc3accce6bdb6e4064d4',strategy='a655892a1eed5f8a136b6c73b9d9000560df8d91';
const old='evidence/ai-midgame-015/',bytes=readFileSync(old+'checkpoints.json.gz'),index=JSON.parse(readFileSync(old+'checkpoint-index.json')),decisions=JSON.parse(readFileSync(old+'decisions.json'));
assert.equal(hash(bytes),index.archive.sha256);const cps=JSON.parse(gunzipSync(bytes)).checkpoints,cp=n=>cps.find(c=>c.n===n),d=n=>decisions.find(c=>c.n===n),x=cp(389).input;
for(const n of [373,381,383,389]){const c=cp(n),i=index.checkpoints.find(i=>i.n===n);assert.equal(hash(c.input),i.inputHash);assert.equal(hash(c.state),i.stateHash);}
const eq=(a,b)=>JSON.stringify(a)===JSON.stringify(b),route={type:'MOVE',unitId:'G-PZ-04',path:[{q:14,r:0},{q:15,r:0}]};
const result={task:'AI-MOVE-016',base,strategy,scope:'1017/E T6 frozen n389; n373/381 occupancy and n383 existing prefix positive control only',newGames:0,policyChanged:false,candidateRecovered:false,candidateSelected:false,checkpoints:[373,381,383,389].map(n=>({n,inputHash:hash(cp(n).input),stateHash:hash(cp(n).state),traceLine:n+1})),archive:{...index.archive,path:old+index.archive.file,commit:base}};
test('MOVE016 frozen 014 runtime and all strategy/authority/Core source trees are unchanged',()=>{
 const build=JSON.parse(readFileSync('evidence/ai-advance-014/build-identity.json'));for(const [file,sha] of build.experiment)assert.equal(hash(readFileSync('.ai-dist/'+file)),sha,file);
 const paths=['ai/fair','ai/authority','vendor','src/multiplayer/gameplayProtocol.ts'];
 const diff=execFileSync('git',['diff',strategy,'--',...paths],{encoding:'utf8'});assert.equal(diff,'');
 result.identity={node:process.version,verifiedRuntimeFiles:build.experiment.length,productionDiff:diff,sourcePaths:paths,sourceFiles:['ai/fair/routing.ts','ai/fair/candidates.ts','ai/fair/basicAgent.ts','ai/fair/advance.ts','ai/authority/FairHost.ts'].map(path=>({path,sha256:hash(readFileSync(path))}))};
});
test('MOVE016 earliest exclusion is origin adjacency before search, not cap, sorting or Host removal',()=>{
 const before=hash(x),baseCandidates=observationCandidates(x,false),hostCandidates=observationCandidates(x),scorer=createMoveScorer(x),own=baseCandidates.filter(a=>a.unitId===route.unitId);
 assert.equal(own.length,6);assert.equal(baseCandidates.length,59);assert(baseCandidates.length<CANDIDATE_LIMIT);assert.equal(hostCandidates.length,59);
 const stages=own.map(a=>({intent:a,score:String(scorer.score(a)),prefix:scorer.prefix(a),inHost:hostCandidates.some(b=>eq(a,b))}));assert(stages.every(s=>s.score==='-Infinity'&&eq(s.intent,s.prefix)&&s.inHost));
 assert.deepEqual(scorer.metrics,{expanded:0,searches:0,exhausted:false});assert(!hostCandidates.some(a=>eq(a,route)));assert.deepEqual(basicAgent(x),d(389).choice);assert.equal(basicAgent(x).intent.type,'READY_FOR_PHASE_END');
 const all=createMoveScorer(x),ranked=baseCandidates.map((a,i)=>({intent:a,score:a.type==='MOVE'?all.score(a):scoreIntent(x,a),tie:agentOrder(x.agentRandom.seed,i)})).filter(a=>Number.isFinite(a.score)).sort((a,b)=>b.score-a.score||a.tie-b.tie);
 assert.equal(ranked.length,1);assert.equal(hash(x),before);result.pipeline={baseCount:baseCandidates.length,hostCount:hostCandidates.length,candidateLimit:CANDIDATE_LIMIT,pz04:stages,unitSearchCost:scorer.metrics,wholeDecisionSearchCost:all.metrics,limits:{ROUTE_UNIT_LIMIT,ROUTE_DECISION_LIMIT,ROUTE_PATH_LIMIT},finiteRanking:ranked,choice:basicAgent(x),originalResult:d(389).result,routeInHost:false,earliestExclusion:'routing.ts:100 origin identified-enemy adjacency; prefix early-return at109; no plan search reached for PZ04',originalStageRejections:JSON.parse(readFileSync(old+'summary.json')).rejectedMoves};
});
test('MOVE016 fair DTO supports two-step proposal; Core acceptance stays separate offline evidence',()=>{
 const facts=viewRoute(x,route.unitId,route.path);assert(facts.proposalSupported);assert.equal(facts.spentMP,3);assert.equal(facts.maxMP,5);assert.deepEqual([facts.origin.knownZoc,...facts.steps.map(s=>s.knownZoc)],[true,false,true]);
 assert.deepEqual(facts.origin.adjacentEnemies,['S-TK-03']);assert(facts.steps.every(s=>createMoveScorer(x).safeDestination(route.unitId,s.hex)));
 const direct=viewRoute(x,route.unitId,[{q:15,r:0}]);assert(direct.issues.includes('KNOWN_ZOC_TO_ZOC'));
 const state=cp(389).state,before=hash(state),engine=new RulesEngine(defaultRules,defaultScenario),r=engine.apply(state,toCoreAction(route,G));assert(r.accepted);assert.equal(hash(state),before);assert.deepEqual(r.state.random,state.random);
 const validation=validateMoveAction(state,defaultRules,toCoreAction(route,G));assert.equal(validation.spentMP,facts.spentMP);assert.equal(validation.maxMP,facts.maxMP);
 result.fairRoute=facts;result.fairDirectStep=direct;result.offlineCore={intent:route,accepted:r.accepted,issues:r.issues,events:r.events,validation,randomUnchanged:true};
});
test('MOVE016 same intentional origin stop also applies to identified non-ZOC enemy',()=>{
 const input=structuredClone(x),enemy=structuredClone(input.view.units.find(u=>u.id==='S-TK-03'));Object.assign(enemy,{id:'test-visible-artillery',type:'ARTILLERY',stats:{attack:0,defense:1,movement:2}});input.view.units=input.view.units.filter(u=>u.side==='GERMAN');input.view.units.push(enemy);
 assert.equal(viewRoute(input,route.unitId,route.path).origin.knownZoc,false);const scorer=createMoveScorer(input),a={...route,path:route.path.slice(0,1)};assert.equal(scorer.score(a),-Infinity);assert.deepEqual(scorer.prefix(a),a);assert.equal(scorer.metrics.searches,0);
 result.nonZocFixture={knownOriginZoc:false,score:'-Infinity',metrics:scorer.metrics,meaning:'Identified adjacency policy is deliberately stronger than ordinary ZOC rules; no production mutation.'};
});
test('MOVE016 actual dynamic occupancy and already generated multistep option reproduce',()=>{
 result.dynamicOccupancy=[373,381].map(n=>{const input=cp(n).input,scorer=createMoveScorer(input),intent={type:'MOVE',unitId:'G-I-04',path:[{q:10,r:1}]};return {n,safeDestination:scorer.safeDestination(intent.unitId,intent.path[0]),friendlyOccupants:input.view.units.filter(u=>u.side==='GERMAN'&&u.hex.q===10&&u.hex.r===1).map(u=>u.id),coreIssues:validateMoveAction(cp(n).state,defaultRules,toCoreAction(intent,G)).issues,actualChoice:basicAgent(input)};});
 assert.equal(result.dynamicOccupancy[0].safeDestination,false);assert.equal(result.dynamicOccupancy[1].safeDestination,true);assert(result.dynamicOccupancy[0].coreIssues.some(i=>i.code==='STACKING_LIMIT'));assert.deepEqual(result.dynamicOccupancy[1].coreIssues,[]);assert.deepEqual(result.dynamicOccupancy[1].actualChoice,d(381).choice);
 const input=cp(383).input,scorer=createMoveScorer(input),intent={type:'MOVE',unitId:'G-I-08',path:[{q:11,r:5},{q:11,r:6}]},prefix=scorer.prefix({...intent,path:intent.path.slice(0,1)});assert.deepEqual(prefix,intent);assert(observationCandidates(input).some(a=>eq(a,intent)));assert.deepEqual(basicAgent(input),d(383).choice);assert(!eq(basicAgent(input).intent,intent));assert(scorer.metrics.expanded<=ROUTE_UNIT_LIMIT&&!scorer.metrics.exhausted);
 result.positivePrefix={n:383,intent,prefix,hostCandidate:true,selected:false,actualChoice:basicAgent(input),metrics:scorer.metrics,interpretation:'Original first-hop score/tie still decides; presence does not force selection.'};
});
test('MOVE016 hidden enemy/RNG edits produce equal fresh projections and identical decisions',()=>{
 const state=cp(389).state,other=structuredClone(state),a=host(state),seen=a.observe(G),hidden=Object.values(other.units).find(u=>u.alive&&u.side==='SOVIET'&&!seen.view.units.some(v=>v.id===u.id));assert(hidden);
 hidden.templateId='S-ARTY';hidden.type='ARTILLERY';other.random={seed:123,state:456,draws:77};const left=structuredClone(a.observe(G)),right=structuredClone(host(other).observe(G));assert.deepEqual(left,right);
 left.history=structuredClone(x.history);right.history=structuredClone(x.history);assert.deepEqual(observationCandidates(left),observationCandidates(right));assert.deepEqual(basicAgent(left),basicAgent(right));assert.deepEqual(viewRoute(left,route.unitId,route.path),viewRoute(right,route.unitId,route.path));
 result.hiddenIsolation={hiddenUnit: hidden.id,projectionHash:hash(left),equalProjections:true,equalCandidates:true,equalChoice:true,equalViewRoute:true,choice:basicAgent(left),limitation:'Paired fresh-host projections with original own history; not claimed byte-identical to historical Host memory/observationKey.'};
});
test('MOVE016 finalize conditional no-change evidence',()=>{
 assert(result.pipeline&&result.fairRoute&&result.identity&&result.hiddenIsolation);result.disposition={decision:'KEEP_EXISTING_POLICY',reason:'Explicit origin-adjacency stop is an existing tactical policy choice, not loss of a computed prefix. The permitted route does not establish that relaxing this choice improves play.',repair:null,newDevelopmentGames:0,conditionalGameGate:'false: no policy fix and no changed actual decision',unknown:['Strategic benefit or harm of withdrawing and re-entering ZOC','Whether any alternate policy would choose this route or improve later combat'],noFutureStateOrAuthorityInPolicy:true};atomic(out+'/audit.json',result);writeFileSync(out+'/minimal-diff.txt','Production strategy, Host, Core, RNG, rules, parameters and tie ordering: unchanged.\nNo repair patch: explicit tactical adjacency stop confirmed. Only offline evidence/tests added.\n');
});
