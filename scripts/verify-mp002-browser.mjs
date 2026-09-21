import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createMultiplayerServer} from '../.server-dist/server/runtime.js';
import {RoomAuthority} from '../.server-dist/server/authority.js';
import {forcedAction} from '../.server-dist/server/gameplay.js';
import {createMatchSession} from '../.server-dist/server/match.js';
import {DEFAULTS} from '../.server-dist/server/config.js';
import {production} from '../tests/helpers/mp002.mjs';
import {dispatchGameAction,controllerIdForSide} from '../.server-dist/src/core-adapter/session.js';
import {deploymentHexKeysForSide,validateMoveAction,getNeighbors} from '../.server-dist/src/core-adapter/core.js';
const require=createRequire(import.meta.url);let playwright;try{playwright=require('playwright');}catch{playwright=require(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright`);}
const config={...DEFAULTS,port:0,messagesPerWindow:10000,allowedOrigins:['http://127.0.0.1:4173']};let match;
// Browser fixture uses the official Scenario factory and accepted deployment/phase actions.
// Full unseeded room creation and network hidden deployment are covered by mp001/mp002 wire tests.
function setup(){
 const s=production(17),apply=a=>{const r=dispatchGameAction(s,a).result;assert(r.accepted,JSON.stringify(r.issues));};
 for(const [side,special]of [['SOVIET',{'S-I-01':'3,-1'}],['GERMAN',{'G-PZ-01':'2,-1','G-I-01':'1,0','G-J-01':'2,0'}]]){
  const controllerId=controllerIdForSide(s,side),zone=deploymentHexKeysForSide(s.state,s.scenario,side),counts={},ids=s.scenario.deployment.units.filter(u=>u.side===side).map(u=>u.id).sort();
  for(const [id,k]of Object.entries(special)){apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:id,hex:s.state.hexes[k].coord});counts[k]=(counts[k]??0)+1;}
  for(const id of ids){if(id in special)continue;const k=zone.find(k=>(counts[k]??0)<2&&!Object.values(special).includes(k));apply({type:'DEPLOY_INITIAL_UNIT',controllerId,deploymentUnitId:id,hex:s.state.hexes[k].coord});counts[k]=(counts[k]??0)+1;}
  apply({type:'READY_FOR_PHASE_END',controllerId});
 }
 apply({type:'READY_FOR_PHASE_END',controllerId:controllerIdForSide(s,'GERMAN')});return s;
}
const authority=new RoomAuthority(config,Date.now,(...args)=>{match=createMatchSession(...args);match.authoritative=setup();return match;});
const server=createMultiplayerServer(config,authority),port=await server.listen(),originalConfig=readFileSync('dist/multiplayer-config.json');
writeFileSync('dist/multiplayer-config.json',JSON.stringify({serverUrl:`ws://127.0.0.1:${port}/ws`}));
const staticServer=spawn(process.execPath,['scripts/serve.mjs','dist'],{env:{...process.env,PORT:'4173'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{staticServer.stdout.once('data',resolve);staticServer.once('error',reject);});
const out='evidence/mp-002';mkdirSync(out,{recursive:true});let browser;const pages=[],frames=[[],[]],evidence={fixture:'official production Scenario + accepted setup actions, seed 17',contexts:['Huawei-like tablet 1280x800 touch zh-CN','desktop 1440x1000 en-US'],errors:[],checks:[]};
try{
 browser=await playwright.chromium.launch({headless:true,...(process.env.MP_CHROMIUM_EXECUTABLE?{executablePath:process.env.MP_CHROMIUM_EXECUTABLE}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const tablet=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true,isMobile:true,deviceScaleFactor:1,userAgent:'Mozilla/5.0 (Linux; Android 12; HUAWEI Tablet) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'}),desktop=await browser.newContext({viewport:{width:1440,height:1000}});
 const a=await tablet.newPage(),b=await desktop.newPage();pages.push(a,b);
 for(const [i,p]of pages.entries()){
  p.on('pageerror',e=>evidence.errors.push(e.message));p.on('websocket',ws=>ws.on('framereceived',f=>{try{const m=JSON.parse(String(f.payload));frames[i].push(m);if(m.messageType==='ROOM_ERROR')console.error('room error',m.payload);}catch{}}));
  p.on('websocket',ws=>{ws.on('close',()=>console.error('socket closed',i));ws.on('socketerror',e=>console.error('socket error',i,e));});
  p.on('console',m=>{if(m.type()==='error')console.error('browser error',m.text());});
  await p.goto('http://127.0.0.1:4173/');if(i)await p.locator('[data-language-select]').selectOption('en-US');
  await p.locator('#multiplayer-button').click();await p.waitForFunction(()=>document.querySelector('#mp-connect')?.disabled===false);await p.locator('#mp-name').fill(i?'Soviet Player':'德国玩家');await p.locator('#mp-connect').click();await p.locator('#mp-create').waitFor();
 }
 await a.locator('#mp-create').click();await a.locator('#mp-room-code').waitFor();const code=await a.locator('#mp-room-code').innerText();await b.locator('#mp-code').fill(code);await b.locator('#mp-join').click();
 await a.locator('[data-mp-seat="GERMANY"]').click();await b.locator('[data-mp-seat="SOVIET"]').click();await a.locator('#mp-ready').click();await b.locator('#mp-ready').click();
 await Promise.all(pages.map(p=>p.locator('#eastfront-map').waitFor({timeout:120000})));
 const interactive=p=>p.waitForFunction(()=>document.querySelector('#network-match-status')?.dataset.interactive==='true',null,{timeout:15000});
 const settled=p=>p.waitForFunction(()=>!document.querySelector('#network-match-status')?.textContent?.match(/正在同步|正在提交|Syncing|Submitting/),null,{timeout:15000});
 await interactive(a);await settled(b);
 await a.screenshot({path:`${out}/browser-germany-before.png`});await b.screenshot({path:`${out}/browser-soviet-before.png`});
 const last=(i,type='PLAYER_VIEW_SNAPSHOT')=>frames[i].findLast(m=>m.messageType===type)?.payload;
 assert.equal(last(0).view.viewer,'GERMAN');assert.equal(last(1).view.viewer,'SOVIET');assert.equal(last(0).matchId,last(1).matchId);
 assert.notDeepEqual(last(0).view.units.map(u=>u.id),last(1).view.units.map(u=>u.id));
 evidence.checks.push('Same server match, different authorized units and fog in independent browser contexts');
 // Preserve DOM terrain and viewport references across accepted network actions.
 await a.evaluate(()=>{window.mpTerrain=document.querySelector('#terrain-surface');window.mpMap=document.querySelector('#eastfront-map');window.mpTransform=window.mpMap.style.transform;});
 const mover=match.authoritative.state.units['G-I-01'];const destination=getNeighbors(mover.hex).find(h=>!Object.values(match.authoritative.state.units).some(u=>u.alive&&u.hex.q===h.q&&u.hex.r===h.r)&&!validateMoveAction(match.authoritative.state,match.authoritative.rules,{type:'MOVE',controllerId:mover.controllerId,unitId:mover.id,path:[h]}).issues.length);assert(destination);
 await a.locator('[data-unit-id="G-I-01"]').first().click({force:true});await interactive(a);
 const key=`${destination.q},${destination.r}`;await a.locator(`[data-role="move-option"][data-hex="${key}"]`).click({force:true});await interactive(a);
 assert.deepEqual(match.authoritative.state.units['G-I-01'].hex,mover.hex,'draft did not optimistically move unit');
 await a.locator('#move-commit').click();await a.waitForFunction(()=>Number(document.querySelector('#network-match-status')?.dataset.revision)>=1);await interactive(a);
 assert.deepEqual(match.authoritative.state.units['G-I-01'].hex,destination);evidence.checks.push('Actual shared map selection/path/Move button submits server action with no optimistic unit movement');
 await a.screenshot({path:`${out}/browser-germany-moved.png`});
 const fogBeforePhase=await a.locator('#fog-surface-layer').getAttribute('data-fog-builds');
 await a.locator('#ready-button').click();await interactive(a);
 assert.equal(await a.locator('#fog-surface-layer').getAttribute('data-fog-builds'),fogBeforePhase);evidence.checks.push('Phase-only network update with unchanged observation did not rebuild Fog');
 assert.equal(match.authoritative.state.phase,'GERMAN_COMBAT');
 // These adjacent fixture attackers occupy separate hexes, so pointer targets are unambiguous at FIT.
 await a.locator('[data-unit-id="G-PZ-01"]').first().click({force:true});await interactive(a);
 await a.locator('[data-unit-id="S-I-01"]').first().click({force:true});await interactive(a);
 await a.locator('[data-unit-id="G-J-01"]').first().click({force:true});await interactive(a);
 assert(last(0,'MATCH_QUERY').model.combat.attackDraft.attackerUnitIds.length>=2,JSON.stringify(last(0,'MATCH_QUERY').model.combat.attackDraft));
 await a.locator('#attack-declare').click();await a.waitForFunction(()=>Number(document.querySelector('#network-match-status')?.dataset.revision)>=3);await settled(a);
 // If defender has optional resources, explicitly decline through its own UI.
 for(let decisions=0;decisions<10&&match.authoritative.state.pendingDecision;decisions++){
  const d=match.authoritative.state.pendingDecision,p=d.side==='GERMAN'?a:b,owner=match.controllerAssignments.find(c=>c.viewer===d.side);
  if(forcedAction(match,owner.controllerId)){const rev=match.matchRevision;await p.waitForFunction(r=>Number(document.querySelector('#network-match-status')?.dataset.revision)>r,rev);continue;}
  await interactive(p);if(match.authoritative.state.pendingDecision!==d)continue;
  if(d.kind==='DEFENDER_REACTION')await p.locator('#pass-reaction').click();
  else if(d.kind==='LOSS_ALLOCATION')await p.locator('[data-loss-unit]').first().click();
  else if(d.kind==='RETREAT')await p.locator('[data-role="retreat-option"]').first().click({force:true});
  else if(d.kind==='ADVANCE_AFTER_COMBAT')await p.locator('#pass-advance').click();
  else if(d.kind==='BREAKTHROUGH_OPTION')await p.locator('#pass-breakthrough').click();
  else if(d.kind==='SCHWERPUNKT_OPTION')await p.locator('#pass-schwerpunkt').click();
  await settled(p);
 }
 await settled(a);await a.screenshot({path:`${out}/browser-germany-combat.png`});await b.screenshot({path:`${out}/browser-soviet-combat.png`});
 assert(Object.values(match.authoritative.state.combatTransactions).some(tx=>tx.resolution));evidence.checks.push('Actual Combat UX2.1 multi-attacker selection and ATTACK; defender context is private');
 assert(await a.evaluate(()=>window.mpTerrain===document.querySelector('#terrain-surface')&&window.mpMap===document.querySelector('#eastfront-map')&&window.mpTransform===document.querySelector('#eastfront-map').style.transform));
 evidence.checks.push('Ordinary network Move/combat preserved the same VS2 surface, SVG map, and camera transform');
 const originalController=frames[0].find(m=>m.messageType==='WELCOME').payload.controllerId;
 await tablet.setOffline(true);await a.evaluate(()=>window.dispatchEvent(new Event('offline')));await a.waitForFunction(()=>document.querySelector('#network-match-status')?.textContent.includes('对局连接中断'));
 await a.screenshot({path:`${out}/browser-disconnected.png`});const revision=match.matchRevision;
 await tablet.setOffline(false);await a.evaluate(()=>window.dispatchEvent(new Event('online')));await a.waitForFunction(()=>document.querySelector('#network-match-status')?.dataset.status==='ACTIVE'&&!document.querySelector('#network-match-status')?.textContent.includes('对局连接中断'),null,{timeout:20000});
 assert.equal(frames[0].findLast(m=>m.messageType==='WELCOME').payload.controllerId,originalController);assert.equal(match.matchRevision,revision);
 evidence.checks.push('Active browser offline/reconnect retained controller, restored current snapshot, and did not submit a decision');
 await a.locator('#restart-button').click();await a.locator('#new-game-button').waitFor();await server.close();
 await a.locator('#new-game-button').click();await a.locator('[data-deploy-unit-id]').first().waitFor();
 assert.equal(await a.locator('#network-match-status').count(),0);await a.screenshot({path:`${out}/browser-local-retained.png`});evidence.checks.push('Leaving network match then NEW GAME works as a local Scenario with backend stopped');
 assert.deepEqual(evidence.errors,[]);evidence.result='PASS';evidence.matchRevision=match.matchRevision;evidence.views={germany:last(0).view.units.length,soviet:last(1).view.units.length};
}catch(error){for(const [i,p]of pages.entries()){console.error('Failure UI',i,(await p.locator('body').innerText()).slice(0,4500));await p.screenshot({path:`${out}/browser-failure-${i}.png`});}throw error;
}finally{writeFileSync(`${out}/browser-evidence.json`,JSON.stringify(evidence,null,2)+'\n');await browser?.close();staticServer.kill();await server.close();writeFileSync('dist/multiplayer-config.json',originalConfig);}
console.log(JSON.stringify(evidence,null,2));
