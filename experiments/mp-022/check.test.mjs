import {test} from 'node:test';import assert from 'node:assert/strict';
import {CityAdapter} from './adapter.mjs';import {diff,patch,OrderedLink} from './sync.mjs';
const envelope=(a,side,seq,kind,payload,dependencies={},id=`test-command-${side}-${seq}`)=>({instanceId:a.id,requestId:id,commandSeq:seq,kind,payload,dependencies});
test('authorized delta removes vanished enemies and private values, cannot apply on absent base',()=>{
 const before={units:{own:{id:'own'},enemy:{id:'enemy',step:1}},city:{stock:12}},after={units:{own:{id:'own'}},city:{}};const d=diff(before,after);assert.deepEqual(patch(before,d),after);assert.ok(d.remove.some(p=>p.join('.')==='units.enemy'));assert.throws(()=>patch({}, {set:[{path:['units','enemy'],value:1}],remove:[]}));assert.throws(()=>patch({}, {set:[{path:['__proto__','x'],value:1}],remove:[]}));
});
test('actual CITY build transaction uses one ledger; identical retries cannot charge twice; seat/request/instance isolation',async()=>{
 const a=new CityAdapter(),v=await a.view('GERMAN'),d=v.cities.items.flatMap(c=>c.districts).find(d=>d.canBuild),e=envelope(a,'GERMAN',1,'BUILD',{district:d.id},{account:v.accountStamp});
 const first=await a.submit('GERMAN',e);assert.equal(first.status,'APPLIED');const budget=a.c.econ.accounts.GERMAN.I;assert.deepEqual(await a.submit('GERMAN',e),first);assert.equal(a.c.econ.accounts.GERMAN.I,budget);assert.equal(a.c.receipts.size,1);
 await assert.rejects(a.submit('SOVIET',e),/ID_REUSE/);await assert.rejects(a.submit('GERMAN',{...e,instanceId:'old'}),/INSTANCE/);await assert.rejects(a.submit('GERMAN',{...e,payload:{district:'other'}}),/ID_REUSE/);
 const rejected=await a.submit('GERMAN',envelope(a,'GERMAN',2,'BUILD',{district:d.id},{account:v.accountStamp}));assert.equal(rejected.reason,'RESOURCE_DEPENDENCY_CHANGED');assert.equal(a.c.econ.accounts.GERMAN.I,budget);assert.deepEqual(await a.submit('GERMAN',envelope(a,'GERMAN',2,'BUILD',{district:d.id},{account:v.accountStamp})),rejected);
});
test('real movement rebases unrelated global revisions but rejects changed own dependency and foreign control',async()=>{
 const a=new CityAdapter();await a.submit('GERMAN',envelope(a,'GERMAN',1,'PHASE',{}, {phase:`${a.c.state.turn}:${a.c.state.phase}`}));
 const v=await a.view('GERMAN',{unitId:'G-026',id:1}),dest=v.legal.movement.options.find(o=>o.legal).hex;
 const other=await a.view('SOVIET'),d=other.cities.items.flatMap(c=>c.districts).find(d=>d.canBuild);
 // Unrelated authorized officer config advances global revision without changing selected unit dependency.
 const s=await a.submit('SOVIET',envelope(a,'SOVIET',1,'OFFICER',{unitId:'S-001',group:0,order:{kind:'REFIT'}},{unit:other.stamps['S-001']}));assert.equal(s.status,'APPLIED');
 const command=envelope(a,'GERMAN',2,'MOVE',{unitId:'G-026',path:[dest]},{unit:v.stamps['G-026']});const result=await a.submit('GERMAN',command);assert.equal(result.status,'APPLIED');assert.deepEqual(a.c.state.units['G-026'].hex,dest);
 const stale=await a.submit('GERMAN',envelope(a,'GERMAN',3,'MOVE',{unitId:'G-026',path:[dest]},{unit:v.stamps['G-026']}));assert.equal(stale.reason,'UNIT_DEPENDENCY_CHANGED');
 const enemy=await a.submit('GERMAN',envelope(a,'GERMAN',4,'MOVE',{unitId:'S-001',path:[dest]},{unit:other.stamps['S-001']}));assert.equal(enemy.reason,'UNIT_NOT_AUTHORIZED');
 assert.equal(a.c.receipts.get(command.requestId).result.ok,true);assert.equal(d!==undefined,true);
});
test('views stay seat-filtered; hidden changes never appear in the diff',async()=>{
 const a=new CityAdapter(),v=await a.view('GERMAN'),hidden=Object.values(a.c.state.units).find(u=>u.side==='SOVIET'&&!v.units[u.id]);assert.ok(hidden);assert.equal(v.account.initialI,a.c.econ.accounts.GERMAN.initialI);
 const before=structuredClone(v);hidden.step++;a.c.econ.accounts.SOVIET.I-=1;const after=await a.view('GERMAN');assert.deepEqual(diff(before,after),{set:[],remove:[]});assert.equal(JSON.stringify(after).includes('SOVIET-industry-3:private'),false);
});
test('officer orders execute on real authority without browser step messages; no auto phase stepping',async()=>{
 const a=new CityAdapter();await a.submit('GERMAN',envelope(a,'GERMAN',1,'PHASE',{}, {phase:`${a.c.state.turn}:${a.c.state.phase}`}));const v=await a.view('GERMAN',{unitId:'G-026',id:1}),target=v.legal.movement.options.find(x=>x.legal).hex;
 const r=await a.submit('GERMAN',envelope(a,'GERMAN',2,'OFFICER',{unitId:'G-026',group:0,order:{kind:'ATTACK',target}},{unit:v.stamps['G-026']}));assert.equal(r.status,'APPLIED');const before=structuredClone(a.c.state.units['G-026'].hex),phase=a.c.state.phase;await a.tick();assert.notDeepEqual(a.c.state.units['G-026'].hex,before);assert.equal(a.c.state.phase,phase);assert.ok(a.c.receipts.size>=3);
});
test('FIFO jitter/bandwidth and bounded memory, no arbitrary WS reorder',async()=>{
 const received=[];let overflow=0;const link=new OrderedLink({rtt:100,jitter:40,bytesPerSecond:100000},x=>received.push(x),()=>overflow++);for(let n=0;n<10;n++)link.send(String(n));await new Promise(r=>setTimeout(r,200));assert.deepEqual(received,Array.from({length:10},(_,i)=>String(i)));link.close();
 const slow=new OrderedLink({rtt:20000},()=>{},()=>overflow++);for(let i=0;i<130;i++)slow.send('x');assert.equal(slow.jobs.length,128);assert.equal(overflow,2);slow.close();
});
test('receipt capacity stops new work explicitly instead of evicting settled authority outcomes',async()=>{
 const a=new CityAdapter();for(let n=0;n<4096;n++)a.c.receipts.set(`retained-${n}`,{signature:'retained',result:{ok:true}});
 await assert.rejects(a.submit('GERMAN',envelope(a,'GERMAN',1,'PHASE',{},{})),/CAPACITY/);await a.tick();assert.equal(a.stopped,true);assert.equal(a.c.receipts.size,4096);assert.equal(a.c.version,0);
});
test('real client keeps first authorized view time when result callback is late; old connection and duplicate completion ignored',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('./web/client.mjs',import.meta.url),'utf8').replace("'/sync.mjs'",JSON.stringify(new URL('./sync.mjs',import.meta.url).href));
 const {Client}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));const values=new Map();Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}});
 const c=new Client('a'),sent=[];c.instanceId='instance';c.socket={readyState:1,send:x=>sent.push(JSON.parse(x))};c.receive({type:'WELCOME',instanceId:'instance',connectionEpoch:1,nextCommandSeq:1});
 c.receive({type:'STATE',instanceId:'instance',connectionEpoch:1,viewVersion:1,full:{instanceId:'instance',revision:0,stamps:{u:'stamp'},accountStamp:'account',turn:1,phase:'MOVE'},results:[]});
 const id=c.submit('MOVE',{unitId:'u',path:[{q:1,r:0}]},['unit:u']);assert.equal(c.submit('MOVE',{unitId:'u',path:[{q:1,r:0}]},['unit:u']),id);assert.equal(sent.filter(s=>s.type==='COMMAND').length,1);
 c.receive({type:'STATE',instanceId:'instance',connectionEpoch:1,viewVersion:2,baseViewVersion:1,change:{set:[{path:['revision'],value:1}],remove:[]},results:[]});const actual=c.viewTimes.at(-1).at;
 await new Promise(r=>setTimeout(r,20));const result={requestId:id,commandSeq:1,status:'APPLIED',acceptedRevision:1};c.receive({type:'RESULT',instanceId:'instance',connectionEpoch:1,result});assert.equal(c.history[0].viewAvailableAt,actual);assert.ok(c.history[0].resultAt>actual);assert.equal(c.pending.size,0);
 c.receive({type:'RESULT',instanceId:'instance',connectionEpoch:1,result});c.receive({type:'STATE',instanceId:'instance',connectionEpoch:0,viewVersion:99,full:{revision:0}});assert.equal(c.view.revision,1);assert.equal(c.history.length,1);
});
test('real authority rolls back rejected officer config and does not leak its plan to opponent',async()=>{
 const a=new CityAdapter(),before=structuredClone(a.c.delegation.seats),unit=a.stamp('GERMAN','G-026');
 const bad=await a.submit('GERMAN',envelope(a,'GERMAN',1,'OFFICER',{unitId:'G-026',group:0,order:{kind:'ATTACK',target:{q:999,r:999}}},{unit}));assert.equal(bad.status,'REJECTED');assert.deepEqual(a.c.delegation.seats,before);
 const ok=await a.submit('GERMAN',envelope(a,'GERMAN',2,'OFFICER',{unitId:'G-026',group:0,order:{kind:'REFIT'}},{unit}));assert.equal(ok.status,'APPLIED');const enemy=await a.view('SOVIET');assert.ok(enemy.officers.groups.every(g=>!g.order));assert.ok(!a.pending('SOVIET').length);
});
test('reconnect replays actual command sequence, not local planning insertion order',async()=>{
 const {readFileSync}=await import('node:fs');const source=readFileSync(new URL('./web/client.mjs',import.meta.url),'utf8').replace("'/sync.mjs'",JSON.stringify(new URL('./sync.mjs',import.meta.url).href));const {Client}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});const c=new Client('a'),sent=[];c.instanceId='i';c.socket={readyState:1,send:x=>sent.push(JSON.parse(x))};c.receive({type:'WELCOME',instanceId:'i',connectionEpoch:1,nextCommandSeq:1});
 c.receive({type:'STATE',instanceId:'i',connectionEpoch:1,viewVersion:1,full:{revision:0,stamps:{u:'u',v:'v'},accountStamp:'a',turn:1,phase:'MOVE'},results:[]});
 const first=c.submit('MOVE',{unitId:'u',path:[{q:1,r:0}]},['unit:u']);const queued=c.submit('MOVE',{unitId:'u',path:[{q:2,r:0}]},['unit:u']);const independent=c.submit('MOVE',{unitId:'v',path:[{q:1,r:0}]},['unit:v']);assert.equal(c.pending.get(queued).command.commandSeq,null);assert.equal(c.pending.get(independent).command.commandSeq,2);
 c.receive({type:'STATE',instanceId:'i',connectionEpoch:1,viewVersion:2,baseViewVersion:1,change:{set:[{path:['revision'],value:1}],remove:[]},results:[{requestId:first,commandSeq:1,status:'APPLIED',acceptedRevision:1}]});assert.equal(c.pending.get(queued).command.commandSeq,3);
 assert.deepEqual([...c.pending.values()].map(r=>r.command.commandSeq),[3,2]);sent.length=0;c.receive({type:'WELCOME',instanceId:'i',connectionEpoch:2,nextCommandSeq:2});assert.deepEqual(sent.filter(m=>m.type==='COMMAND').map(m=>m.command.commandSeq),[2,3]);
});
