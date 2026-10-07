import {test} from 'node:test';import assert from 'node:assert/strict';import WebSocket from 'ws';
import {CityAdapter} from './adapter.mjs';import {start,STATE_WINDOW} from './server.mjs';
import {readFileSync} from 'node:fs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
test('client requests one full recovery, ignores obsolete stream and late epoch without state rollback',async()=>{
 const source=readFileSync(new URL('./web/client.mjs',import.meta.url),'utf8').replace("'/sync.mjs'",JSON.stringify(new URL('./sync.mjs',import.meta.url).href)),{Client}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{}}});const c=new Client('a'),sent=[];c.instanceId='i';c.socket={readyState:1,send:x=>sent.push(JSON.parse(x))};const msg=m=>c.receive({instanceId:'i',connectionEpoch:1,...m});msg({type:'WELCOME',nextCommandSeq:1});msg({type:'STATE',stream:1,viewVersion:1,full:{revision:1}});
 msg({type:'STATE',stream:1,viewVersion:3,baseViewVersion:2,change:{set:[],remove:[]}});msg({type:'STATE',stream:1,viewVersion:4,baseViewVersion:3,change:{set:[],remove:[]}});assert.equal(sent.filter(x=>x.type==='RESYNC').length,1);assert.equal(c.view.revision,1);
 msg({type:'STATE',stream:2,viewVersion:5,full:{revision:4}});msg({type:'STATE',stream:1,viewVersion:99,full:{revision:0}});msg({type:'STATE',connectionEpoch:0,stream:99,viewVersion:999,full:{revision:0}});assert.equal(c.view.revision,4);assert.equal(c.version,5);assert.equal(c.resyncPending,false);assert.equal(c.stream,2);
});
function cmd(a,side,kind,payload,dependencies){const seq=a.c.transport.next[side];return {instanceId:a.id,requestId:`r1-${side}-${seq}`,commandSeq:seq,kind,payload,dependencies};}
async function setup(){const a=new CityAdapter();await a.submit('GERMAN',cmd(a,'GERMAN','PHASE',{}, {phase:`${a.c.state.turn}:${a.c.state.phase}`}));const v=await a.view('GERMAN',{unitId:'G-026'}),target=v.legal.movement.options.find(x=>x.legal).hex;await a.submit('GERMAN',cmd(a,'GERMAN','OFFICER',{unitId:'G-026',group:0,order:{kind:'ATTACK',target}},{unit:v.stamps['G-026']}));return a;}
test('pause survives completed and in-flight real officer movement; retries reuse authority receipt; no subsequent officer start',async()=>{
 const a=await setup(),v=await a.view('GERMAN'),g=v.officers.groups[0],pause=cmd(a,'GERMAN','PAUSE',{groupId:g.permanentId},{commandGeneration:g.commandGeneration}),before=a.stamp('GERMAN','G-026');
 const work=a.tick(),resultPromise=a.submit('GERMAN',pause);await work;const result=await resultPromise;
 assert.notEqual(a.stamp('GERMAN','G-026'),before);assert.equal(result.status,'APPLIED');const revision=a.revision,size=a.c.receipts.size;assert.deepEqual(await a.submit('GERMAN',pause),result);assert.equal(a.c.receipts.size,size);
 const finish=a.trace.find(x=>x.type==='officer-end');assert.ok(finish.operation<result.operation);assert.ok(finish.at<=result.timing.startedAt);await a.tick();await a.tick();assert.equal(a.revision,revision);assert.equal(a.trace.filter(x=>x.type==='officer-start').length,1);
});
test('new order or regroup invalidates old pause; foreign group control rejected',async()=>{
 const a=await setup(),v=await a.view('GERMAN'),old=v.officers.groups[0];
 await a.submit('GERMAN',cmd(a,'GERMAN','OFFICER',{unitId:'G-026',group:0,order:{kind:'REFIT'}},{unit:v.stamps['G-026']}));
 assert.equal((await a.submit('GERMAN',cmd(a,'GERMAN','PAUSE',{groupId:old.permanentId},{commandGeneration:old.commandGeneration}))).reason,'COMMAND_GENERATION_CHANGED');
 const current=(await a.view('GERMAN')).officers.groups[0];
 assert.equal((await a.submit('SOVIET',cmd(a,'SOVIET','PAUSE',{groupId:current.permanentId},{commandGeneration:current.commandGeneration}))).reason,'GROUP_NOT_AUTHORIZED');
 await a.submit('GERMAN',cmd(a,'GERMAN','OFFICER',{unitId:'G-027',group:0,order:{kind:'REFIT'}},{unit:a.stamp('GERMAN','G-027')}));
 assert.equal((await a.submit('GERMAN',cmd(a,'GERMAN','PAUSE',{groupId:current.permanentId},{commandGeneration:current.commandGeneration}))).reason,'COMMAND_GENERATION_CHANGED');
 assert.equal((await a.view('GERMAN')).officers.groups[0].paused,false);
 const latest=(await a.view('GERMAN')).officers.groups[0];a.c.state.units['G-026'].controllerId='other-controller';
 assert.equal((await a.submit('GERMAN',cmd(a,'GERMAN','PAUSE',{groupId:latest.permanentId},{commandGeneration:latest.commandGeneration}))).reason,'GROUP_NOT_AUTHORIZED');
});
async function connect(service,seat){const response=await fetch(service.url+`/${seat}/session`,{method:'POST',headers:{origin:service.url}}),cookie=response.headers.get('set-cookie').split(';')[0];const ws=new WebSocket(service.url.replace('http','ws')+`/${seat}/ws`,{headers:{origin:service.url,cookie}}),rows=[];ws.on('message',x=>rows.push(JSON.parse(x)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'HELLO'}));const wait=async fn=>{for(let n=0;n<400;n++){const result=rows.find(fn);if(result)return result;await sleep(10);}throw Error('timeout');};const welcome=await wait(x=>x.type==='WELCOME');return {ws,rows,wait,send:m=>ws.send(JSON.stringify({instanceId:welcome.instanceId,connectionEpoch:welcome.connectionEpoch,...m}))};}
test('bounded chained state window, independent seat, business receipts bypass full window, old-stream ACK cannot release resync',async()=>{
 const s=await start({port:0,autoTick:false});try{const a=await connect(s,'a'),b=await connect(s,'b');await a.wait(x=>x.type==='STATE');await b.wait(x=>x.type==='STATE');
 for(let n=0;n<12;n++){a.send({type:'SELECT',unitId:'G-026',id:n+1});await sleep(30);}
 const c=s.seats.get('a').connection;assert.equal(c.outstanding.length,STATE_WINDOW);const states=a.rows.filter(x=>x.type==='STATE');assert.equal(states.length,STATE_WINDOW);assert.ok(states.slice(1).every((x,i)=>!x.full&&x.baseViewVersion===states[i].viewVersion));
 b.send({type:'SELECT',unitId:'S-001',id:9});await b.wait(x=>x.type==='STATE'&&x.viewVersion===2);
 const v=states[0].full,d=v.cities.items.flatMap(x=>x.districts).find(x=>x.canBuild),e=cmd(s.adapter,'GERMAN','BUILD',{district:d.id},{account:v.accountStamp});a.send({type:'COMMAND',command:e});assert.equal((await a.wait(x=>x.type==='RESULT')).result.status,'APPLIED');assert.equal(c.outstanding.length,STATE_WINDOW);
 a.send({type:'VIEW_ACK',stream:1,viewVersion:states.at(-1).viewVersion});const combined=await a.wait(x=>x.type==='STATE'&&x.viewVersion>STATE_WINDOW);assert.equal(combined.results[0].requestId,e.requestId);
 a.send({type:'RESYNC',stream:1});const full=await a.wait(x=>x.type==='STATE'&&x.stream===2);assert.ok(full.full);a.send({type:'VIEW_ACK',stream:1,viewVersion:full.viewVersion});await sleep(40);assert.equal(c.outstanding.length,1);a.send({type:'VIEW_ACK',stream:2,viewVersion:full.viewVersion});await sleep(40);assert.equal(c.outstanding.length,0);assert.ok(c.trace.length<=2048);a.ws.close();b.ws.close();
 }finally{await s.close();}
});
