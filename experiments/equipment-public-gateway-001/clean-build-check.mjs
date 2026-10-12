// Run from outside the fresh checkout; never mutates a running preview's build.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';
const checkout=fs.realpathSync(process.argv[2]),output=process.argv[3];
assert.ok(path.basename(checkout).startsWith('gateway-n4-clean-'));
const git=(...args)=>execFileSync('git',args,{cwd:checkout,encoding:'utf8'}).trim();
assert.equal(git('status','--porcelain'),'');
const file=path.join(checkout,'.release-territory-preview/release-build.json'),raw=fs.readFileSync(file),build=JSON.parse(raw);
assert.equal(build.source,git('rev-parse','HEAD'));assert.equal(build.dirty,false);
const {start}=await import(pathToFileURL(path.join(checkout,'experiments/equipment-public-gateway-001/server.mjs')));
const root=fs.mkdtempSync(path.join(os.tmpdir(),'gateway-build-guards-')),legacyDir=path.join(root,'old'),mpDir=path.join(root,'new');fs.mkdirSync(legacyDir);fs.mkdirSync(mpDir);
const cfg={port:0,host:'127.0.0.1',origin:'https://gateway.example',legacyDir,mpDir,trustProxyIPs:['127.0.0.1'],autoTick:false};
const results=[];process.env.NODE_ENV='production';delete process.env.REQUIRE_PERSISTENT_DISK;delete process.env.RELEASE_SOURCE_SHA;delete process.env.LOCAL_PREVIEW;
const marker=path.join(checkout,'n4-dirty-probe.txt');
try{
 const s=await start(cfg);assert.equal(s.metadata.build.dirty,false);await s.close();results.push('clean production start/close');
 for(const field of ['source','rules','geography']){fs.writeFileSync(file,JSON.stringify({...build,[field]:'wrong'}));await assert.rejects(()=>start(cfg),/BUILD_SOURCE_OR_RULES_MISMATCH/);results.push(field+' mismatch rejected');}
 fs.writeFileSync(file,JSON.stringify({...build,dirty:true}));await assert.rejects(()=>start(cfg),/CLEAN_RELEASE_BUILD_REQUIRED/);results.push('dirty build rejected');fs.writeFileSync(file,raw);
 fs.writeFileSync(marker,'synthetic dirty checkout');await assert.rejects(()=>start(cfg),/CLEAN_RELEASE_BUILD_REQUIRED/);results.push('dirty source rejected');
 execFileSync(process.execPath,['experiments/equipment-public-gateway-001/build.mjs'],{cwd:checkout,env:{...process.env,RELEASE_SOURCE_SHA:build.source},stdio:'pipe'});
 assert.equal(JSON.parse(fs.readFileSync(file)).dirty,true);results.push('explicit correct source cannot hide dirty build');
 fs.unlinkSync(marker);await assert.rejects(()=>start(cfg),/CLEAN_RELEASE_BUILD_REQUIRED/);
 assert.throws(()=>execFileSync(process.execPath,['experiments/equipment-public-gateway-001/build.mjs'],{cwd:checkout,env:{...process.env,RELEASE_SOURCE_SHA:'0'.repeat(40)},stdio:'pipe'}),/RELEASE_SOURCE_SHA_MISMATCH/);results.push('wrong explicit source rejected before build');
}finally{if(fs.existsSync(marker))fs.unlinkSync(marker);fs.writeFileSync(file,raw);}
assert.equal(git('status','--porcelain'),'');
const report={source:build.source,platform:process.platform,node:process.version,build,passed:true,results,scope:'fresh isolated checkout; npm ci --include=dev followed by documented build; production guards on synthetic directories; no Linux claim'};
if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));}console.log(JSON.stringify(report,null,2));
