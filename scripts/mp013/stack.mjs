import {spawn} from 'node:child_process';
import {appendFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {ownerPreview} from '../mp011-r1/owner-preview.mjs';
import {verifyArtifacts} from '../mp010/integrity.mjs';
import {gateway,exactOrigin} from './gateway.mjs';
const listen=(server,port)=>new Promise((ok,fail)=>{server.once('error',fail);server.listen(port,'127.0.0.1',()=>{server.off('error',fail);ok();});});
export async function startStack({origin,passwordSha256,ports={boundary:4181,gateway:4180,fixture:4184},diagnostic=()=>{},observe=()=>{},onFixture=()=>{}}){
  exactOrigin(origin);const manifest=verifyArtifacts();
  const env={...process.env,MP010_HOST:'127.0.0.1',MP010_PORT:String(ports.fixture),MP010_ORIGIN:origin,MP010_TLS_CERT:'',MP010_BEHIND_TLS:'1'};
  delete env.MP013_PASSWORD_SHA256;delete env.MP010_OWNER_PASSWORD_SHA256;
  const fixture=spawn(process.execPath,['scripts/mp010/serve.mjs'],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let overlay,boundary,closing;const sockets=new Set();let stderrObserved=false;
  fixture.stderr.on('data',()=>{stderrObserved=true;}); // No raw upstream messages persisted.
  function close(){return closing??=(async()=>{for(const socket of sockets)socket.destroy();if(boundary?.listening)await new Promise(r=>boundary.close(r));if(overlay?.listening)await overlay.stop();if(fixture.exitCode===null&&fixture.signalCode===null){await new Promise(r=>{fixture.once('exit',r);fixture.once('error',r);fixture.kill();});}})();}
  try{
    onFixture({pid:fixture.pid,spawnedAt:new Date().toISOString()});
    await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Pinned fixture startup timeout')),20000);let output='';fixture.stdout.on('data',chunk=>{output=(output+chunk).slice(-2000);if(output.includes('MP010 isolated device lab')){clearTimeout(timer);ok();}});fixture.once('error',e=>{clearTimeout(timer);fail(e);});fixture.once('exit',()=>{clearTimeout(timer);fail(Error('Pinned fixture exited'));});});
    overlay=gateway({origin,upstreamPort:ports.fixture,manifest,observe});await listen(overlay,ports.gateway);
    boundary=ownerPreview({origin,passwordSha256,upstreamPort:overlay.address().port,diagnostic});
    boundary.on('connection',socket=>{sockets.add(socket);socket.once('close',()=>sockets.delete(socket));});await listen(boundary,ports.boundary);
    return {ports:{boundary:boundary.address().port,gateway:overlay.address().port,fixture:ports.fixture},fixturePid:fixture.pid,close,manifest,stderrObserved:()=>stderrObserved};
  }catch(error){await close();throw error;}
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const {verify}=await import('./verify.mjs');verify();
  const passwordSha256=process.env.MP013_PASSWORD_SHA256;delete process.env.MP013_PASSWORD_SHA256;
  const origin=process.env.MP013_ORIGIN,dir=process.env.MP013_RUN_DIR;
  if(!dir)throw Error('Run directory required');mkdirSync(dir,{recursive:true});
  const stack=await startStack({origin,passwordSha256,onFixture:state=>writeFileSync(resolve(dir,'fixture.json'),JSON.stringify(state)),diagnostic:e=>appendFileSync(resolve(dir,'boundary.jsonl'),JSON.stringify(e)+'\n')});
  writeFileSync(resolve(dir,'stack.json'),JSON.stringify({pid:process.pid,fixturePid:stack.fixturePid,origin,ports:stack.ports,startedAt:new Date().toISOString()},null,2));
  console.log('MP013 boundary 127.0.0.1:4181 -> diagnostic gateway 127.0.0.1:4180 -> pinned fixture 127.0.0.1:4184');
  let closing=false;const stop=async()=>{if(closing)return;closing=true;await stack.close();process.exit();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
