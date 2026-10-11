import fs from 'node:fs';import assert from 'node:assert/strict';
const origin='http://127.0.0.1:4275',http=(path,cookie='',method='GET')=>fetch(origin+path,{method,headers:{origin,cookie},redirect:'manual'}),rows=[];
for(const path of ['/','/campaigns','/release/info?campaign=blackice']){const r=await http(path);rows.push({path,status:r.status});assert.equal(r.status,path==='/'?200:401);}
const admission=await http('/visitor/start','','POST');assert.equal(admission.status,303);const cookie=admission.headers.get('set-cookie').split(';')[0];
const menu=await http('/campaigns',cookie);assert.equal(menu.status,200);assert((await menu.text()).includes('campaign=blackice'));
const r=await http('/release/info?campaign=blackice',cookie),info=await r.json();assert.equal(r.status,200);assert(info.paused);assert.equal(info.tick,0);assert.deepEqual(info.build.rules,['BLACKICE-001-LAND-1']);
const result={kind:'HTTP admission only; not a browser interaction or rendering check',unauthenticated:rows,authenticated:{menu:menu.status,info:r.status,newIsolatedVisitor:true,tick:info.tick,paused:info.paused,runtimeSource:info.build.source,rules:info.build.rules},properEntry:origin+'/',steps:['Open root','Press 开始独立试玩','Use the blackice campaign entry in the same browser'],identityPrinted:false};
fs.writeFileSync('evidence/blackice-001-r1/access.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
