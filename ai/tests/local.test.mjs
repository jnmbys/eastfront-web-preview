import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Worker} from 'node:worker_threads';
import {LocalMatch} from '../../.ai-dist/ai/local/LocalMatch.js';
import {prepareLocalScenario} from '../../.ai-dist/ai/local/scenarios.js';
import {sha256} from '../../.ai-dist/ai/authority/sha256.js';
import {minimalAgent,observationCandidates} from '../../.ai-dist/ai/fair/index.js';
import {FairHost} from '../../.ai-dist/ai/authority/FairHost.js';
import {validateGameStateIntegrity} from '../../.ai-dist/vendor/eastfront-digital-core/dist/index.js';
import {queryDraft} from '../../.ai-dist/src/multiplayer/gameplayProtocol.js';
import {createPresentationState} from '../../.ai-dist/src/state/presentation.js';
const map=JSON.parse(readFileSync(new URL('../../vendor/eastfront-digital-core/reference/strategic-reset-f-map.json',import.meta.url)));
const prepared=(humanSide,scenario)=>prepareLocalScenario({humanSide,scenario,seed:17,map});
const newMatch=(side,scenario)=>{const p=prepared(side,scenario);return new LocalMatch(p.session,side,p.policy);};
let request=0;
function submit(m,action){const snap=m.snapshot().payload;return m.request('SUBMIT_ACTION',{matchId:snap.matchId,expectedRevision:snap.matchRevision,action},'req-'+ ++request);}
function fairChoice(m){const state=m.audit(),owner=state.pendingDecision?.decisionOwnerControllerId??Object.values(state.controllers).find(c=>c.side===state.activeSide).id;const p=prepared(m.meta.humanSide,'human-attack');const h=new FairHost({matchId:'trusted-test',initialState:state,rules:p.session.rules,scenario:p.session.scenario,agentSeeds:{GERMAN:101,SOVIET:202}});return minimalAgent(h.observe(owner)).intent;}
const evidence=[];
function capture(name,m){const s=m.audit();evidence.push({name,meta:m.meta,turn:s.turn,phase:s.phase,actions:s.actionLog.map(e=>({accepted:e.accepted,action:e.action})),rng:s.random});}

