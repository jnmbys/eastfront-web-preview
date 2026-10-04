// Close only this run through its loopback control; never kill unrelated PIDs.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import https from 'node:https';
const statePath='.startup006/run/state.json';
const before=JSON.parse(readFileSync(statePath));
if(before.ports.control!==4302||before.ports.fixture!==4300||before.ports.boundary!==4301)throw Error('Unexpected run ports');
if(before.origin!==null&&!/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(before.origin))throw Error('Unexpected origin');
let stop;
try{const r=await fetch('http://127.0.0.1:4302/stop',{method:'POST',headers:{Origin:'http://127.0.0.1:4302'},signal:AbortSignal.timeout(10000)});stop={status:r.status,body:await r.text()};}catch(e){stop={error:String(e),note:'May have already stopped after a saved failure; verify independently below.'};}
const ids=[before.pid,before.tunnelPid].filter(Number.isInteger);
function localState(){
 const ps=`$ErrorActionPreference='Stop'; $ids=@(${ids.join(',')}); $p=@(Get-CimInstance Win32_Process | Where-Object { $ids -contains $_.ProcessId } | Select-Object ProcessId,CreationDate,Name,CommandLine); $l=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { @(4300,4301,4302) -contains $_.LocalPort } | Select-Object LocalAddress,LocalPort,OwningProcess); @{processes=$p;listeners=$l}|ConvertTo-Json -Depth 5 -Compress`;
 return JSON.parse(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',ps],{encoding:'utf8',windowsHide:true}));
}
let local;
for(let i=0;i<5;i++){await new Promise(r=>setTimeout(r,1000));local=localState();if(!local.processes.length&&!local.listeners.length)break;}
async function publicProbe(path){return new Promise(resolve=>{
 let settled=false;const done=value=>{if(settled)return;settled=true;clearTimeout(timer);resolve(value);};
 const req=https.get(before.origin+path,{headers:{'Cache-Control':'no-cache'}},res=>{let bytes=0;const tlsAuthorized=res.socket.authorized===true;res.on('data',b=>bytes+=b.length);res.on('end',()=>done({path,status:res.statusCode,tlsAuthorized,bodyBytes:bytes,classification:tlsAuthorized&&res.statusCode>=500?'HTTP_5XX_UNAVAILABLE_AT_PROBE_TIME':'STILL_RESPONDING_CHECK_REQUIRED'}));res.on('error',e=>done({path,error:String(e),classification:'UNKNOWN'}));});
 const timer=setTimeout(()=>{done({path,error:'Overall 12 second timeout including DNS/TLS',classification:'UNKNOWN'});req.destroy();},12000);req.on('error',e=>done({path,error:String(e),classification:'UNKNOWN'}));
 });}
const publicChecks=[];if(before.origin)for(const path of ['/','/r1/index.html'])publicChecks.push(await publicProbe(path));
const result={checkedAt:new Date().toISOString(),run:JSON.parse(readFileSync(statePath)),stop,local,processesAbsent:local.processes.length===0,listenersClosed:local.listeners.length===0,publicChecks,publicState:before.origin?(publicChecks.every(r=>r.classification==='HTTP_5XX_UNAVAILABLE_AT_PROBE_TIME')?'UNAVAILABLE_AT_PROBE_TIME':publicChecks.some(r=>r.classification==='UNKNOWN')?'UNKNOWN':'CHECK_REQUIRED'):'NOT_OPENED',limitation:'DNS/TLS/timeout/no response is UNKNOWN. HTTP 502 or other 5xx only demonstrates unavailability at the probe time, not permanent closure.'};
writeFileSync(process.argv[2]??'evidence/startup-006/closure.json',JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));
