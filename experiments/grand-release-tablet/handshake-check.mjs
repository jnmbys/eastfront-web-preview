import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import net from 'node:net';
import WS from 'ws';import {releaseServer} from '../grand-release-001/server.mjs';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));
const origin=`http://127.0.0.1:${port}`,dir=fs.mkdtempSync(path.join(os.tmpdir(),'grand-handshake-'));
const s=await releaseServer({port,origin,local:true,saveDir:dir,autoTick:false});
const realFetch=globalThis.fetch;let cookie='',client;const frames=[];
globalThis.fetch=async(p,o={})=>{const r=await realFetch(new URL(p,origin),{...o,headers:{...o.headers,origin,cookie}});for(const c of r.headers.getSetCookie())cookie=c.split(';')[0];return r;};
globalThis.location={origin};globalThis.document={querySelector:()=>({content:'territory-1'})};globalThis.sessionStorage={getItem:()=>null,setItem:()=>{}};
globalThis.WebSocket=class extends WS{constructor(url){super(url,{headers:{origin,cookie}});this.on('message',b=>frames.push(JSON.parse(b)));}send(data){if(JSON.parse(data).type==='HELLO')setTimeout(()=>{if(this.readyState===1)super.send(data);},650);else super.send(data);}};
const source=fs.readFileSync(new URL('../grand-play-mp022/web/client.mjs',import.meta.url),'utf8').replace("'/transport/stateCodec.mjs'",JSON.stringify(new URL('../grand-play-mp022/web/stateCodec.mjs',import.meta.url).href)).replace("'/transport/view.mjs'",JSON.stringify(new URL('../grand-play-mp022/view.mjs',import.meta.url).href)).replace("'/sync.mjs'",JSON.stringify(new URL('../grand-play-mp022/sync.mjs',import.meta.url).href));
try{
 const {Client}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));client=new Client('a');await client.start();
 await wait(350);assert.equal(frames.length,0,'Paused authority must not push STATE before HELLO');
 for(let i=0;i<150&&!client.view;i++)await wait(30);assert(client.document()?.game.message.payload.model,'Actual client decodes first authorized snapshot');assert((await(await fetch('/transport/stateCodec.mjs')).text()).includes('MAX_STATE_BYTES'));assert.equal(client.stateEncoding,'gzip-base64-v1');
 assert.deepEqual(frames.slice(0,2).map(m=>m.type),['WELCOME','STATE_GZIP']);assert.equal(s.adapter.c.clock.tick,0);
 const count=frames.filter(m=>m.type==='WELCOME').length;client.send({type:'HELLO'});await wait(200);assert.equal(frames.filter(m=>m.type==='WELCOME').length,count,'Duplicate HELLO does not reset stream');
 const oldEpoch=client.epoch;client.disconnect();for(let i=0;i<200&&!(client.epoch>oldEpoch&&client.version>0);i++)await wait(30);assert(client.epoch>oldEpoch&&client.version>0,'Reconnect receives snapshot while paused');
 const id=client.submit('SAVE',{},['all'],{worldGeneration:s.adapter.c.transport.worldGeneration});for(let i=0;i<150&&!client.history.some(r=>r.command.requestId===id);i++)await wait(30);assert.equal(client.history.find(r=>r.command.requestId===id)?.status,'applied');assert(fs.existsSync(path.join(dir,'campaign.json')));
 console.log(JSON.stringify({status:'PASS',scope:'Actual transport Client; 650ms HELLO delay on paused authority; reconnect, duplicate HELLO, durable SAVE',firstFrames:frames.slice(0,2).map(m=>m.type),tick:s.adapter.c.clock.tick}));
}finally{client?.dispose();await s.close();}