test('AI003 browser-portable observation hashes remain exactly SHA256',()=>{
 for(const text of ['', 'abc','汉字 🎲', 'x'.repeat(55),'x'.repeat(56),'x'.repeat(64),'x'.repeat(100000)])assert.equal(sha256(text),createHash('sha256').update(text).digest('hex'));
});
test('AI003 both human sides attack, AI owns reaction/retreat despite human active turn',()=>{
 for(const side of ['GERMAN','SOVIET']){
  const m=newMatch(side,'human-attack'),initial=m.snapshot().payload;assert.equal(initial.view.viewer,side);assert(initial.canAct);assert.equal(m.shouldThink,false);const enemy=initial.view.units.find(u=>u.side!==side&&u.id==='defender');
  assert(submit(m,{type:'ATTACK',attackerUnitIds:['attacker'],target:enemy.hex}).some(r=>r.messageType==='ACTION_ACCEPTED'));
  assert.equal(m.audit().activeSide,side);assert(m.shouldThink);assert.equal(m.snapshot().payload.canAct,false);
  let n=0;while(m.shouldThink&&n++<20)m.think();assert(n<20);assert.equal(m.meta.paused,false);assert.equal(m.snapshot().payload.view.viewer,side);assert.equal(m.shouldThink,false);
  assert(m.audit().actionLog.some(e=>e.action.type==='PASS_REACTION'));if(side==='GERMAN')assert(m.audit().actionLog.some(e=>e.action.type==='RETREAT'));
  capture('human-attack-'+side,m);
 }
});
test('AI003 scripted AI attack yields to human reaction and loss, then resumes required owner only',()=>{
 for(const side of ['GERMAN','SOVIET']){
  const m=newMatch(side,'ai-attack');assert(m.shouldThink);m.think();const snapshot=m.snapshot().payload;
  assert.equal(snapshot.view.pendingDecision.kind,'DEFENDER_REACTION');assert(snapshot.canAct);assert.equal(m.shouldThink,false);assert(snapshot.model.combat.reaction.artillery.includes('human-support'));
  const before=m.audit();assert.equal(m.think(),null);assert.deepEqual(m.audit(),before);
  assert(submit(m,{type:'PASS_REACTION',battleId:snapshot.view.pendingDecision.battleId}).some(r=>r.messageType==='ACTION_ACCEPTED'));
  for(let i=0;i<30&&m.audit().pendingDecision;i++){if(m.shouldThink)m.think();else{const a=fairChoice(m);assert(a);assert(submit(m,a).some(r=>r.messageType==='ACTION_ACCEPTED'));}}
  assert.equal(m.audit().pendingDecision,null);assert.equal(m.meta.paused,false);capture('ai-attack-'+side,m);
 }
});
test('AI003 advance and breakthrough continue through the normal human Action path',()=>{
 const m=newMatch('GERMAN','breakthrough');let p=m.audit().pendingDecision;assert.equal(p.kind,'ADVANCE_AFTER_COMBAT');
 assert(submit(m,{type:'ADVANCE_AFTER_COMBAT',battleId:p.battleId,unitId:'attacker'}).some(r=>r.messageType==='ACTION_ACCEPTED'));
 p=m.audit().pendingDecision;assert.equal(p.kind,'BREAKTHROUGH_OPTION');const target=m.audit().combatTransactions[p.battleId].targetHex;
 assert(submit(m,{type:'BREAKTHROUGH',battleId:p.battleId,unitId:'attacker',path:[{q:target.q+1,r:target.r}]}).some(r=>r.messageType==='ACTION_ACCEPTED'));
 p=m.audit().pendingDecision;assert.equal(p.kind,'SCHWERPUNKT_OPTION');assert(submit(m,{type:'PASS_SCHWERPUNKT',battleId:p.battleId}).some(r=>r.messageType==='ACTION_ACCEPTED'));
 assert.equal(m.audit().pendingDecision,null);capture('human-breakthrough',m);
});
test('AI003 real turn-four reinforcement scenario and terminal scenario use replayed campaign Actions',()=>{
 const r=prepared('SOVIET','reinforcement'),m=new LocalMatch(r.session,'SOVIET');assert.equal(m.audit().turn,4);assert(m.audit().actionLog.length>60);
 const snap=m.snapshot().payload,reinforcement=snap.model.reinforcement;assert(reinforcement.deployable);
 const [q,v]=reinforcement.legalEntryKeys[0].split(',').map(Number);
 assert(submit(m,{type:'DEPLOY_REINFORCEMENT',reinforcementId:reinforcement.available[0].id,entryHex:{q,r:v}}).some(r=>r.messageType==='ACTION_ACCEPTED'));capture('turn4-reinforcement',m);
 const t=prepared('GERMAN','terminal'),end=new LocalMatch(t.session,'GERMAN');assert.equal(end.audit().phase,'GERMAN_ENTRENCHMENT');
 assert(submit(end,{type:'READY_FOR_PHASE_END'}).some(r=>r.messageType==='ACTION_ACCEPTED'));assert.equal(end.snapshot().payload.status,'FINISHED');assert.equal(end.shouldThink,false);assert.equal(end.think(),null);capture('natural-terminal',end);
});
test('AI003 policy stop and rejection limit preserve state; takeover changes recipient explicitly',()=>{
 for(const rejection of [false,true]){
  const p=prepared('GERMAN','stop'),bad=()=>({kind:'INTENT',intent:{type:'bogus'}}),m=new LocalMatch(p.session,'GERMAN',rejection?bad:p.policy),before=m.audit();
  for(let i=0;i<9&&m.shouldThink;i++)m.think();assert(m.meta.paused);assert(m.meta.reason.startsWith(rejection?'REJECTION_LIMIT':'AGENT_STOP'));assert.deepEqual(m.audit(),before);
  assert.equal(m.snapshot().payload.view.viewer,'GERMAN');const changed=m.takeOver();assert(changed);assert.equal(changed.payload.view.viewer,'SOVIET');assert.equal(m.meta.manual,true);assert.equal(m.shouldThink,false);
  assert(!JSON.stringify(changed.payload).includes('authoritativeState'));assert(changed.payload.view.units.filter(u=>u.side==='GERMAN').every(u=>!('friendly' in u)));
  assert.deepEqual(m.audit().pendingDecision,before.pendingDecision,'takeover must preserve the pending battle');
  assert(submit(m,{type:'PASS_REACTION',battleId:m.audit().pendingDecision.battleId}).some(r=>r.messageType==='ACTION_ACCEPTED'));capture(rejection?'limit-takeover':'stop-takeover',m);
 }
});
test('AI003 duplicate, old revision, wrong owner and forged invisible target cannot mutate or reroll',()=>{
 const m=newMatch('GERMAN','human-attack'),s=m.snapshot().payload,action={type:'ATTACK',attackerUnitIds:['attacker'],target:s.view.units.find(u=>u.id==='defender').hex};
 const payload={matchId:s.matchId,expectedRevision:s.matchRevision,action};const first=m.request('SUBMIT_ACTION',payload,'same');assert(first.some(r=>r.messageType==='ACTION_ACCEPTED'));const after=m.audit();assert.deepEqual(m.request('SUBMIT_ACTION',payload,'same'),[]);assert.deepEqual(m.audit(),after);
 assert.equal(m.request('SUBMIT_ACTION',payload,'stale')[0].payload.code,'STALE_REVISION');assert.deepEqual(m.audit(),after);
 assert.equal(submit(m,{type:'PASS_REACTION',battleId:after.pendingDecision.battleId})[0].payload.code,'NOT_ACTION_OWNER');assert.deepEqual(m.audit(),after);
 const a=newMatch('GERMAN','human-attack'),before=a.audit();assert.equal(submit(a,{type:'ATTACK',attackerUnitIds:['attacker'],target:{q:30,r:0}})[0].payload.code,'NOT_ACTION_OWNER');assert.deepEqual(a.audit(),before);
});
test('AI003 Worker channel carries authorized DTOs only; stale epochs ignored and cancellation terminates old work',async()=>{
 const worker=new Worker(new URL('../local/worker-test-bridge.mjs',import.meta.url),{workerData:{entry:new URL('../../.ai-dist/ai/local/worker.js',import.meta.url).href}});const messages=[];
 const wait=predicate=>new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{worker.off('message',on);reject(new Error('bounded worker wait'));},15000);const on=m=>{messages.push(m);if(predicate(m)){clearTimeout(timeout);worker.off('message',on);resolve(m);}};worker.on('message',on);});
 try{
  const ready=wait(m=>m.message?.messageType==='PLAYER_VIEW_SNAPSHOT');worker.postMessage({kind:'START',epoch:12,options:{humanSide:'SOVIET',scenario:'ai-attack',seed:17,map}});await ready;
  const human=await wait(m=>m.message?.messageType==='PLAYER_VIEW_SNAPSHOT'&&m.message.payload.canAct);assert.equal(human.message.payload.view.pendingDecision.kind,'DEFENDER_REACTION');
  for(const packet of messages){const raw=JSON.stringify(packet);for(const forbidden of ['"actionLog"','"random"','"combatTransactions"','"authoritativeState"','"initialUnits"'])assert(!raw.includes(forbidden),forbidden);}
  worker.postMessage({kind:'REQUEST',epoch:11,requestId:'old-task',type:'SUBMIT_ACTION',payload:{matchId:human.message.payload.matchId,expectedRevision:human.message.payload.matchRevision,action:{type:'PASS_REACTION',battleId:human.message.payload.view.pendingDecision.battleId}}});
  const unchanged=wait(m=>m.message?.messageType==='PLAYER_VIEW_SNAPSHOT');worker.postMessage({kind:'REQUEST',epoch:12,requestId:'resync',type:'RESYNC_MATCH',payload:{matchId:human.message.payload.matchId}});const still=await unchanged;assert.equal(still.message.payload.matchRevision,human.message.payload.matchRevision);assert.equal(still.message.payload.view.pendingDecision.kind,'DEFENDER_REACTION');
 }finally{await worker.terminate();}
 const slow=new Worker(new URL('../local/worker-test-bridge.mjs',import.meta.url),{workerData:{entry:new URL('../../.ai-dist/ai/local/worker.js',import.meta.url).href}});let delivered=false;slow.on('message',()=>{delivered=true;});slow.postMessage({kind:'START',epoch:15,options:{humanSide:'GERMAN',scenario:'terminal',seed:17,map}});await slow.terminate();assert.equal(delivered,false);
});
test.after(()=>{if(!evidence.length)return;mkdirSync('evidence/ai003',{recursive:true});writeFileSync('evidence/ai003/action-traces.json',JSON.stringify(evidence,null,2));});

