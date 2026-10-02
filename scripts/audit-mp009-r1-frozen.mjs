// Exhaustive manifest-entry audit: never stops at the first mismatch or edits a manifest.
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const refs={development:'73d2dee2f2dab3bfb09d6466d54fa391d19d39fb',mp009:'33e7e8e292a509760f69ebdea29e541df69aea6c'};
const hash=b=>createHash('sha256').update(b).digest('hex');
const trees=Object.fromEntries(Object.entries(refs).map(([label,ref])=>[label,new Map(execFileSync('git',['ls-tree','-r','-z',ref],{maxBuffer:20*1024*1024}).toString().split('\0').filter(Boolean).map(row=>{const [meta,path]=row.split('\t');return [path,meta.split(' ')[2]];}))]));
const working=new Map(),blobs=new Map();
function bytes(label,path){
 if(!working.has(path)){try{working.set(path,readFileSync(path));}catch{working.set(path,null);}}
 const current=working.get(path);if(label==='candidate')return current;
 const id=trees[label].get(path);if(!id)return null;
 if(current&&createHash('sha1').update(Buffer.from(`blob ${current.length}\0`)).update(current).digest('hex')===id)return current;
 if(!blobs.has(id))blobs.set(id,execFileSync('git',['cat-file','blob',id],{maxBuffer:30*1024*1024}));return blobs.get(id);
}
const source=readFileSync('tests/startup-progress.test.mjs','utf8');
const removeObservation=vm.runInNewContext('('+source.slice(source.indexOf('function withoutObservation('),source.indexOf("test('recorded reviewed terrain startup" )).trim()+')');
const mpBoundary=JSON.parse(readFileSync('tests/fixtures/performance-frozen-sha256.json'));
const rows=[],manifests=[];
for(const name of readdirSync('tests/fixtures').filter(n=>n.endsWith('sha256.json')).sort()){
 const manifest='tests/fixtures/'+name,contents=bytes('candidate',manifest);
 for(const label of Object.keys(refs))if(hash(bytes(label,manifest))!==hash(contents))throw Error('Manifest changed: '+manifest);
 const entries=JSON.parse(contents);let counts={entries:0,developmentRawMismatches:0,mp009RawMismatches:0,candidateRawMismatches:0,newMp009RawMismatches:0,newR1RawMismatches:0,changedByMp009:0,changedByR1:0,developmentEffectiveFailures:0,mp009EffectiveFailures:0,candidateEffectiveFailures:0};
 for(const [path,expected] of Object.entries(entries)){
  const hashes=Object.fromEntries(['development','mp009','candidate'].map(label=>[label,bytes(label,path)?hash(bytes(label,path)):null]));
  let contract='raw bytes',effectiveExpected=expected,effectiveHashes={...hashes};
  if(name==='startup-baseline-sha256.json'){
   if(path.startsWith('src/render/')){contract='existing startup test strips observation calls';effectiveHashes=Object.fromEntries(Object.keys(hashes).map(label=>[label,hash(removeObservation(bytes(label,path).toString()))]));}
   else if(path==='src/presentation/transitionBus.ts'){contract='existing startup test uses performance boundary hash';effectiveExpected=mpBoundary[path];}
   else if(path!=='src/core-adapter/session.ts'){contract='checkpoint entry not asserted by startup manifest tests';effectiveExpected=null;}
  }
  const historical=hashes.development!==expected,newMp009=hashes.development===expected&&hashes.mp009!==expected,newR1=hashes.mp009===expected&&hashes.candidate!==expected;
  const changedByMp009=hashes.development!==hashes.mp009,changedByR1=hashes.mp009!==hashes.candidate;
  rows.push({manifest,path,expected,...hashes,historicalMismatch:historical,newMp009Mismatch:newMp009,newR1Mismatch:newR1,changedByMp009,changedByR1,contract,effectiveExpected,effectiveHashes,effectivePass:effectiveExpected===null?null:effectiveHashes.candidate===effectiveExpected});
  counts.entries++;counts.developmentRawMismatches+=historical;counts.mp009RawMismatches+=hashes.mp009!==expected;counts.candidateRawMismatches+=hashes.candidate!==expected;counts.newMp009RawMismatches+=newMp009;counts.newR1RawMismatches+=newR1;counts.changedByMp009+=changedByMp009;counts.changedByR1+=changedByR1;
  for(const label of Object.keys(hashes))counts[label+'EffectiveFailures']+=effectiveExpected!==null&&effectiveHashes[label]!==effectiveExpected;
 }
 manifests.push({manifest,sha256:hash(contents),unchangedAtAllCheckpoints:true,...counts});
}
const mismatchPaths=[...new Set(rows.filter(r=>r.candidate!==r.expected).map(r=>r.path))];
const reasons=Object.fromEntries(mismatchPaths.map(path=>[path,{lastDevelopmentTouch:execFileSync('git',['log','-1','--format=%H %s',refs.development,'--',path],{encoding:'utf8'}).trim(),mp009Reason:path==='src/main.ts'?'Mount/clean pending feedback and avoid full dynamic refresh on network move submit':['tests/localization.test.mjs','tests/helpers/combat-dom.mjs','tests/startup-progress.test.mjs'].includes(path)?'Supply PendingFeedbackRenderer dependency to extracted-main VM harness without changing assertions':null,r1Changed:rows.some(r=>r.path===path&&r.changedByR1)}]));
const inlineChecks=[
 ['src/geometry/hex.ts','283b0445e3bff1bc412dd76536ce49e517ffa1dd35dc26c1f8c194b88ba9ab7a','raw bytes'],
 ['public/assets/terrain/p4r3/city/small/S02.png','914593e3fb5c28b412fd0aff47418728f9ff360fce19659f63b870352890c55e','raw bytes (source of dist asset)'],
 ['vendor/eastfront-digital-core/BASELINE_SHA256.txt','b157991005b04e339ed0911a8e9dfdd9a7ab5f901cba1fc03f72f293b2dd5609','declared first token, matching existing UI009R1 test'],
].map(([path,expected,contract])=>({path,expected,contract,...Object.fromEntries(['development','mp009','candidate'].map(label=>{const b=bytes(label,path);const actual=contract.startsWith('declared')?b.toString().trim().split(/\s+/)[0]:hash(b);return [label,{actual,pass:actual===expected}];}))}));
const result={refs,candidate:'working tree, exact per-file SHA256 below',entryCount:rows.length,uniqueFiles:new Set(rows.map(r=>r.path)).size,manifests,reasons,inlineChecks,rows};
mkdirSync('evidence/mp-009-r1',{recursive:true});writeFileSync('evidence/mp-009-r1/frozen-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({entryCount:result.entryCount,uniqueFiles:result.uniqueFiles,manifests,mismatchPaths,reasons},null,2));
