import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateChain,nextHint,OPS} from '../chain-view.mjs';
// Captured from this UI's actual 49-operation HTTP run, not used by the production page.
const evidence=JSON.parse(await readFile(new URL('../evidence-006/BROWSER.json',import.meta.url),'utf8'));
const views=evidence.views;
test('all actual 018 views validate without mutation; exactly seven business intents',()=>{
 assert.equal(OPS.length,7);
 for(const s of views){const before=JSON.stringify(s);validateChain(s);assert.equal(JSON.stringify(s),before);}
});
test('unknown extension and missing account, progress or any operation fail closed',()=>{
 const last=views.at(-1),unknown=structuredClone(last);unknown.extensions.industry018.schema='industry-018-chain.v999';assert.throws(()=>validateChain(unknown),/未知/);
 for(const change of [s=>delete s.extensions,s=>delete s.extensions.industry018.accountStatus,s=>delete s.extensions.industry018.production.workCompleted,...OPS.map(([,op])=>s=>delete s.operations[op])]){
  const s=structuredClone(last);change(s);assert.throws(()=>validateChain(s));
 }
});
test('T5 and T7 guidance does not substitute automatic business for phase clicks',()=>{
 assert.match(nextHint(views[0]),/先领取原拨款并下单/);
 assert.match(nextHint(views.find(s=>s.version===22)),/先启用后备池并申请/);
 assert.match(nextHint(views.find(s=>s.version===37)),/先支付照管/);
});
test('settlement and terminal guidance follow actual phase and recovery state',()=>{
 assert.match(nextHint(views.find(s=>s.version===8)),/E5结算.*生产/);
 assert.match(nextHint(views.find(s=>s.version===18)),/E6结算.*生产/);
 assert.match(nextHint(views.find(s=>s.version===44)),/E8结算.*前送及部队维护/);
 assert.match(nextHint(views.at(-1)),/恢复已完成.*T9/);
});
