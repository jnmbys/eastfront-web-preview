import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket as Wire} from 'ws';
import {network} from './helpers/mp001.mjs';
import {LobbyClient} from '../dist/app/multiplayer/client.js';
import {NetworkPlayerSession} from '../dist/app/multiplayer/networkSession.js';
import {createPresentationState} from '../dist/app/state/presentation.js';
import {createMatchSession} from '../.server-dist/server/match.js';
import {movementFixture} from './helpers/move001.mjs';
import {combatDom} from './helpers/combat-dom.mjs';
const wait=async(predicate)=>{const start=performance.now();while(!predicate()){if(performance.now()-start>7000)throw Error('Network integration deadline');await new Promise(resolve=>setTimeout(resolve,3));}};
async function pair(t,full=false){
 const server=await network(t,{factory:(...args)=>{const match=createMatchSession(...args);match.authoritative=movementFixture(full);return match;}}),previous={window:globalThis.window,sessionStorage:globalThis.sessionStorage,WebSocket:globalThis.WebSocket},sockets=[],sent=[],delivered=[];
 globalThis.window=new EventTarget();globalThis.sessionStorage={getItem(){return null;},setItem(){},removeItem(){}};
 class BrowserSocket extends Wire {
  constructor(url){super(url,{origin:'http://127.0.0.1:4173'});sockets.push(this);}
  send(raw){const message=JSON.parse(raw);sent.push({socket:this,...message});super.send(raw);}
  set onmessage(fn){super.onmessage=event=>{const m=JSON.parse(String(event.data));if(this.drop?.(m))return;delivered.push({socket:this,message:m});fn(event);};}
 }
 globalThis.WebSocket=BrowserSocket;
 const peer=()=>{const presentation=createPresentationState();let session;const changes=[];const client=new LobbyClient(`ws://127.0.0.1:${server.port}/ws`,()=>{
  if(!session&&client.state.snapshot)session=new NetworkPlayerSession(client,presentation,kind=>{changes.push(kind);if(kind!=='status')session.requestProjection(presentation);});
 });client.connect('MP003 integration');return {client,presentation,changes,get session(){return session;},get socket(){return sockets.findLast(s=>s===this.initialSocket)??this.initialSocket;},initialSocket:sockets.at(-1)};};
 const a=peer(),b=peer();t.after(()=>{a.client.dispose();b.client.dispose();for(const socket of sockets)socket.terminate();Object.assign(globalThis,previous);});
 await wait(()=>a.client.canMutate&&b.client.canMutate);a.client.send('CREATE_ROOM',{});await wait(()=>a.client.state.room);b.client.send('JOIN_ROOM',{roomCode:a.client.state.room.roomCode});await wait(()=>b.client.state.room);
 a.client.send('SELECT_SEAT',{seat:'GERMANY'});await wait(()=>a.client.canMutate);b.client.send('SELECT_SEAT',{seat:'SOVIET'});await wait(()=>b.client.canMutate);a.client.send('SET_READY',{ready:true});await wait(()=>a.client.canMutate);b.client.send('SET_READY',{ready:true});await wait(()=>a.session?.interactive&&b.session?.ready);
 return {...server,a,b,sent,delivered,sockets};
}

test('MOVE001 real WebSocket clients: all target surfaces use authorized draft, pending sends once, snapshot moves',async t=>{
 const {a,b,sent}=await pair(t),s=a.session,p=a.presentation,h=combatDom(s,p);
 h.click('[data-unit-id="mover"]');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-start');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();
 for(const selector of ['[data-unit-id="friend"]','[data-hit-unit-id="friend"]','[data-hex="1,0"]']){
  h.click(selector);assert.equal(p.selectedUnitId,'mover');assert.deepEqual(p.pathDraft,[{q:1,r:0}]);assert.deepEqual(s.playerView.units.find(u=>u.id==='mover').hex,{q:0,r:0});
  await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('[data-unit-id="mover"]');assert.deepEqual(p.pathDraft,[]);
  await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-start');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();
 }
 h.click('[data-unit-id="friend"]');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();
 const commit=h.document.querySelector('#move-commit'),target=h.document.querySelector('[data-unit-id="friend"]'),cancel=h.document.querySelector('#move-cancel');
 commit.fire('click');assert.equal(s.canSelect,false);commit.fire('click');target.fire('click');cancel.fire('click');
 assert.equal(sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,1);assert.equal(p.selectedUnitId,'mover');assert.deepEqual(p.pathDraft,[{q:1,r:0}]);assert.deepEqual(s.playerView.units.find(u=>u.id==='mover').hex,{q:0,r:0});
 await wait(()=>s.matchRevision===1&&b.session.matchRevision===1&&s.interactive);
 assert.deepEqual(s.playerView.units.find(u=>u.id==='mover').hex,{q:1,r:0});assert.deepEqual(p.pathDraft,[]);
 assert.equal(p.interactionMode,'SELECT');h.repaint();h.click('[data-unit-id="far"]');assert.equal(p.selectedUnitId,'far');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-start');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('[data-hex="2,0"]');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-commit');
 await wait(()=>s.matchRevision===2&&b.session.matchRevision===2&&s.interactive);assert.deepEqual(s.playerView.units.find(u=>u.id==='far').hex,{q:2,r:0});assert.equal(p.interactionMode,'SELECT');assert.equal(sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,2);

});

test('MOVE001 server rejection retains authority and recovers selection / next move',async t=>{
 const {a,sent,delivered}=await pair(t),s=a.session,p=a.presentation,h=combatDom(s,p);
 h.click('[data-unit-id="mover"]');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-start');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();
 h.click('[data-unit-id="far"]');assert.equal(p.selectedUnitId,'mover');assert.deepEqual(p.pathDraft,[]);
 // A stale/invalid client request is refused by the unchanged server/Core path.
 s.submit({type:'MOVE',unitId:'mover',path:[{q:3,r:0}]});
 await wait(()=>delivered.some(d=>d.message.messageType==='ACTION_REJECTED')&&s.interactive);
 assert.equal(s.matchRevision,0);assert.deepEqual(s.playerView.units.find(u=>u.id==='mover').hex,{q:0,r:0});h.repaint();
 assert.equal(p.interactionMode,'SELECT');h.click('[data-unit-id="friend"]');assert.equal(p.selectedUnitId,'friend');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();
 h.click('#move-start');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('[data-hit-unit-id="mover"]');assert.deepEqual(p.pathDraft,[{q:0,r:0}]);await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-commit');
 await wait(()=>s.matchRevision===1&&s.interactive);assert.deepEqual(s.playerView.units.find(u=>u.id==='friend').hex,{q:0,r:0});assert.equal(sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,2);
});

test('MOVE001 multiplayer full stack remains illegal through every target surface',async t=>{
 const {a,sent}=await pair(t,true),s=a.session,p=a.presentation,h=combatDom(s,p);
 h.click('[data-unit-id="mover"]');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();h.click('#move-start');await wait(()=>s.interactive&&s.renderModel().movement);h.repaint();
 assert.equal(s.model.moveOptions.find(o=>o.hex.q===1&&o.hex.r===0).legal,false);
 for(const selector of ['[data-unit-id="friend"]','[data-hit-unit-id="friend"]','[data-hex="1,0"]']){
  h.click(selector);assert.equal(p.selectedUnitId,'mover');assert.deepEqual(p.pathDraft,[]);h.click('#move-commit');
 }
 assert.equal(sent.filter(m=>m.messageType==='SUBMIT_ACTION').length,0);assert.deepEqual(s.playerView.units.find(u=>u.id==='mover').hex,{q:0,r:0});
});
