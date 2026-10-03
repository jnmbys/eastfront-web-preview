import {spawn} from 'node:child_process';
import {appendFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ownerPreview} from '../mp011-r1/owner-preview.mjs';
import {verifyArtifacts} from './integrity.mjs';
export async function startStack({origin,passwordSha256,ports={boundary:4181,fixture:4180},diagnostic=()=>{},onFixture=()=>{},fault='none'}){
 const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin||u.username||u.password)throw Error('Exact HTTPS origin required');
 if(!['none','map404'].includes(fault))throw Error('Unknown local fixture fault');
 const manifest=verifyArtifacts(),env={...process.env,MP017_HOST:'127.0.0.1',MP017_PORT:String(ports.fixture),MP017_ORIGIN:origin,MP017_BEHIND_TLS:'1',MP017_TLS_CERT:'',MP017_FAULT:fault};
 delete env.MP013_PASSWORD_SHA256;delete env.MP010_OWNER_PASSWORD_SHA256;
 const fixture=spawn(process.execPath,['scripts/mp017/serve.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let boundary,closing;const sockets=new Set();fixture.stderr.on('data',()=>{});
 function close(){return closing??=(async()=>{for(const s of sockets)s.destroy();if(boundary?.listening)await new Promise(r=>boundary.close(r));if(fixture.exitCode===null&&fixture.signalCode===null)await new Promise(r=>{fixture.once('exit',r);fixture.once('error',r);fixture.kill();});})();}
 try{
  onFixture({pid:fixture.pid,spawnedAt:new Date().toISOString()});
  await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('MP017 fixture startup timeout')),30000);let output='';fixture.stdout.on('data',b=>{output=(output+b).slice(-2000);if(output.includes('MP017 isolated device lab')){clearTimeout(timer);ok();}});fixture.once('error',e=>{clearTimeout(timer);fail(e);});fixture.once('exit',()=>{clearTimeout(timer);fail(Error('MP017 fixture exited'));});});
  boundary=ownerPreview({origin,passwordSha256,upstreamPort:ports.fixture,diagnostic});boundary.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});
  await new Promise((ok,fail)=>{boundary.once('error',fail);boundary.listen(ports.boundary,'127.0.0.1',ok);});
  return {manifest,fixturePid:fixture.pid,ports:{boundary:boundary.address().port,fixture:ports.fixture},close};
 }catch(e){await close();throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
 const passwordSha256=process.env.MP013_PASSWORD_SHA256;delete process.env.MP013_PASSWORD_SHA256;
 const origin=process.env.MP013_ORIGIN,dir=process.env.MP013_RUN_DIR;if(!dir)throw Error('Run directory required');mkdirSync(dir,{recursive:true});
 const stack=await startStack({origin,passwordSha256,onFixture:s=>writeFileSync(resolve(dir,'fixture.json'),JSON.stringify(s)),diagnostic:e=>appendFileSync(resolve(dir,'boundary.jsonl'),JSON.stringify(e)+'\n')});
 writeFileSync(resolve(dir,'stack.json'),JSON.stringify({pid:process.pid,fixturePid:stack.fixturePid,origin,ports:stack.ports,startedAt:new Date().toISOString()},null,2));
 console.log('MP017 unchanged owner auth 4181 -> isolated A/B fixture 4180; loopback only');
 let closing=false;const stop=async()=>{if(closing)return;closing=true;await stack.close();process.exit();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
