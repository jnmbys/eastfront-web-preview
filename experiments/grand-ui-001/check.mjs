import fs from 'node:fs';import {gunzipSync} from 'node:zlib';import assert from 'node:assert/strict';
import {Campaign} from '../grand-unit-001/authority.mjs';
import {commandSummary,commandedMembers,directMembers,commandDock} from '../../.ai003-preview/src/playable/commandInterface.js';
import {controlRegions} from '../../.ai003-preview/src/playable/controlRegions.js';
import {statusBars,ownStatus} from '../../.ai003-preview/src/playable/unitStatus.js';
const c=new Campaign();c.restore(JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-002/mid-march.save.json.gz'))).payload).campaign);
const p={data:c.snapshot(),selections:{},notice:'',locked:false};const before=JSON.stringify(c.save());
for(const mode of ['','army','unit','battle','city','economy','alerts','settings','direct','tools']){p.selections['ui-panel']=mode;p.selections.battle=p.data.continuous.map.battles[0].id;const html=commandDock(p,'G-029','');assert.equal((html.match(/id="campaign-toggle"/g)||[]).length,1);assert.ok(html.includes('ui-corps-bar'));}
assert.equal(JSON.stringify(c.save()),before);
const co=p.data.continuous,all=co.corps.flatMap(g=>commandedMembers(co,g)),direct=directMembers(co);assert.ok(!all.some(id=>direct.includes(id)));assert.equal(new Set([...all,...direct]).size,Object.values(co.units).filter(u=>u.alive).length);
const q=structuredClone(p);q.data.warehouses=[{controlled:true,lots:[{type:'RIFLE',qty:4,availableTurn:q.data.turn},{type:'RIFLE',qty:7,availableTurn:q.data.turn+1}]},{controlled:false,lots:[{type:'RIFLE',qty:99,availableTurn:0}]}];assert.equal(commandSummary(q).stock.RIFLE,4);
const view=structuredClone(p.data.game.message.payload.view),hidden=view.hexes.find(h=>!view.identifiedHexKeys.includes(h.coord.q+','+h.coord.r));assert.ok(hidden);const ca=controlRegions(view);hidden.control=hidden.control==='GERMAN'?'SOVIET':'GERMAN';assert.deepEqual(controlRegions(view),ca);
const own=ownStatus(p,'G-020');assert.ok(statusBars(own).includes(Math.round(own.personnel)+'/300'));assert.ok(!statusBars(null).includes('unit-status-track'));
// Reuse the existing real R1 action/step sequence; UI projection must be observational.
const start=JSON.parse(JSON.parse(gunzipSync(fs.readFileSync('evidence/grand-map-r1/battle-t10.save.json.gz'))).payload).campaign,a=new Campaign(),b=new Campaign();a.restore(start);b.restore(start);let steps=0,commands=0;
for(const r of fs.readFileSync('evidence/grand-map-r1/browser-commands.jsonl','utf8').trim().split('\n').map(JSON.parse).slice(39,122)){
 if(r.kind==='OPERATION'&&r.status==='APPLIED'){for(const x of[a,b])x.transaction({id:r.requestId,version:x.version,operation:r.payload});commands++;}
 if(r.type==='step-end'&&r.changed){a.tick();b.tick();steps++;const port={...p,data:b.snapshot(),selections:{'ui-panel':'battle',battle:b.snapshot().continuous.map.battles[0]?.id??''}};commandDock(port,'G-029','');}
 assert.deepEqual(a.state,b.state);assert.deepEqual(a.econ,b.econ);assert.equal(a.clock.rng,b.clock.rng);assert.deepEqual(a.clock.engagements,b.clock.engagements);assert.deepEqual(a.fair('GERMAN'),b.fair('GERMAN'));
}
fs.writeFileSync('evidence/grand-ui-001/check.json',JSON.stringify({steps,commands,displayDoesNotMutate:true,sameAuthoritativeReplay:true,commandedAndDirectDisjoint:true,availableInventoryNoPendingDoubleCount:true,hiddenControlDoesNotAffectBorders:true,roundPersonnelOnly:true,unknownNoBars:true},null,2));console.log('PASS',steps,'steps',commands,'commands; authority/RNG/economy unchanged; UI inventory, corps, unknown control, integer display');
