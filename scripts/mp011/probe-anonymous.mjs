// No cookies, passwords, authorization headers, or game payloads are read/saved.
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const state=JSON.parse(readFileSync('.mp010-build/mp011/processes.json'));
const origin=new URL(state.origin);
if(origin.protocol!=='https:'||!origin.hostname.endsWith('.trycloudflare.com'))throw Error('Unexpected origin');
const proxy=process.env.MP011_PROBE_PROXY;
const checks=[];
const wsKey='dGhlIHNhbXBsZSBub25jZQ==';
if(Buffer.from(wsKey,'base64').length!==16)throw Error('WS handshake key must decode to 16 bytes');
function request(path,ws=false){
  const args=['--silent','--show-error','--max-time','25','--include','--http1.1'];
  if(proxy)args.push('--proxy',proxy);
  if(ws)args.push('-H','Connection: Upgrade','-H','Upgrade: websocket','-H','Sec-WebSocket-Version: 13','-H',`Sec-WebSocket-Key: ${wsKey}`,'-H',`Origin: ${origin.origin}`);
  args.push(origin.origin+path);
  const result=spawnSync('curl.exe',args,{encoding:'utf8',windowsHide:true});
  const blocks=result.stdout.split(/\r?\n\r?\n/);
  const headers=blocks.filter(x=>/^HTTP\//.test(x));
  const header=headers.at(-1)??'';
  const status=Number(header.match(/^HTTP\/\S+ (\d+)/)?.[1])||null;
  const location=header.match(/^location:\s*(.+)$/im)?.[1]?.trim()??null;
  const body=blocks.at(-1)??'';
  const expected=ws?403:path==='/__mp010_login'?200:303;
  const pass=result.status===0&&status===expected&&(expected!==303||location==='/__mp010_login')&&(expected!==200||body.includes('type="password"'));
  checks.push({path,transport:ws?'anonymous-ws-upgrade':'anonymous-https',status,expected,location,pass,curlExit:result.status});
}
request('/__mp010_login');request('/');request('/lab-config.json');
for(const version of ['candidate','control']){
  request(`/v/${version}/deployment/real/index.html`);
  request(`/v/${version}/deployment/real/mp010-build.json`);
}
for(const scenario of ['deployment','move'])for(const mode of ['real','delay','timeout'])request(`/ws/${scenario}/${mode}`,true);
const evidence={at:new Date().toISOString(),attempt:state.attempt??1,fixedCommit:state.fixedCommit,originSha256:createHash('sha256').update(origin.origin).digest('hex'),route:proxy?'explicit-existing-local-proxy':'direct',tlsValidation:true,redirectsFollowed:false,authenticated:false,wsKeyDecodedBytes:16,checks,pass:checks.every(x=>x.pass)};
writeFileSync('evidence/mp-011/public-anonymous.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify(evidence,null,2));
if(!evidence.pass)process.exitCode=1;
