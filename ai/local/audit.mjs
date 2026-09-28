import assert from 'node:assert/strict';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
const root=resolve('.ai003-preview'),seen=new Set();
function visit(file){
 if(seen.has(file))return;seen.add(file);assert(existsSync(file),'Missing module: '+relative(root,file));
 const source=readFileSync(file,'utf8');
 for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(|\bimport\s*)['"]([^'"]+)['"]/g)){
  const spec=m[1];assert(spec.startsWith('.'),'Non-browser import: '+spec+' in '+relative(root,file));
  const target=resolve(dirname(file),spec);assert(target.startsWith(root+'/'));if(target.endsWith('.js'))visit(target);else assert(existsSync(target));
 }
 assert(!/\bnew WebSocket\s*\(/.test(source),'Worker must not open a production socket');
}
visit(resolve(root,'ai/local/worker.js'));
assert(readFileSync(root+'/src/main.js','utf8').includes('const LOCAL_AI_ENABLED = true;'));
assert(readFileSync('dist/app/main.js','utf8').includes('const LOCAL_AI_ENABLED = false;'));
assert(!existsSync('dist/ai/local/worker.js'));
assert.equal(JSON.parse(readFileSync(root+'/multiplayer-config.json')).serverUrl,'');
assert(readFileSync(root+'/index.html','utf8').includes("connect-src 'self'"));
assert(readFileSync(root+'/src/local-ai/client.js','utf8').includes('../../ai/local/worker.js'));
const result={workerModules:seen.size,workerNodeImports:0,workerSockets:0,experimentalGate:true,productionGate:false,emptyMultiplayerServer:true,sameOriginConnectPolicy:true,browserExecuted:false};
writeFileSync('evidence/ai003/artifact-audit.json',JSON.stringify(result,null,2)+'\n');console.log(result);
