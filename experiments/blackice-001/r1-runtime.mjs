// Independent local visitor, no user credentials/saves are read or printed.
import fs from 'node:fs';import assert from 'node:assert/strict';import WebSocket from 'ws';
const origin='http://127.0.0.1:4275';
const http=(p,cookie='',method='GET',extra={})=>fetch(origin+p,{method,headers:{origin,cookie,...extra},redirect:'manual'});
const initial=await http('/');assert.equal(initial.status,200);assert.equal((await http('/campaigns')).status,401);
const admission=await http('/visitor/start','','POST');assert.equal(admission.status,303);const cookie=admission.headers.get('set-cookie').split(';')[0];
const menu=await http('/campaigns',cookie),html=await menu.text();assert.equal(menu.status,200);for(const mode of ['blackice','blackice-r1'])assert(html.includes('campaign='+mode));
const rows=[];
for(const [mode,rule] of [['blackice','BLACKICE-001-LAND-1'],['blackice-r1','BLACKICE-001-LAND-1-R1']]){
 const response=await http('/release/info?campaign='+mode,cookie),info=await response.json();assert.equal(response.status,200);assert(info.paused);assert.equal(info.tick,0);assert.equal(info.build.dirty,false);
 const seat=await http('/a/session?campaign='+mode,cookie,'POST',{'X-Grand-Protocol':'GRAND-RELEASE-TERRITORY-1'});assert.equal(seat.status,200);
 const ws=new WebSocket(origin.replace('http','ws')+'/a/ws?campaign='+mode,{headers:{origin,cookie:cookie+'; '+seat.headers.get('set-cookie').split(';')[0]}});
 const state=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{ws.terminate();reject(Error('STATE_TIMEOUT'));},15000);let welcome;ws.on('error',reject);ws.on('open',()=>ws.send(JSON.stringify({type:'HELLO'})));ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='WELCOME')welcome=m;if(m.type==='STATE'&&m.full){ws.send(JSON.stringify({type:'VIEW_ACK',instanceId:welcome.instanceId,connectionEpoch:welcome.connectionEpoch,stream:m.stream,viewVersion:m.viewVersion}));clearTimeout(timeout);resolve(m.full);}});});
 assert.equal(state.document.continuous.rules,rule);ws.terminate();
 rows.push({mode,rules:rule,tick:info.tick,paused:info.paused,source:info.build.source,buildDirty:info.build.dirty,authorizedStateReceived:true});
}
const result={kind:'HTTP admission and actual WS authority state; no browser rendering claim',entry:origin+'/',root:initial.status,unauthenticatedMenu:401,authenticatedMenu:menu.status,independentVisitor:true,rows,identityPrinted:false};
fs.writeFileSync('evidence/blackice-001-r1/runtime.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
