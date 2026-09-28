// Trusted offline evaluation only. Never imported by the policy or browser Worker.
import {mkdirSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import {host,production,RulesEngine,defaultRules,defaultScenario} from './helpers.mjs';
import {toCoreAction} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {hexDistance,hexKey} from '../../.ai-dist/vendor/eastfront-digital-core/dist/core/hex.js';
const [label='ai005',seedText='17',policyPath='.ai-dist/ai/fair/index.js']=process.argv.slice(2),seed=Number(seedText);
const {basicAgent}=await import(pathToFileURL(resolve(policyPath)).href);
const initial=production();initial.random={...initial.random,seed,state:seed};
const h=host(initial,'ai005-comparison'),engine=new RulesEngine(defaultRules,defaultScenario);
const first={GERMAN:{contact:null,identified:null,adjacent:null,attack:null},SOVIET:{contact:null,identified:null,adjacent:null,attack:null}};
const lastMove=new Map(),visited=new Map(),seenRejected=new Set(),steps=[],timings=[];
let latestInput,latestDecision,reversals=0,revisits=0,repeatedRejections=0;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const agent=input=>{
 latestInput=input;const start=performance.now();latestDecision=basicAgent(input);timings.push(performance.now()-start);
 return latestDecision;
};
for(let n=0;n<2000;n++){
 const state=h.auditOmniscient(),result=h.step({GERMAN:agent,SOVIET:agent}),x=latestInput,intent=latestDecision?.intent;
 const side=x.scope.side,enemy=x.view.units.filter(u=>u.side!==side),own=x.view.units.filter(u=>u.side===side);
 const mark={turn:state.turn,phase:state.phase,decision:n};
 if(!x.deployment){
  if(first[side].contact===null&&(enemy.length||x.view.contacts.length))first[side].contact=mark;
  if(first[side].identified===null&&enemy.length)first[side].identified=mark;
  if(first[side].adjacent===null&&own.some(u=>enemy.some(e=>hexDistance(u.hex,e.hex)===1)))first[side].adjacent=mark;
 }
 const entry={n,turn:state.turn,phase:state.phase,pending:state.pendingDecision?.kind??null,side,intent,result};
 const accepted=['ACCEPTED','GAME_OVER'].includes(result.status);
 if(accepted&&intent?.type==='ATTACK'&&first[side].attack===null)first[side].attack=mark;
 if(accepted&&intent?.type==='MOVE'){
  const u=state.units[intent.unitId],from=hexKey(u.hex),to=hexKey(intent.path.at(-1));
  const previous=lastMove.get(u.id),reverse=previous?.from===to&&previous?.to===from;
  const cells=visited.get(u.id)??new Set([from]);const revisit=cells.has(to);cells.add(to);visited.set(u.id,cells);
  if(reverse)reversals++;if(revisit)revisits++;
  entry.movement={from,to,reverse,revisit,goal:enemy.length?enemy.map(e=>hexKey(e.hex)).sort():x.rules.objectives.map(hexKey).sort()};lastMove.set(u.id,{from,to});
 }
 if(result.status==='REJECTED'){
  const repeatKey=JSON.stringify([state.turn,state.phase,intent]);entry.repeat=seenRejected.has(repeatKey);seenRejected.add(repeatKey);if(entry.repeat)repeatedRejections++;
  // Post-rejection diagnostics are authority-only, never fed to the policy.
  entry.issues=engine.apply(structuredClone(state),toCoreAction(intent,x.scope.controllerId)).issues;
 }
 steps.push(entry);if(!['ACCEPTED','REJECTED'].includes(result.status))break;
}
const final=h.auditOmniscient(),count={};for(const e of final.actionLog)if(e.accepted)count[e.action.type]=(count[e.action.type]??0)+1;
const summary={seed,termination:steps.at(-1).result,turn:final.turn,winner:final.victory.winner,accepted:steps.filter(s=>s.result.status==='ACCEPTED').length,rejected:steps.filter(s=>s.result.status==='REJECTED').length,repeatedRejections,count,first,reversals,revisits,finalRandom:final.random,traceHash:hash(steps),stateHash:hash(final)};
const sorted=[...timings].sort((a,b)=>a-b),timing={calls:timings.length,totalMs:timings.reduce((a,b)=>a+b,0),p50Ms:sorted[Math.floor(sorted.length*.5)],p95Ms:sorted[Math.floor(sorted.length*.95)],maxMs:sorted.at(-1)};
mkdirSync('evidence/ai005',{recursive:true});writeFileSync(`evidence/ai005/${label}-${seed}.json.gz`,gzipSync(JSON.stringify({summary,steps}),{level:9}));
writeFileSync(`evidence/ai005/${label}-${seed}-summary.json`,JSON.stringify({summary,timing},null,2)+'\n');console.log(JSON.stringify({label,...summary,timing},null,2));
