import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {Campaign} from './authority.mjs';import {Campaign as Base} from '../grand-play-001/authority.mjs';import {assignFront,validateFront} from './front.mjs';import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
import {controlRegions} from '../../.ai003-preview/src/playable/controlRegions.js';
import {getNeighbors,hexKey} from '../../vendor/eastfront-digital-core/dist/index.js';
const setup=c=>{for(const g of c.clock.corps.filter(g=>g.side==='GERMAN'))g.order={kind:'ADVANCE',target:{q:25,r:4},risk:'NORMAL',paused:false};c.clock.paused=false;c.clock.autopause=false;};
test('private enemy condition never enters either side battle panel; identical authorized facts produce identical DTO',()=>{
 const c=new Campaign();setup(c);for(let i=0;i<9;i++)c.tick();assert(c.snapshot().continuous.map.battles.length);
 const before=c.snapshot().continuous.map;for(const [id,u]of Object.entries(c.clock.units))if(c.state.units[id].side==='SOVIET'){u.org=1;u.personnel=1;c.econ.supply[id].stock=0;}
 assert.deepEqual(c.snapshot().continuous.map,before);
 c.viewer='SOVIET';for(const b of c.snapshot().continuous.map.battles)for(const u of b.participants)if(u.side==='GERMAN'){assert.equal(u.org,null);assert.equal(u.supply,null);assert.equal(u.equipment,null);}
});
test('control edges remove internal seams; one-hex enclave and unknown/neutral remain distinct',()=>{
 const center={q:0,r:0},hexes=[center,...getNeighbors(center)].map(coord=>({coord,control:hexKey(coord)==='0,0'?'SOVIET':'GERMAN'})),view={hexes,identifiedHexKeys:hexes.map(h=>hexKey(h.coord))};
 assert.equal(Object.keys(controlRegions(view).edges).length,6);hexes[0].control='GERMAN';assert.equal(Object.keys(controlRegions(view).edges).length,0);
 hexes[0].control=null;assert.equal(Object.keys(controlRegions(view).edges).length,6);assert(controlRegions(view).fills.NEUTRAL);view.identifiedHexKeys=view.identifiedHexKeys.filter(k=>k!=='0,0');assert(!controlRegions(view).fills.NEUTRAL);assert(Object.values(controlRegions(view).edges).every(e=>e.unknown));
});
test('front bounded, connected, authorized-only allocation excludes direct and balances targets',()=>{
 const c=new Campaign(),g=c.clock.corps[0],view=c.fair('GERMAN').view;g.order.front=[{q:23,r:4},{q:24,r:4},{q:25,r:4}];validateFront(g.order.front,view);
 assert.throws(()=>validateFront([{q:1,r:1},{q:20,r:1}],view));assert.throws(()=>validateFront(Array(9).fill({q:23,r:4}),view));
 c.clock.units[g.members[0]].direct={paused:true};const result=assignFront(view,g,c.clock.units);assert(!result.assigned[g.members[0]]);assert.equal(Object.keys(result.assigned).length,5);assert.equal(new Set(Object.values(result.assigned).map(hexKey)).size,3);
 const before=JSON.stringify(result);for(const u of Object.values(c.state.units).filter(u=>u.side==='SOVIET'))u.hex={q:0,r:0};assert.equal(JSON.stringify(assignFront(view,g,c.clock.units)),before);
});
test('map-only instrumentation preserves simulation; identity, visibility, end records and continuation verified',()=>{
 const c=new Campaign(),base=new Base();setup(c);setup(base);let retained=false,ended=false,previous=new Map(),first=null;
 for(let n=0;n<55;n++){c.tick();base.tick();assert.deepEqual(c.state,base.state);assert.deepEqual(c.econ,base.econ);assert.equal(c.clock.rng,base.clock.rng);
  const d=c.snapshot(),m=d.continuous.map,visible=new Set(d.game.message.payload.view.units.map(u=>u.id));
  for(const b of m.battles){if(previous.has(b.id)){assert(b.ticks>previous.get(b.id));retained=true;}for(const u of b.participants){assert(visible.has(u.id));if(u.side!=='GERMAN'){assert.equal(u.org,null);assert.equal(u.equipment,null);}}}previous=new Map(m.battles.map(b=>[b.id,b.ticks]));if(m.battles.length&&!first)first=c.save();if(m.history.length)ended=true;
 }
 assert(retained);assert(ended);assert(first);const loaded=new Campaign();loaded.restore(first);assert(loaded.clock.paused);assert.deepEqual(loaded.snapshot().continuous.map.battles,(()=>{const other=new Campaign();other.restore(first);return other.snapshot().continuous.map.battles;})());
 assert.throws(()=>c.transaction({id:crypto.randomUUID(),version:c.version,operation:{type:'DIRECT',unit:'G-013',battleId:'nonexistent',order:{kind:'HOLD',target:{q:22,r:5},risk:'LOW',paused:true}}}),/BATTLE_ENDED/);
 fs.mkdirSync('evidence/grand-map-001',{recursive:true});fs.writeFileSync('evidence/grand-map-001/simulation.json',JSON.stringify({ticks:c.clock.tick,retained,ended,active:c.snapshot().continuous.map.battles,history:c.snapshot().continuous.map.history,metrics:c.clock.metrics,controlChanges:c.clock.history.map(h=>({tick:h.tick,controls:h.controls})),scope:'Offline natural simulation; no fixtures. State/economy/RNG equal baseline without front orders.'},null,2));
});
test('front order through generation-checked adapter; restart retains battle IDs and corps segment without duplicate settlement',async()=>{
 const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'grand-map-')),'save.json'),a=new CampaignAdapter({CampaignClass:Campaign,saveFile:file}),g=a.c.clock.corps[0];
 const send=(type,payload,deps={})=>a.submit('a',{instanceId:a.id,era:a.era,requestId:crypto.randomUUID(),commandSeq:a.c.transport.next.a,kind:type,payload,dependencies:deps});
 const front=[{q:23,r:4},{q:24,r:4}];assert.equal((await send('OPERATION',{type:'ORDER',groupId:g.permanentId,order:{kind:'HOLD',target:front[0],front,risk:'LOW',paused:false}},{commandGeneration:g.commandGeneration})).status,'APPLIED');
 a.c.clock.paused=false;a.c.clock.autopause=false;for(let i=0;i<26;i++)await a.step();assert.equal((await send('SAVE',{})).status,'APPLIED');const b=new CampaignAdapter({CampaignClass:Campaign,saveFile:file});assert(b.c.clock.paused);assert.deepEqual(b.c.clock.corps[0].order.front,front);assert.deepEqual(b.c.clock.map,a.c.clock.map);assert.deepEqual(b.c.econ,a.c.econ);const before=JSON.stringify(b.c.econ);await b.step();assert.equal(JSON.stringify(b.c.econ),before);
 a.c.clock.paused=false;b.c.clock.paused=false;await a.step();await b.step();assert.deepEqual(b.c.econ,a.c.econ);assert.deepEqual(b.c.state,a.c.state);
});
