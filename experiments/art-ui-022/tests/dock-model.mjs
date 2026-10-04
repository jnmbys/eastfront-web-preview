import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const here=path.resolve(import.meta.dirname,'..'),out=path.resolve(here,'../../evidence/ART-UI-022');
const original=pathToFileURL(path.resolve(here,'../industry-ui-001/chain-view.mjs')).href;
const code=fs.readFileSync(path.join(here,'chain-view.mjs'),'utf8').replace("from '/chain-view.mjs'",'from '+JSON.stringify(original));
const {dockModel}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const views=JSON.parse(fs.readFileSync(path.join(out,'BROWSER.json'))).views;
const get=n=>dockModel(views.find(v=>v.version===n));
for(const s of views){const before=JSON.stringify(s),m=dockModel(s);assert(!JSON.stringify(m).match(/undefined|NaN/));assert.equal(JSON.stringify(s),before);}
assert.equal(get(0).stock,'0P / 0 E2');assert.equal(get(0).personBudget,'未启用');assert.equal(get(0).mode,'order');
assert.equal(get(37).stock,'1P + 2 E2');assert.equal(get(37).personBudget,'余 0I · 已支 2I');assert.match(get(37).expiry,/尚未支付.*余4I/);
assert.equal(get(38).personBudget,get(37).personBudget);assert.match(get(38).cost,/已付照管 1I/);assert.match(get(38).expiry,/E9结束/);
assert.equal(get(45).object,'C10');assert.equal(get(49).object,'C10');assert.equal(get(49).stock,'物资已消费');
const result={passed:true,realViewsChecked:views.length,checks:['No speculative/undefined values across complete real chain','Model does not mutate public states','T5 empty stock and unactivated personnel account','T8 before/after care remain distinct; independent account unchanged','Front receipt/consumed material remains at C10'],scope:'Presentation-only checks after original real HTTP chain. No additional backend transactions.'};
fs.writeFileSync(path.join(out,'DOCK-CHECKS.json'),JSON.stringify(result,null,2)+'\n');console.log({passed:true,views:views.length});
