import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import WebSocket from 'ws';
import {CampaignAdapter} from './adapter.mjs';import {start,STATE_WINDOW} from './server.mjs';import {encodeView,decodeView} from './view.mjs';import {diff,patch} from './sync.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function command(a,seat,kind,payload={},dependencies={}){return {instanceId:a.id,era:a.era,requestId:crypto.randomUUID(),commandSeq:a.c.transport.next[seat],kind,payload,dependencies};}
function op(a,seat,p){const g=a.c.clock.corps.find(g=>g.permanentId===p.groupId),u=a.c.clock.units[p.unit];return command(a,seat,'OPERATION',p,{commandGeneration:g?.commandGeneration,unitGeneration:u?.commandGeneration,worldGeneration:a.c.transport.worldGeneration,economyGeneration:a.c.transport.economyGeneration,account:a.accountStamp()});}
const advance={kind:'ADVANCE',target:{q:25,r:4},risk:'NORMAL',paused:false};
test('two clients install distinct corps orders; pause after queued simulation does not rewind or start new marches',async()=>{
 const a=new CampaignAdapter(),g=a.c.clock.corps[0],other=a.c.clock.corps[1];
 const results=await Promise.all([a.submit('a',op(a,'a',{type:'ORDER',groupId:g.permanentId,order:advance})),a.submit('b',op(a,'b',{type:'ORDER',groupId:other.permanentId,order:advance}))]);assert(results.every(r=>r.status==='APPLIED'));
 await a.submit('a',op(a,'a',{type:'CLOCK',paused:false,speed:4}));const pause=op(a,'b',{type:'PAUSE_GROUP',groupId:g.permanentId});await Promise.all([a.step(),a.submit('b',pause)]);
 assert.equal(g.order.paused,true);assert.equal(a.c.clock.paused,false);const history=a.c.clock.history.length,position=structuredClone(a.c.state.units[g.members[0]].hex),n=a.c.receipts.size;assert.equal((await a.submit('b',pause)).status,'APPLIED');assert.equal(a.c.receipts.size,n);
 await a.step();assert.equal(a.c.clock.history.length,history+1);assert.deepEqual(a.c.state.units[g.members[0]].hex,position);assert(g.members.every(id=>!a.c.clock.units[id].march));assert(other.members.some(id=>a.c.clock.units[id].march));
});
test('same-corps concurrent replacement and foreign controller rejected; regroup invalidates generations',async()=>{
 const a=new CampaignAdapter(),g=a.c.clock.corps[0],oldPause=op(a,'b',{type:'PAUSE_GROUP',groupId:g.permanentId});await a.submit('a',op(a,'a',{type:'ORDER',groupId:g.permanentId,order:advance}));assert.equal((await a.submit('b',oldPause)).reason,'COMMAND_GENERATION_CHANGED');
 const old=g.commandGeneration,dest=a.c.clock.corps[1];await a.submit('a',op(a,'a',{type:'ASSIGN',unit:g.members[0],groupId:dest.permanentId}));assert(g.commandGeneration>old);assert(dest.commandGeneration>0);
 a.c.state.units[g.members[0]].controllerId='OTHER';assert.equal((await a.submit('a',op(a,'a',{type:'PAUSE_GROUP',groupId:g.permanentId}))).reason,'UNIT_NOT_AUTHORIZED');
 const enemy=a.c.clock.corps.find(g=>g.side==='SOVIET');assert.equal((await a.submit('a',op(a,'a',{type:'ORDER',groupId:enemy.permanentId,order:advance}))).reason,'GROUP_NOT_AUTHORIZED');
});
test('authorized keyed delta reconstructs complete CityArtView; no hidden enemies or opponent private economy',async()=>{
 const a=new CampaignAdapter(),before=a.c.snapshot();assert.deepEqual(decodeView(encodeView(before)),before);const wire=await a.view('a'),own=decodeView(wire.document);assert.deepEqual(own.cities,before.cities);assert(!JSON.stringify(wire).includes('"clock":{"rules"'));
 const visible=new Set(before.game.message.payload.view.units.map(u=>u.id));assert(Object.keys(wire.document.game.message.payload.view.units).every(id=>visible.has(id)));
 a.c.clock.paused=false;await a.step();const after=await a.view('a');assert.deepEqual(patch(wire,diff(wire,after)),after);assert.equal(decodeView(after.document).game.message.payload.view.hexes.length,1280);
});
test('save contains receipts and cursor; restart/load pauses, rejects old requests and continues production once',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grand-wire-test-')),file=path.join(dir,'campaign.json'),a=new CampaignAdapter({saveFile:file});
 await a.submit('a',op(a,'a',{type:'AUTOPAUSE',enabled:false}));await a.submit('a',op(a,'a',{type:'CLOCK',paused:false,speed:4}));for(let i=0;i<23;i++)await a.step();assert.equal(a.c.econ.epoch,0);
 const old=op(a,'b',{type:'CLOCK',paused:false,speed:4});const save=command(a,'a','SAVE');assert.equal((await a.submit('a',save)).status,'APPLIED');const b=new CampaignAdapter({saveFile:file});assert.equal(b.c.clock.tick,23);assert.equal(b.c.clock.paused,true);assert(b.c.receipts.has(save.requestId));assert.equal(b.c.transport.next.a,a.c.transport.next.a);await assert.rejects(b.submit('b',old),/REPLAN/);
 await b.submit('b',op(b,'b',{type:'CLOCK',paused:false,speed:4}));await b.step();assert.equal(b.c.econ.epoch,1);const settled=structuredClone(b.c.econ);await b.submit('a',op(b,'a',{type:'CLOCK',paused:true,speed:4}));await b.step();assert.deepEqual(b.c.econ,settled);
 await a.step();assert.deepEqual(b.c.econ,a.c.econ);assert.deepEqual(b.c.state,a.c.state);assert.equal(b.c.clock.rng,a.c.clock.rng);
});
async function connect(service,seat,cookie){if(!cookie){const r=await fetch(service.url+`/${seat}/session`,{method:'POST',headers:{origin:service.url}});cookie=r.headers.get('set-cookie').split(';')[0];}const ws=new WebSocket(service.url.replace('http','ws')+`/${seat}/ws`,{headers:{origin:service.url,cookie}}),rows=[];ws.on('message',x=>rows.push(JSON.parse(x)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'HELLO'}));const wait=async pred=>{for(let n=0;n<800;n++){const r=rows.find(pred);if(r)return r;await sleep(10);}throw Error('wire timeout');};const welcome=await wait(x=>x.type==='WELCOME');return {ws,rows,wait,cookie,welcome,send:m=>ws.send(JSON.stringify({instanceId:welcome.instanceId,connectionEpoch:welcome.connectionEpoch,...m}))};}
test('real R1 websocket window stays at eight; receipt bypasses saturation; reconnect and stale stream isolated',async()=>{
 const s=await start({port:0,autoTick:false,saveFile:null});try{const a=await connect(s,'a'),b=await connect(s,'b');await a.wait(x=>x.type==='STATE');await b.wait(x=>x.type==='STATE');
 for(let n=0;n<12;n++){a.send({type:'SELECT',unitId:'G-013',id:n});await sleep(25);}const conn=s.seats.get('a').connection;assert.equal(conn.outstanding.length,STATE_WINDOW);const states=a.rows.filter(x=>x.type==='STATE');assert(states.slice(1).every((x,i)=>x.baseViewVersion===states[i].viewVersion));
 const g=s.adapter.c.clock.corps[1];const cmd=op(s.adapter,'b',{type:'ORDER',groupId:g.permanentId,order:advance});b.send({type:'COMMAND',command:cmd});assert.equal((await b.wait(x=>x.type==='RESULT')).result.status,'APPLIED');
 const ca=op(s.adapter,'a',{type:'CLOCK',paused:true,speed:2});a.send({type:'COMMAND',command:ca});assert.equal((await a.wait(x=>x.type==='RESULT')).result.status,'APPLIED');assert.equal(conn.outstanding.length,8);
 a.send({type:'RESYNC',stream:1});const full=await a.wait(x=>x.type==='STATE'&&x.stream===2);assert(full.full);a.send({type:'VIEW_ACK',stream:1,viewVersion:full.viewVersion});await sleep(30);assert.equal(conn.outstanding.length,1);
 const size=s.adapter.c.receipts.size,a2=await connect(s,'a',a.cookie);a2.send({type:'COMMAND',command:ca});assert.equal((await a2.wait(x=>x.type==='RESULT')).result.status,'APPLIED');assert.equal(s.adapter.c.receipts.size,size);assert(conn.closed);assert(a2.welcome.connectionEpoch>a.welcome.connectionEpoch);a2.ws.close();a.ws.close();b.ws.close();
 }finally{await s.close();}
});
test('R1 client requests one full baseline, rejects late epoch and merges before exposing CityArtView',async()=>{
 const source=fs.readFileSync(new URL('./web/client.mjs',import.meta.url),'utf8').replace("'/sync.mjs'",JSON.stringify(new URL('./sync.mjs',import.meta.url).href)).replace("'/transport/view.mjs'",JSON.stringify(new URL('./view.mjs',import.meta.url).href));const {Client}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};const c=new Client('a'),sent=[],a=new CampaignAdapter(),v=await a.view('a');c.instanceId=a.id;c.socket={readyState:1,send:s=>sent.push(JSON.parse(s))};const msg=m=>c.receive({instanceId:a.id,connectionEpoch:1,...m});msg({type:'WELCOME',nextCommandSeq:1});msg({type:'STATE',stream:1,viewVersion:1,full:v});assert.equal(c.document().cities.items.length,a.c.snapshot().cities.items.length);
 for(const n of [3,4])msg({type:'STATE',stream:1,viewVersion:n,baseViewVersion:n-1,change:{set:[],remove:[]}});assert.equal(sent.filter(m=>m.type==='RESYNC').length,1);msg({type:'STATE',stream:2,viewVersion:5,full:v});msg({type:'STATE',connectionEpoch:0,stream:99,viewVersion:999,full:{revision:-1}});assert.equal(c.view.revision,v.revision);assert.equal(c.stream,2);msg({type:'QUERY_RESULT',id:'read-only',revision:v.revision,payload:{large:'x'.repeat(500000)}});assert(!JSON.stringify(c.events).includes('large'));assert(c.events.some(e=>e.type==='query'));
});

