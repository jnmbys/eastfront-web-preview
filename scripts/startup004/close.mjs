// Close only this run through its loopback control; never kill unrelated PIDs.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import https from 'node:https';
const statePath='.startup004/run/state.json';
const before=JSON.parse(readFileSync(statePath));
if(before.ports.control!==4292||before.ports.fixture!==4290||before.ports.boundary!==4291)throw Error('Unexpected run ports');
if(!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(before.origin))throw Error('Unexpected origin');
let stop;
try{const r=await fetch('http://127.0.0.1:4292/stop',{method:'POST',headers:{Origin:'http://127.0.0.1:4292'},signal:AbortSignal.timeout(10000)});stop={status:r.status,body:await r.text()};}catch(e){stop={error:String(e),note:'May have already stopped after a saved failure; verify independently below.'};}
const ids=[before.pid,before.tunnelPid].filter(Number.isInteger);
function localState(){
 const ps=`$ErrorActionPreference='Stop'; $ids=@(${ids.join(',')}); $p=@(Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ProcessId } | Select-Object ProcessId,CreationDate,Name,CommandLine); $l=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { @(4290,4291,4292) -contains $_.LocalPort } | Select-Object LocalAddress,LocalPort,OwningProcess); @{processes=$p;listeners=$l}|ConvertTo-Json -Depth 5 -Compress`;
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',windowsHide:true}));
}
let local;
for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,1000));local=localState();if(!local.processes.length&&!local.listeners.length)break;}
async function publicProbe(path){return new Promise(resolve=>{
 const req=https.get(before.origin+path,{headers:{'Cache-Control':'no-cache'}},res=>{const chunks=[];const tlsAuthorized=res.socket.authorized===true;res.on('data',b=>chunks.push(b));res.on('end',()=>{const b=Buffer.concat(chunks);resolve({path,status:res.statusCode,tlsAuthorized,bodyBytes:b.length,classification:res.statusCode>=500?'HTTP_5XX_UNAVAILABLE':'STILL_RESPONDING_CHECK_REQUIRED'});});});
 req.setTimeout(12000,()=>req.destroy(Error('timeout')));req.on('error',e=>resolve({path,error:String(e),classification:'UNKNOWN_NETWORK_DNS_OR_TLS_FAILURE'}));
 });}
const publicChecks=[];for(const path of ['/','/r1/index.html'])publicChecks.push(await publicProbe(path));
const result={checkedAt:new Date().toISOString(),run:JSON.parse(readFileSync(statePath)),stop,local,processesAbsent:local.processes.length===0,listenersClosed:local.listeners.length===0,publicChecks,publicUnavailableVerified:publicChecks.every(r=>r.classification==='HTTP_5XX_UNAVAILABLE'),limitation:'DNS/TLS/timeout alone is UNKNOWN, not proof of public closure. HTTP 5xx corroborates origin unavailability at this check time.'};
writeFileSync('evidence/startup-004/closure.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
