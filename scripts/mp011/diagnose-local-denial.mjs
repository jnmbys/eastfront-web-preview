// Offline control: a fresh ephemeral boundary with a synthetic test credential.
// It never reads the owner's password/session and never connects to the tunnel.
import {ownerPreview} from '../mp010/owner-preview.mjs';
import {createHash} from 'node:crypto';
import {request} from 'node:http';
import {writeFileSync} from 'node:fs';
const origin='https://local-denial-control.test';
const gate=ownerPreview({origin,passwordSha256:createHash('sha256').update('synthetic-non-login-control').digest('hex')});
await new Promise(r=>gate.listen(0,'127.0.0.1',r));
const rows=[];
try{
  for(let repeat=0;repeat<4;repeat++)for(const scenario of ['deployment','move'])for(const mode of ['real','delay','timeout']){
    const path=`/ws/${scenario}/${mode}`;
    const status=await new Promise((resolve,reject)=>{
      const req=request({host:'127.0.0.1',port:gate.address().port,path,headers:{host:new URL(origin).host,origin,connection:'Upgrade',upgrade:'websocket','sec-websocket-version':'13','sec-websocket-key':'dGhlIHNhbXBsZSBub25jZQ=='}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
      req.on('upgrade',(_r,socket)=>{socket.destroy();reject(Error('Anonymous upgrade unexpectedly succeeded'));});
      req.setTimeout(3000,()=>req.destroy(Error('Timeout')));req.on('error',reject);req.end();
    });
    rows.push({repeat,path,status,pass:status===403});
  }
}finally{gate.closeAllConnections();await new Promise(r=>gate.close(r));}
const evidence={at:new Date().toISOString(),route:'loopback-ephemeral-synthetic-boundary',publicTraffic:false,rows,pass:rows.every(x=>x.pass),limitation:'Does not identify the cause of intermittent public HTTP 500 and does not validate authenticated public WS.'};
writeFileSync('evidence/mp-011/local-denial-control.json',JSON.stringify(evidence,null,2)+'\n');
console.log(`${rows.filter(x=>x.pass).length}/${rows.length} local anonymous WS denials returned 403`);
if(!evidence.pass)process.exitCode=1;
