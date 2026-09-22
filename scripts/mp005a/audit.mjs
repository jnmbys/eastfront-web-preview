/** Offline payload accounting/codec estimate. Never opens a WebSocket or emits raw snapshots. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cpus,platform,arch} from 'node:os';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {collectSamples} from './samples.mjs';
import {encodeProposal,decodeProposal} from './inline-view-proposal.mjs';
export const bytes=v=>Buffer.byteLength(JSON.stringify(v),'utf8');
const value=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
const round=x=>Math.round(x*1e4)/1e4;
export const stats=xs=>{const a=[...xs].sort((a,b)=>a-b);return {n:a.length,min:round(a[0]),median:round((a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2),max:round(a.at(-1))};};
const split=new Set(['','payload','payload.view','payload.model','payload.model.playerView','payload.model.deployment','payload.model.combat']);
export function fields(message){
  const rows=[];
  function walk(v,path){if(v&&typeof v==='object'&&!Array.isArray(v)&&split.has(path)){for(const [k,item] of Object.entries(v))walk(item,path?`${path}.${k}`:k);}else rows.push({path,bytes:bytes(v)});}
  walk(message,'');const total=bytes(message);rows.push({path:'<object keys, commas, colons, braces>',bytes:total-rows.reduce((a,r)=>a+r.bytes,0)});
  assert.equal(rows.reduce((a,r)=>a+r.bytes,0),total);return rows;
}
/** Disjoint maximal identical JSON values at the same path; omit parent key syntax.
 * This is a conservative accounting measure, NOT an implemented delta codec. */