test('AI003 actual client/session bridge enforces single-flight submission and clears seat caches on takeover',async()=>{
 const {LocalAiClient}=await import('../../.ai-dist/src/local-ai/client.js');
 const {NetworkPlayerSession}=await import('../../.ai-dist/src/multiplayer/networkSession.js');
 const {combatResults}=await import('../../.ai-dist/src/ui/combatResult.js');
 const m=newMatch('GERMAN','human-attack'),options={humanSide:'GERMAN',scenario:'human-attack',seed:17,map},sent=[];
 const port={onmessage:null,onerror:null,terminated:false,terminate(){this.terminated=true;},postMessage(message){sent.push(message);queueMicrotask(()=>{
  if(this.terminated)return;
  const messages=message.kind==='START'?[m.snapshot(true)]:message.kind==='TAKEOVER'?[m.takeOver()]:m.request(message.type,message.payload,message.requestId);
  for(const response of messages)this.onmessage?.({data:{epoch:message.epoch,message:response,meta:m.meta,...(message.kind==='TAKEOVER'?{takeover:true}:{})}});
 });}};
 const c=new LocalAiClient(port,options,()=>{});await c.start(options);let changes=0;
 const n=new NetworkPlayerSession(c,createPresentationState(),()=>{changes++;});
 const wait=predicate=>new Promise((resolve,reject)=>{if(predicate()){resolve();return;}const timer=setTimeout(()=>{off();reject(new Error('bounded client wait'));},3000);const off=c.subscribe(()=>{if(predicate()){clearTimeout(timer);off();resolve();}});});
 try{
  const before=m.audit();const enemy=n.playerView.units.find(u=>u.id==='defender');const a={type:'ATTACK',attackerUnitIds:['attacker'],target:enemy.hex};
  const ready=wait(()=>n.matchRevision===1);n.submit(a);n.submit(a);assert.equal(sent.filter(m=>m.type==='SUBMIT_ACTION').length,1);await ready;
  assert.equal(n.interactive,false);assert(changes>0);assert.equal(m.audit().actionLog.length,before.actionLog.length+1);assert.equal(n.playerView.viewer,'GERMAN');
 }finally{n.dispose();}assert(port.terminated);
 const stopped=newMatch('GERMAN','stop');stopped.think();
 const stopPort={onmessage:null,onerror:null,terminated:false,terminate(){this.terminated=true;},postMessage(message){queueMicrotask(()=>this.onmessage?.({data:{epoch:message.epoch,message:message.kind==='TAKEOVER'?stopped.takeOver():stopped.snapshot(true),meta:stopped.meta,...(message.kind==='TAKEOVER'?{takeover:true}:{})}}));}};
 const c2=new LocalAiClient(stopPort,options,()=>{});await c2.start(options);const p1=createPresentationState(),old=new NetworkPlayerSession(c2,p1,()=>{}),oldCard=combatResults(old);p1.selectedUnitId='attacker';
 old.dispose(false);assert.equal(stopPort.terminated,false);await c2.takeover();
 const p2=createPresentationState(),next=new NetworkPlayerSession(c2,p2,()=>{});assert.equal(next.playerView.viewer,'SOVIET');assert.notEqual(combatResults(next),oldCard);assert.equal(p2.selectedUnitId,null);assert.equal(next.interactive,true);next.dispose();
});
test('AI003 late worker replies after exit or worker failure never replace the visible snapshot',async()=>{
 const {LocalAiClient}=await import('../../.ai-dist/src/local-ai/client.js');const options={humanSide:'GERMAN',scenario:'stop',seed:17,map};
 const port={onmessage:null,onerror:null,terminateCount:0,postMessage(){},terminate(){this.terminateCount++;}};
 const c=new LocalAiClient(port,options,()=>{}),pending=c.start(options).catch(e=>e.message),late=port.onmessage;c.dispose();assert.equal(await pending,'CANCELLED');
 const h=newMatch('GERMAN','stop');late({data:{epoch:1,message:h.snapshot(true),meta:h.meta}});assert.equal(c.state.snapshot,null);assert.equal(port.terminateCount,1);
 const p={...port,onmessage:null,onerror:null,terminateCount:0};const fault=new LocalAiClient(p,options,()=>{}),boot=fault.start(options);p.onmessage({data:{epoch:1,message:h.snapshot(true),meta:h.meta}});await boot;const snapshot=fault.state.snapshot;const deliver=p.onmessage;p.onerror({});assert.equal(fault.meta.reason,'WORKER_ERROR');h.think();deliver({data:{epoch:1,message:h.snapshot(true),meta:h.meta}});assert.equal(fault.state.snapshot,snapshot);assert.equal(fault.canMutate,false);fault.dispose();
});

