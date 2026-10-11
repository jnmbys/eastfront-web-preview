import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Campaign,RoomAdapter} from './authority.mjs';
import {Campaign as R1} from '../blackice-001/r1-campaign.mjs';
import {diff,patch,canonical} from '../grand-play-mp022/sync.mjs';
const a=new RoomAdapter({CampaignClass:Campaign});a.c.clock.room={id:randomUUID(),members:{a:'test-a',b:'test-b'},started:true};a.connected={a:true,b:true};
const clean=v=>{const d=structuredClone(v.document);delete d.ms;delete d.release;delete d.game.message.payload.serverSequence;return d;},results=[];
for(const seat of ['a','b']){
 const side=a.seat(seat),enemy=side==='GERMAN'?'SOVIET':'GERMAN';const before=await a.view(seat),visible=new Set(Object.keys(before.document.game.message.payload.view.units));
 const hidden=Object.values(a.c.state.units).find(u=>u.side===enemy&&u.alive&&!visible.has(u.id));assert(hidden,'normal scenario must contain hidden enemy');
 const saved=a.c.save(),v=a.c.clock.units[hidden.id],u=a.c.clock.divisionLedger.units[hidden.id];
 v.org=13.271828;v.personnel=345.271828;u.org=7.271828;u.personnel=345.271828;u.held.infantry_equipment_1=17;
 a.c.econ.modern.nations[enemy].stock.infantry_equipment_1+=12345;a.c.clock.room.members[seat==='a'?'b':'a']='changed-private-binding';
 const after=await a.view(seat);assert.deepEqual(clean(after),clean(before),'enemy private fields must not alter authorized snapshot');
 const delta=diff(before,after,[],undefined,true);assert.deepEqual(patch(before,delta),after);assert(!JSON.stringify(delta).includes('271828'));assert(!JSON.stringify(after).includes('changed-private-binding'));
 a.c.restore(saved,false);results.push(`${side}: hidden personnel/org/equipment/inventory/member binding do not affect snapshot or delta`);
 const own=Object.values(a.c.state.units).find(u=>u.alive&&u.side===side);a.c.state.units[hidden.id].hex=structuredClone(own.hex);
 const revealed=await a.view(seat);assert(revealed.document.game.message.payload.view.units[hidden.id]);
 assert(!revealed.document.game.message.payload.view.units[hidden.id].friendly);
 a.c.state.units[hidden.id].hex=structuredClone(saved.state.units[hidden.id].hex);
 const revoked=await a.view(seat);assert(!revoked.document.game.message.payload.view.units[hidden.id]);
 const revokeDelta=diff(revealed,revoked,[],undefined,true);assert.deepEqual(patch(revealed,revokeDelta),revoked);assert(!patch(revealed,revokeDelta).document.game.message.payload.view.units[hidden.id]);a.c.restore(saved,false);
 results.push(`${side}: visible enemy revocation removes current object through ordered delta; no private friendly fields`);
}
// Viewer scope spans awaits; queued requests cannot change another seat's context.
const old=a.c.viewer;let release;const gate=new Promise(r=>release=r);const one=a.forSeat('b',async()=>{assert.equal(a.c.viewer,'SOVIET');await gate;assert.equal(a.c.viewer,'SOVIET');});const two=a.view('a');release();await one;assert.equal((await two).document.viewer,'GERMAN');assert.equal(a.c.viewer,old);
let unblock;const blocked=a.exclusive(()=>new Promise(r=>unblock=r));await new Promise(r=>setTimeout(r,1));let live=true;const d=new RoomAdapter({CampaignClass:Campaign}).c.save(); // detached old save remains non-room
const cmd={instanceId:a.id,era:a.era,requestId:randomUUID(),commandSeq:a.c.transport.next.a,kind:'SAVE',payload:{},dependencies:{}};
const late=a.submit('a',cmd,()=>live);live=false;unblock();await blocked;await assert.rejects(late,/CONNECTION_REPLACED/);assert(!a.c.receipts.has(cmd.requestId));results.push('queued old connection guard, async seat context and viewer restoration');
assert.throws(()=>a.c.restore(d),/MULTIPLAYER_ROOM_SAVE_REQUIRED/);const single=new R1();assert.throws(()=>a.c.restore(single.save()),/MULTIPLAYER_ROOM_SAVE_REQUIRED/);results.push('old single-player save is not silently admitted as a room');
// Rule functions are inherited unchanged; human scheduling replaces only global AI.
assert.equal(Campaign.prototype.resolveDivisionCombat,R1.prototype.resolveDivisionCombat);assert.equal(Campaign.prototype.restOrgRate,R1.prototype.restOrgRate);assert.equal(Campaign.prototype.economyStep,R1.prototype.economyStep);assert.deepEqual(a.c.tacticalPolicyOptions,{preserveRecoveryOnReplan:true});
results.push('same R1 combat/economy/recovery functions; no battle parameter changes');
fs.mkdirSync('evidence/blackice-mp-001',{recursive:true});fs.writeFileSync('evidence/blackice-mp-001/privacy.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,results},null,2));