test('explicit load rotates era, discards later intents and restores shared payment ledger without replay',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'grand-wire-load-')),a=new CampaignAdapter({saveFile:path.join(dir,'save.json')});
 const g=a.c.clock.corps[0];await a.submit('a',op(a,'a',{type:'ORDER',groupId:g.permanentId,order:advance}));
 await a.submit('a',command(a,'a','SAVE'));const savedEconomy=structuredClone(a.c.econ),savedId=g.permanentId;
 const stale=op(a,'b',{type:'PAUSE_GROUP',groupId:g.permanentId});const oldEra=a.era;
 await a.submit('a',op(a,'a',{type:'CLOCK',paused:false,speed:4}));await a.step();
 const load=command(a,'a','LOAD');assert.equal((await a.submit('a',load)).status,'APPLIED');assert.notEqual(a.era,oldEra);assert.equal(a.c.clock.tick,0);assert(a.c.clock.paused);assert.equal(a.c.clock.corps[0].permanentId,savedId);assert.deepEqual(a.c.econ,savedEconomy);
 await assert.rejects(a.submit('b',stale),/REPLAN/);await assert.rejects(a.submit('a',load),/REPLAN/);assert.equal(a.c.clock.tick,0);assert.deepEqual(a.c.econ,savedEconomy);
});

test('replaced client yields its seat instead of reconnecting over the new controller',async()=>{
 const source=fs.readFileSync(new URL('./web/client.mjs',import.meta.url),'utf8').replace("'/sync.mjs'",JSON.stringify(new URL('./sync.mjs',import.meta.url).href)).replace("'/transport/view.mjs'",JSON.stringify(new URL('./view.mjs',import.meta.url).href));const {Client}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const oldSocket=globalThis.WebSocket,oldLocation=globalThis.location;globalThis.location={origin:'http://127.0.0.1:4220'};globalThis.WebSocket=class {close(){} };globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
 try{const c=new Client('a');c.connect();c.socket.onclose({reason:'REPLACED'});assert(c.disposed);assert.equal(c.retryTimer,null);assert(c.events.some(e=>e.type==='replaced'));}finally{globalThis.WebSocket=oldSocket;globalThis.location=oldLocation;}
});