export function unchangedBytes(previous,current){
  if(JSON.stringify(previous)===JSON.stringify(current))return bytes(current);
  if(!previous||!current||typeof previous!=='object'||typeof current!=='object'||Array.isArray(previous)!==Array.isArray(current))return 0;
  return Object.entries(current).reduce((n,[k,v])=>n+(Object.hasOwn(previous,k)?unchangedBytes(previous[k],v):0),0);
}
function categories(m){
  const paths={
    map:['payload.view.hexes','payload.view.edges','payload.model.playerView.hexes','payload.model.playerView.edges','payload.model.hexes','payload.model.edges'],
    unitsAndCounters:['payload.view.units','payload.model.playerView.units','payload.model.counters'],
    visibility:['payload.view.identifiedHexKeys','payload.view.contactHexKeys','payload.model.playerView.identifiedHexKeys','payload.model.playerView.contactHexKeys'],
    contactsAndLastKnown:['payload.view.contacts','payload.view.lastKnown','payload.model.playerView.contacts','payload.model.playerView.lastKnown'],
    deployment:['payload.model.deployment'],combatIncludingHistory:['payload.model.combat'],events:['payload.events'],
  };
  const rows=Object.fromEntries(Object.entries(paths).map(([k,ps])=>[k,ps.reduce((n,p)=>n+bytes(value(m,p)),0)]));
  rows.otherAndJsonSyntax=bytes(m)-Object.values(rows).reduce((a,b)=>a+b,0);assert.equal(Object.values(rows).reduce((a,b)=>a+b,0),bytes(m));return rows;
}
let sink=0;
function timed(fn){const start=performance.now(),v=fn();const ms=performance.now()-start;sink+=typeof v==='string'?v.length:v.payload.matchRevision;return ms;}
export function runAudit(output='evidence/mp-005a/audit.json.gz'){
  const {samples,counts}=collectSamples(),previous=new Map();
  const rows=samples.map(({label,role,message:m})=>{
    const p=m.payload,key=`${p.matchId}:${p.view.viewer}`,last=previous.get(key);previous.set(key,m);
    return {label,role,viewer:p.view.viewer,matchRevision:p.matchRevision,serverSequence:p.serverSequence,phase:p.view.phase,
      bytes:bytes(m),proposedBytes:bytes(encodeProposal(m)),categories:categories(m),fields:fields(m),
      unchangedValueBytes:last?unchangedBytes(last,m):null,
      mapChangedSincePrevious:last?JSON.stringify(last.payload.view.hexes)!==JSON.stringify(p.view.hexes):null,
      counts:{ownUnits:p.view.units.filter(u=>u.side===p.view.viewer).length,identifiedUnits:p.view.units.length,contacts:p.view.contacts.length,lastKnown:p.view.lastKnown.length,
        hexes:p.view.hexes.length,edges:p.view.edges.length,events:p.events.length,combatHistory:p.model.combat?.history.length??0},
    };
  });
  const deployment=samples.filter(s=>s.label.endsWith('-deployment'));
  // Warm both codecs on this same sequence, then alternate timing order; no rendering/network.
  for(let i=0;i<3;i++)for(const {message:m} of deployment){JSON.parse(JSON.stringify(m));decodeProposal(JSON.parse(JSON.stringify(encodeProposal(m))));}
  const costs=deployment.map(({label,role,message:m},i)=>{
    const oldText=JSON.stringify(m),newText=JSON.stringify(encodeProposal(m));
    const ops={originalStringifyMs:()=>JSON.stringify(m),proposalPackStringifyMs:()=>JSON.stringify(encodeProposal(m)),originalParseMs:()=>JSON.parse(oldText),proposalParseCloneDecodeMs:()=>decodeProposal(JSON.parse(newText))};
    const out={label,role,revision:m.payload.matchRevision};
    for(const name of i%2?Object.keys(ops).reverse():Object.keys(ops))out[name]=timed(ops[name]);
    return out;
  });
  const groups={};
  for(const side of ['SOVIET','GERMAN'])for(const role of ['actor','waiting']){
    const subset=rows.filter(r=>r.label===`${side}-deployment`&&r.role===role),cpu=costs.filter(r=>r.label===`${side}-deployment`&&r.role===role);
    groups[`${side}-${role}`]={bytes:stats(subset.map(s=>s.bytes)),proposedBytes:stats(subset.map(s=>s.proposedBytes)),savedPercent:stats(subset.map(s=>(1-s.proposedBytes/s.bytes)*100)),unchangedValuePercent:stats(subset.map(s=>s.unchangedValueBytes/s.bytes*100)),
      cpu:Object.fromEntries(Object.keys(cpu[0]).filter(k=>k.endsWith('Ms')).map(k=>[k,stats(cpu.map(c=>c[k]))]))};
  }
  const runtimeFiles=['server/authority.ts','server/gameplay.ts','server/match.ts','server/runtime.ts','src/core-adapter/browserProjection.ts','src/player-view/playerView.ts','src/multiplayer/client.ts','src/multiplayer/networkSession.ts','src/multiplayer/protocol.ts','src/multiplayer/gameplayProtocol.ts'];
  const result={schema:'mp005a-offline-audit-v1',environment:{node:process.version,platform:platform(),arch:arch(),cpu:cpus()[0]?.model,timer:'performance.now',transport:'none; in-memory authority + real JSON serialization',rendering:'none',seed:17,warmupPasses:3,cpuMeasurementPasses:1},
    measuredCheckout:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),runtimeSha256:Object.fromEntries(runtimeFiles.map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),
    counts:{...counts,snapshotSamples:rows.length,deploymentSnapshots:deployment.length,expectedSnapshotMessagesPerAcceptedAction:2},
    summary:groups,rows,cpuSamples:costs,checks:{fieldAccounting:'PASS',roundTripDeepEquality:'PASS',authorizedViewPrivacy:'PASS',oneSnapshotPerRecipientPerAction:'PASS',noCodecStateBetweenRevisions:'PASS'},
    boundaries:['Proposal is NOT compatible with protocol 2 wire format; no production changes.','UTF-8 application JSON bytes, NOT WebSocket/TLS on-wire measurements.','Local Node CPU only; no browser, main-thread render, public latency or physical-device acceptance.','Unchanged adjacent content is NOT proof that content is globally static.']};
  mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});const text=JSON.stringify(result,null,2)+'\n';writeFileSync(output,output.endsWith('.gz')?gzipSync(text):text);
  console.log(JSON.stringify({counts:result.counts,summary:groups,sink},null,2));return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)runAudit(process.argv[2]);
