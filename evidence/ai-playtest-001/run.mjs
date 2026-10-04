// Offline LocalMatch transport acceptance. The simulated human receives only a
// frozen authorized FairInput; audit state is retained exclusively for replay.
import {readFileSync,writeFileSync,appendFileSync,existsSync,mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {LocalMatch} from '../../.ai-dist/ai/local/LocalMatch.js';
import {prepareLocalScenario} from '../../.ai-dist/ai/local/scenarios.js';
import {basicAgent} from '../../.ai-dist/ai/fair/basicAgent.js';
import {RulesEngine,validateGameStateIntegrity,hexDistance} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
const dir='evidence/ai-playtest-001',config=JSON.parse(readFileSync(dir+'/config.json'));
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;};
const summary=[];
for(const humanSide of config.humanSides){
 const target=dir+'/'+humanSide;if(existsSync(target+'.trace.ndjson'))throw Error('Existing run: refuse repeat');
 const prepared=prepareLocalScenario({humanSide,scenario:'campaign',seed:config.seed,map});
 let aiDecision=null;
 const m=new LocalMatch(prepared.session,humanSide,input=>{const choice=prepared.policy(input);aiDecision={inputKey:input.observationKey,intent:choice.kind==='INTENT'?choice.intent:null,decision:choice};return choice;});
 const initial=m.audit(),begin=performance.now(),history=[],phases=[],attempts=[];let humanIndex=0,stopped=null,handoffs=0,lastOwner=m.meta.ownerSide;
 writeFileSync(target+'.trace.ndjson',JSON.stringify({kind:'initial',state:initial,config,humanSide,notRealHuman:true})+'\n');
 for(let n=0;n<config.maxDecisions;n++){
  const before=m.audit();if(before.phase==='GAME_OVER')break;
  if(performance.now()-begin>config.maxMs){stopped='WALL_LIMIT';break;}
  if(m.meta.paused){stopped=m.meta.reason;break;}
  const t=performance.now(),owner=m.meta.ownerSide,automatedAi=m.shouldThink;let choice,accepted;
  if(automatedAi){aiDecision=null;m.think();choice=aiDecision;accepted=m.meta.accepted>attempts.filter(x=>x.accepted).length;}
  else {
   const snap=m.snapshot().payload;assert(snap.canAct,'Human turn must expose an enabled transport');
   const dto=structuredClone(m.host.observe(snap.model.viewerControllerId));
   dto.history=history.slice(-16);dto.agentRandom.decisionIndex=humanIndex++;
   const decision=basicAgent(freeze(dto));choice={inputKey:dto.observationKey,intent:decision.intent??null,decision};
   if(decision.kind!=='INTENT'){stopped='HUMAN_PROXY_'+decision.reason;break;}
   const responses=m.request('SUBMIT_ACTION',{matchId:snap.matchId,expectedRevision:snap.matchRevision,action:decision.intent},'playtest-'+n);
   accepted=responses.some(r=>r.messageType==='ACTION_ACCEPTED');
   history.push({observationKey:dto.observationKey,intent:decision.intent,outcome:accepted?'ACCEPTED':'REJECTED'});
  }
  const elapsedMs=performance.now()-t,after=m.audit(),entry={n,turn:before.turn,phase:before.phase,pending:before.pendingDecision?.kind??null,owner,automatedAi,choice,accepted,elapsedMs,afterHash:digest(after),meta:m.meta};
  attempts.push(entry);appendFileSync(target+'.trace.ndjson',JSON.stringify(entry)+'\n');
  const phaseKey=before.turn+':'+before.phase;let phase=phases.at(-1);if(!phase||phase.key!==phaseKey){phase={key:phaseKey,actions:0,ms:0,maxActionMs:0,rejections:0};phases.push(phase);}phase.actions++;phase.ms+=elapsedMs;phase.maxActionMs=Math.max(phase.maxActionMs,elapsedMs);if(!accepted)phase.rejections++;
  if(m.meta.ownerSide!==lastOwner){handoffs++;lastOwner=m.meta.ownerSide;}
  if(m.audit().phase==='GAME_OVER')break;
 }
 const end=m.audit();if(end.phase!=='GAME_OVER'&&!stopped)stopped='ACTION_LIMIT';
 // Replay both accepted and rejected attempts after completion; findings never
 // enter either policy. Core identifies rejections here, not in candidate search.
 const engine=new RulesEngine(prepared.session.rules,prepared.session.scenario);let replay=initial;const rejections=[];
 for(const entry of attempts){const id=Object.values(replay.controllers).find(c=>c.side===entry.owner).id;
  const action={...entry.choice.intent,controllerId:id},result=engine.apply(replay,action);
  assert.equal(result.accepted,entry.accepted);if(result.accepted)replay=result.state;else rejections.push({n:entry.n,owner:entry.owner,action,issues:result.issues});
  assert.equal(digest(replay),entry.afterHash);
 }
 assert.deepEqual(validateGameStateIntegrity(end,prepared.session.rules,prepared.session.scenario),[]);assert.equal(digest(replay),digest(end));
 const counts=side=>Object.fromEntries([...new Set(attempts.filter(a=>a.owner===side&&a.accepted).map(a=>a.choice.intent.type))].map(type=>[type,attempts.filter(a=>a.owner===side&&a.accepted&&a.choice.intent.type===type).length]));
 const record={humanSide,seed:config.seed,notRealHuman:true,status:end.phase==='GAME_OVER'?'GAME_OVER':stopped,turn:end.turn,victory:end.victory,elapsedMs:performance.now()-begin,accepted:m.meta.accepted,rejected:m.meta.rejected,handoffs,actions:{GERMAN:counts('GERMAN'),SOVIET:counts('SOVIET')},phases,rejections,initialHash:digest(initial),finalHash:digest(end),replay:true,policyChanges:false};
 writeFileSync(target+'.record.json',JSON.stringify(record,null,2)+'\n');writeFileSync(target+'.replay.json.gz',gzipSync(JSON.stringify({initial,end,attempts})));writeFileSync(target+'.trace.ndjson.gz',gzipSync(readFileSync(target+'.trace.ndjson')));
 summary.push(record);writeFileSync(dir+'/summary.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({humanSide,status:record.status,turn:record.turn,accepted:record.accepted,rejected:record.rejected,elapsedMs:record.elapsedMs}));
 if(stopped)throw Error(stopped);
}
