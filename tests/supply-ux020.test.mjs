import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SupplyClient,supplyPanel,supplyPoints,SUPPLY_VERSION} from '../dist/app/experimental/supplyClient.js';
const data=JSON.parse(fs.readFileSync('experiments/supply-ux-020/evidence/panel-fixtures.json','utf8'));
function client(f){return {supply:structuredClone(f.packet.supply),canMutate:true,state:{snapshot:{matchRevision:f.packet.matchRevision}}};}
const html=(name,selected)=>{const f=data[name];return supplyPanel(client(f),selected??f.draft.selectedUnitId,f.draft);};
test('quarter SP, receipts and actual ledger use points without rounding',()=>{
 for(const [n,label]of [[0,'0补给点'],[1,'0.25补给点'],[2,'0.5补给点'],[3,'0.75补给点'],[4,'1补给点'],[32,'8补给点']])assert.equal(supplyPoints(n),label);
 for(const [name,cost,factor]of [['partial-025','0.25','62.5'],['partial-050','0.5','75'],['partial-075','0.75','87.5']]){
  const h=html(name);assert(h.includes(`本次消耗 ${cost}补给点`));assert(h.includes(`有效补给系数 ${factor}%`));assert(h.includes('扣费后 0补给点'));
  const f=data[name],c=client({packet:f.after});const receipt=supplyPanel(c,'G-I-01',f.draft);assert(receipt.includes(`行动消耗 ${cost}补给点`));assert(!receipt.includes('<pre'));
 }
 assert(html('funded-legal').includes('实收 2补给点'));
});
test('debt factor and pre-payment attack factor cannot be confused',()=>{
 const h=html('cleared-debt-empty-legal');assert(h.includes('当前欠账系数 100%'));assert(h.includes('有效补给系数 50%'));assert(h.includes('欠账已清，但储备不足1补给点'));
 assert(html('empty').includes('欠账折合 1补给点（D=1维护份）'));
 assert(html('debt-limits-full').includes('有效补给系数 75%'));
 assert(html('severe-debt').includes('移动上限 1'));
});
test('joint attack states per-attacker payment and different effective factors',()=>{
 const h=html('joint-mixed-payment');assert.match(h,/G-I-01 · 攻击[\s\S]*本次消耗 1补给点[\s\S]*有效补给系数 100%/);
 assert.match(h,/G-PZ-01 · 攻击[\s\S]*本次消耗 0.25补给点[\s\S]*有效补给系数 62.5%/);
});
test('missing, pending, changed draft and changed revision quotes remain unknown',()=>{
 const f=data['funded-legal'];
 for(const alter of [c=>c.canMutate=false,c=>c.state.snapshot.matchRevision++,c=>c.supply.preview.draft=null]){
  const c=client(f);alter(c);const h=supplyPanel(c,'G-I-01',f.draft);assert(h.includes('攻击有效系数：未知'));assert(!h.includes('本次攻击有效补给系数'));
 }
 const c=client(f),changed=structuredClone(f.draft);changed.attackUnitIds=['G-PZ-01'];assert(supplyPanel(c,'G-PZ-01',changed).includes('攻击有效系数：未知'));
 const before=structuredClone(c);for(let i=0;i<3;i++)supplyPanel(c,'G-I-01',f.draft);assert.deepEqual(c,before);
});
test('old mode has no experimental effectiveness quote',()=>{
 const h=html('old-mode');assert(h.includes('不套用新补给的欠账或支付系数'));assert(!h.includes('当前欠账系数'));assert(!h.includes('本次攻击有效补给系数'));
});
test('failed query clears previous quote; no mutation or second request',async()=>{
 const f=data['funded-legal'],c=new SupplyClient();c.supply=structuredClone(f.packet.supply);c.state.snapshot={matchRevision:f.packet.matchRevision};
 const native=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('test disconnected');};
 try{
  await new Promise(resolve=>{c.subscribe(m=>{if(m?.messageType==='ROOM_ERROR')resolve();});c.send('QUERY_MATCH',{expectedRevision:f.packet.matchRevision,draft:f.draft});});
  assert.equal(calls,1);assert.equal(c.supply.preview.draft,null);assert.deepEqual(c.supply.preview.rows,[]);assert(supplyPanel(c,'G-I-01',f.draft).includes('攻击有效系数：未知'));
 }finally{globalThis.fetch=native;c.dispose();}
});
