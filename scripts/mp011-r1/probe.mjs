import {readFileSync,writeFileSync,appendFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
const stage=process.argv[2];
if(!/^[a-z0-9-]+$/.test(stage??''))throw Error('Stage required');
const publicEnabled=process.argv.includes('--public');
const state=JSON.parse(readFileSync('.mp010-build/mp011-r1/processes.json'));
const origin=new URL(state.origin),out=`evidence/mp-011-r1/${stage}-requests.jsonl`;
if(existsSync(out))throw Error('Evidence already exists; choose a new stage');
const wsKey='dGhlIHNhbXBsZSBub25jZQ==';
if(Buffer.from(wsKey,'base64').length!==16)throw Error('Invalid key');
const rows=[];
const paths=[{path:'/__mp010_login',expected:200},{path:'/',expected:303},{path:'/lab-config.json',expected:303},...['candidate','control'].flatMap(v=>['index.html','mp010-build.json'].map(f=>({path:`/v/${v}/deployment/real/${f}`,expected:303})))];
for(let repeat=0;repeat<3;repeat++)for(const scenario of ['deployment','move'])for(const mode of ['real','delay','timeout'])paths.push({path:`/ws/${scenario}/${mode}`,expected:403,ws:true,repeat});
for(const item of paths){
  const pairId=randomUUID();
  for(const route of publicEnabled?['local','public']:['local']){
    const requestId='mp011-'+randomUUID(),at=new Date().toISOString();
    const args=['--silent','--show-error','--max-time','15','--include','--http1.1','-H',`X-MP011-Request-ID: ${requestId}`,'-H',`Host: ${origin.host}`,'-H',`Origin: ${origin.origin}`];
    if(item.ws)args.push('-H','Connection: Upgrade','-H','Upgrade: websocket','-H','Sec-WebSocket-Version: 13','-H',`Sec-WebSocket-Key: ${wsKey}`);
    args.push((route==='local'?'http://127.0.0.1:4181':origin.origin)+item.path,'--write-out','\nMP011_METRICS %{http_code} %{time_total}');
    const response=spawnSync('curl.exe',args,{encoding:'utf8',windowsHide:true});
    const metric=response.stdout.match(/\nMP011_METRICS (\d+) ([\d.]+)$/),status=metric?Number(metric[1]):null;
    const header=response.stdout.split(/\r?\n\r?\n/).filter(x=>/^HTTP\//.test(x)).at(-1)??'';
    const cfRay=header.match(/^cf-ray:\s*([a-f0-9]+-[A-Z]{3})\s*$/im)?.[1]??null;
    const location=header.match(/^location:\s*(\/__mp010_login)\s*$/im)?.[1]??null;
    const row={at,pairId,requestId,path:item.path,repeat:item.repeat??null,route,ws:!!item.ws,cfRay,status,expected:item.expected,durationMs:metric?Number(metric[2])*1000:null,curlExit:response.status,pass:response.status===0&&status===item.expected&&(item.expected!==303||location==='/__mp010_login')};
    rows.push(row);appendFileSync(out,JSON.stringify(row)+'\n');
  }
}
const events=readFileSync('.mp010-build/mp011-r1/boundary.jsonl','utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
const joined=rows.map(row=>{
  const log=events.filter(e=>e.requestId===row.requestId),received=log.some(e=>e.event==='received'),finish=log.find(e=>e.event==='response-finish'),errors=log.filter(e=>e.event==='connection-error'||e.event==='upstream-error');
  const classification=!received?'no-correlated-boundary-record-arrival-unproven':errors.length?'boundary-connection-error':finish?.status===403&&row.status===500?'boundary-wrote-403-public-500':row.pass?'expected-response':'other-mismatch';
  return {...row,classification,boundaryEvents:log};
});
const result={stage,at:new Date().toISOString(),originSha256:createHash('sha256').update(origin.origin).digest('hex'),wsKeyDecodedBytes:16,transport:state.transport,denialMode:state.denialMode,boundarySha256:createHash('sha256').update(readFileSync('scripts/mp011-r1/owner-preview.mjs')).digest('hex'),pass:rows.every(r=>r.pass),rows:joined};
writeFileSync(`evidence/mp-011-r1/${stage}-joined.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({stage,pass:result.pass,counts:joined.reduce((a,r)=>{const key=r.route+':'+r.status+':'+r.classification;a[key]=(a[key]??0)+1;return a;},{})}));
if(!result.pass)process.exitCode=1;
