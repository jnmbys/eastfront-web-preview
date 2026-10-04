import {spawn} from 'node:child_process';
import {appendFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {ownerPreview} from '../mp011-r1/owner-preview.mjs';
import {verify} from './package.mjs';
verify();
const origin=process.env.MP013_ORIGIN,runDir=process.env.MP013_RUN_DIR,passwordSha256=process.env.MP013_PASSWORD_SHA256;delete process.env.MP013_PASSWORD_SHA256;
const fixture=spawn(process.execPath,['scripts/mp021/fixture.mjs'],{env:{...process.env},windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
writeFileSync(join(runDir,'fixture.json'),JSON.stringify({pid:fixture.pid,spawnedAt:new Date().toISOString()}));
let boundary,closing;const sockets=new Set();
const close=()=>closing??=(async()=>{for(const s of sockets)s.destroy();if(boundary?.listening)await new Promise(r=>boundary.close(r));if(fixture.exitCode===null){fixture.send('close');await new Promise(r=>{fixture.once('exit',r);setTimeout(()=>{fixture.kill();r();},3000).unref();});}})();
try{
 await new Promise((ok,fail)=>{const timer=setTimeout(()=>fail(Error('Fixture startup timeout')),30000);fixture.stdout.on('data',b=>{if(String(b).includes('MP021 isolated fixture ready')){clearTimeout(timer);ok();}});fixture.once('exit',()=>{clearTimeout(timer);fail(Error('Fixture exited'));});fixture.once('error',fail);});
 boundary=ownerPreview({origin,passwordSha256,upstreamPort:4180,diagnostic:e=>appendFileSync(join(runDir,'boundary.jsonl'),JSON.stringify(e)+'\n')});
 boundary.on('connection',s=>{sockets.add(s);s.once('close',()=>sockets.delete(s));});await new Promise((ok,fail)=>{boundary.once('error',fail);boundary.listen(4181,'127.0.0.1',ok);});
 writeFileSync(join(runDir,'stack.json'),JSON.stringify({pid:process.pid,fixturePid:fixture.pid,origin,target:'http://127.0.0.1:4181',ports:{boundary:4181,fixture:4180}}));
 const stop=async()=>{await close();process.exit();};process.on('SIGINT',stop);process.on('SIGTERM',stop);
}catch(e){await close();throw e;}
