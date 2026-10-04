// Isolated local builds and append-only evidence; never starts a public gateway.
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync,cpSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {verifyArtifacts} from '../mp017/integrity.mjs';
const baseline='a7dfdd9c57400c6a856186a70d8fb71b118b02dc',baseEvidence='2a1b784ce11963380605e20d3aff57cd87fb8685';
const name=process.argv[2];if(!/^run-[a-z0-9-]+$/.test(name??''))throw Error('Usage: node scripts/mp020/verify.mjs run-<unique-name>');
mkdirSync('evidence/mp-020',{recursive:true});const out=resolve('evidence/mp-020',name);mkdirSync(out);
const save=(p,v)=>writeFileSync(join(out,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=args=>execFileSync('git',args,{maxBuffer:50*1024*1024});
const run=(label,args,env={})=>{console.log(label);const r=spawnSync(process.execPath,args,{env:{...process.env,...env},encoding:'utf8',maxBuffer:20*1024*1024});save(label+'.txt',r.stdout+r.stderr);if(r.status!==0)throw Error(label+' failed '+r.status);};
const m=verifyArtifacts();
const zipExpected={'mp017-control-6ea4983.zip':'9195596305d3e057235252aa08ad8a26738f727e5c1d4ae67d10b2d4b4658842','mp017-candidate-a7dfdd9.zip':'4465fd37d9d7f78e4e11cb8cadc92e5c757bd8604f67affdfd2b2da5d1631b0e','mp017-shared-server-manifest.zip':'a2a1c5431b674fdbdaaa0ba41b958c5dafccc15bc7676765634fa96c6902674a'};
for(const [file,h]of Object.entries(zipExpected))if(sha(readFileSync('.mp010-build/mp017/packages/'+file))!==h)throw Error('Fixed ZIP changed');
save('fixed-artifacts.json',{versions:m.versions,server:m.server.treeSha256,builds:Object.fromEntries(Object.entries(m.builds).map(([k,v])=>[k,v.treeSha256])),zipExpected});
const changed=['server/authority.ts','server/runtime.ts','server/latencyDiagnostics.ts'];
const productionDiff=git(['diff','--name-only',baseline,'--','src','server','vendor']).toString().trim().split(/\r?\n/).filter(Boolean);
if(productionDiff.some(p=>!changed.includes(p)))throw Error('Unexpected production change');
if(git(['diff','--name-only',baseEvidence,'--','scripts/mp017','scripts/mp011-r1','scripts/mp014','tests/fixtures','evidence/mp-017','evidence/mp-018-r1']).toString().trim())throw Error('Protected evidence changed');
run('client-build',['node_modules/typescript/bin/tsc']);run('server-build',['node_modules/typescript/bin/tsc','-p','server/tsconfig.json']);run('runtime-copy',['server/copy-runtime.mjs']);
const cache=resolve('node_modules/.cache/mp020',name);mkdirSync(cache,{recursive:true});cpSync('.server-dist',cache,{recursive:true});
for(const path of changed){const original=git(['show',baseline+':'+path]).toString();writeFileSync(join(cache,path.replace(/\.ts$/,'.js')),ts.transpileModule(original,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
save('provenance.json',{baseline,baseEvidence,branchBase:git(['rev-parse','HEAD']).toString().trim(),productionDiff,baselineRuntime:cache,baselineOverrides:changed,sharedServerAndClientIdenticalToBaseline:true,node:process.version,typescript:ts.version,websocket:JSON.parse(readFileSync('node_modules/ws/package.json')).version,diagnosticOnly:true,optimizationImplemented:false,publicOpened:false});
run('baseline-local',['scripts/mp020/run.mjs',join(out,'baseline-local'),cache,'off','0','0','5']);
run('diagnostic-local',['scripts/mp020/run.mjs',join(out,'diagnostic-local'),'.server-dist','on','0','0','5']);
run('diagnostic-delayed',['scripts/mp020/run.mjs',join(out,'diagnostic-delayed'),'.server-dist','on','700','0','2']);
run('diagnostic-render',['scripts/mp020/run.mjs',join(out,'diagnostic-render'),'.server-dist','on','0','120','2']);
const results=Object.fromEntries(['baseline-local','diagnostic-local','diagnostic-delayed','diagnostic-render'].map(k=>[k,JSON.parse(readFileSync(join(out,k,'results.json')))]));
const digests=new Set(Object.values(results).flatMap(r=>r.samples.map(s=>s.authorizedResultSha256)));if(digests.size!==1)throw Error('Authorized query changed across runs');
const range=values=>({min:Math.min(...values),max:Math.max(...values),median:[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]});
save('comparison.json',{allAuthorizedResultDigestsEqual:true,groups:Object.fromEntries(Object.entries(results).map(([k,r])=>[k,{count:r.count,queryCountPerMove:r.samples.map(s=>s.queryCount),resyncCount:r.samples.reduce((s,r)=>s+r.resyncCount,0),clientWaitMs:range(r.samples.map(s=>s.timing.client.sendToReceiveMs)),serverMs:k==='baseline-local'?null:range(r.samples.map(s=>s.timing.server.receiveToHandoffMs)),wireBytes:r.samples.map(s=>s.wire?.bytes),compressed:r.samples.map(s=>s.wire?.rsv1)}])),interpretation:'Diagnostic-only control, not a speedup experiment. Local run variation is not improvement. Artificial receive delay / synchronous render recorded separately; not device evidence.'});
run('targeted-tests',['--test','tests/mp020-query-diagnostics.test.mjs','tests/mp016-query-wait.test.mjs','tests/mp003-scheduling.test.mjs','tests/mp009-r1-correlation.test.mjs','tests/mp009-r1-recovery.test.mjs','tests/mp003-network.test.mjs'],{MP016_TRACE_DIR:join(out,'ordering'),MP009_TRACE_DIR:join(out,'recovery')});
const frozen=spawnSync(process.execPath,['--test','--test-reporter=tap','--test-name-pattern=frozen baseline','tests/ua002-tactical.test.mjs','tests/ua003-presence.test.mjs','tests/ua003r1-grounding.test.mjs'],{encoding:'utf8'});save('historical-frozen-reds.txt',frozen.stdout+frozen.stderr);
if(frozen.status!==1||!/^# fail 3$/m.test(frozen.stdout))throw Error('Unexpected freeze result');
const tree=new Map(git(['ls-tree','-r','-z',baseline]).toString().split('\0').filter(Boolean).map(row=>{const[meta,p]=row.split('\t');return[p,meta.split(' ')[2]];})),blobs=new Map();
const original=p=>{const id=tree.get(p);if(!id)return null;if(!blobs.has(id))blobs.set(id,git(['cat-file','blob',id]));return blobs.get(id);};
const rows=[],manifests=[];
for(const file of readdirSync('tests/fixtures').filter(f=>f.endsWith('sha256.json')).sort()){
 const path='tests/fixtures/'+file,raw=readFileSync(path);if(sha(raw)!==sha(original(path)))throw Error('Manifest changed');
 for(const[p,expected]of Object.entries(JSON.parse(raw))){const before=original(p);let after;try{after=readFileSync(p);}catch{after=null;}const b=before?sha(before):null,a=after?sha(after):null;rows.push({manifest:path,path:p,expected,baseline:b,candidate:a,historicalMismatch:b!==expected,newMismatch:b===expected&&a!==expected,changed:b!==a});}
 manifests.push({path,sha256:sha(raw)});
}
save('frozen-audit.json',{baseline,manifests,entryCount:rows.length,historicalMismatchEntries:rows.filter(r=>r.historicalMismatch).length,newMismatchEntries:rows.filter(r=>r.newMismatch),changedEntries:rows.filter(r=>r.changed),rows,limits:'All entries enumerated; three historical assertion reds retained; no manifest refresh or full-suite Green claim.'});
const inventory=(dir,prefix='')=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?inventory(join(dir,e.name),prefix+e.name+'/'):[[prefix+e.name,sha(readFileSync(join(dir,e.name)))]]);
save('checksums.json',Object.fromEntries(inventory(out)));console.log('Done: '+out);
