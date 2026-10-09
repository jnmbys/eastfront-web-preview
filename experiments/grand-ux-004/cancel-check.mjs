import assert from 'node:assert/strict';
import {Campaign} from '../grand-release-001/territory.mjs';
import {CampaignAdapter} from '../grand-play-mp022/adapter.mjs';
import {GrandPort} from '../../.release-territory-preview/src/playable/grand.js';
const a=new CampaignAdapter({CampaignClass:Campaign,restore:false}),p=new GrandPort(()=>{},true);let seq=0,request;
p.wire={submit(kind,payload,keys,dependencies){request={instanceId:a.id,era:a.era,commandSeq:++seq,requestId:'ux004-cancel-'+seq,kind,payload,dependencies};return request.requestId;}};
const group=a.c.clock.corps[0];
async function issue(op){p.data=(await a.view('a')).document;await p.operation(op);const r=await a.submit('a',request);assert.equal(r.status,'APPLIED',r.reason);return structuredClone(request);}
await issue({type:'ORDER',group:group.id,order:{kind:'ADVANCE',target:{q:25,r:5},front:[a.c.state.units[group.members[0]].hex],risk:'NORMAL',paused:false,planAdvance:true}});
const paused=await issue({type:'ORDER',group:group.id,order:{...group.order,paused:true}});assert.equal(paused.payload.type,'PAUSE_GROUP');assert(group.order.planAdvance&&group.order.paused);
const cancelled=await issue({type:'ORDER',group:group.id,replacePausedOrder:true,order:{kind:'REFIT',target:group.order.target,risk:'NORMAL',paused:true}});assert.equal(cancelled.payload.type,'ORDER');assert(!('replacePausedOrder' in cancelled.payload));assert.equal(group.order.kind,'REFIT');assert(group.order.paused);assert(!group.order.front&&!group.order.planAdvance);
await issue({type:'ORDER',group:group.id,order:{...group.order,paused:false}});assert.equal(group.order.kind,'REFIT');assert(!group.order.planAdvance);
console.log('PASS: original pause retains plan; explicit cancel atomically replaces paused order under existing generation checks; resume cannot resurrect offensive plan.');
