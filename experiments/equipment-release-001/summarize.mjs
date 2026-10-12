import fs from 'node:fs';
import assert from 'node:assert/strict';
const dir='evidence/equipment-release-001/';
const read=n=>JSON.parse(fs.readFileSync(dir+n+'.json'));
const stats=rows=>{const a=rows.map(x=>typeof x==='number'?x:x.ms).sort((a,b)=>a-b);return {n:a.length,p50:a[Math.ceil(a.length*.5)-1]??null,p95:a[Math.ceil(a.length*.95)-1]??null,max:a.at(-1)??null};};
const b=read('browser-samples'),s=read('server-before-restart');
assert.deepEqual(read('after-restart'),read('before-restart'));
assert.deepEqual(read('after-resave'),read('before-restart'));
const summary={source:'0caa903579a33be35c00ef0097129c1b9666e4be',windowSeconds:(b.end-b.start)/1000,
 browser:b.network.map(x=>({side:x.side,ordinaryReceipts:stats(x.receipts.filter(r=>r.kind!=='SAVE')),saveReceipts:stats(x.receipts.filter(r=>r.kind==='SAVE')),inAdvanceDirect:stats(x.receipts.filter(r=>r.type==='DIRECT'&&r.tick>=22)),selection:stats(b.selection.filter(r=>r.side.startsWith(x.side))),selectionFailures:b.selection.filter(r=>r.side.startsWith(x.side)&&!r.correct).length})),
 service:{step:stats(s.step),view:stats(s.view),queue:stats(s.queue),save:stats(s.save),lastTick:Math.max(...s.step.map(x=>x.tick)),combatSteps:s.step.filter(x=>x.battles>0).length,maxObservedQueueDepth:Math.max(...s.queue.map(x=>x.depth??0))},
 restart:{identicalBeforeAfter:true,identicalAfterBrowserResave:true,tick:read('before-restart').tick,transitBatches:read('before-restart').recruitTransit},
 limits:['loopback Windows/IAB, not public or tablet','133.203s interaction window includes explicit pause and setup; not continuous FPS benchmark','server samples cover full run, not restricted to interaction window','DOM title latency includes automation roundtrip','screenshots only: no continuous paint/presentation trace','no memory, message-byte or long-frame measurement in this closeout']};
fs.writeFileSync(dir+'summary.json',JSON.stringify(summary,null,2));console.log(JSON.stringify(summary,null,2));