test('AI003 cold entry awaits existing terrain boot and cancelled starts cannot create a Worker',async()=>{
 const vm=await import('node:vm');
 const {default:ts}=await import('typescript');
 const main=ts.transpileModule(readFileSync(new URL('../../src/main.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
 const start=main.slice(main.indexOf('async function startLocalAi('),main.indexOf('function updateLocalAiStatus('));
 let release,workers=0,entered=0;const ready=new Promise(r=>{release=r;});
 class Client {async start(){} dispose(){this.disposed=true;}}
 const c={perf006:{start(){},enabled:false},query:new URLSearchParams(),localGeneration:0,session:null,localAi:null,productionMap:null,cachedTerrainSurface:null,appStatus:'HOME',isNetwork:()=>false,crypto:{getRandomValues:a=>{a[0]=17;return a;}},createLocalAiWorker:()=>{workers++;return {};},LocalAiClient:Client,render(){},updateLocalAiStatus(){},enterNetworkMatch:async()=>{entered++;},boot:async()=>{await ready;c.productionMap={};c.cachedTerrainSurface={};}};
 vm.createContext(c);vm.runInContext(start,c);const first=c.startLocalAi('GERMAN','campaign');assert.equal(workers,0);c.localGeneration++;release();await first;assert.equal(workers,0);assert.equal(entered,0);
 await c.startLocalAi('SOVIET','campaign');assert.equal(workers,1);assert.equal(entered,1);assert.equal(c.appStatus,'LOADING');
});
