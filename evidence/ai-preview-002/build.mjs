// Run in the AI-005 source checkout. No deployment; publishes neither Core nor backend.
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,cpSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const source='695ca0524eb039808491b18c69cea1fb74da0cca',root='.ai003-preview';
if(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()!==source)throw Error('Wrong source checkpoint');
execFileSync('git',['diff','--exit-code',source,'--','ai','src','vendor','core','server','scripts','index.html','styles.css','package.json','package-lock.json'],{stdio:'inherit'});
execFileSync(process.execPath,['ai/local/build.mjs'],{stdio:'inherit'});
const patch=(path,from,to)=>{const s=readFileSync(path,'utf8');if(s.split(from).length!==2)throw Error('Patch marker missing/ambiguous: '+path);writeFileSync(path,s.replace(from,to));};
patch(root+'/ai/local/worker.js',"import { LocalMatch }", "import { measuredPolicy, measuredThink } from './worker-perf.js';\nimport { LocalMatch }");
patch(root+'/ai/local/worker.js','prepared.policy);','measuredPolicy(prepared.policy));');
patch(root+'/ai/local/worker.js','send(match.think());','measuredThink(match, send);');
patch(root+'/src/local-ai/client.js','export function createLocalAiWorker() { return new Worker(',"import { attachPreviewPerf } from './preview-perf.js';\nexport function createLocalAiWorker() { return attachPreviewPerf(new Worker(");
patch(root+'/src/local-ai/client.js',"{ type: 'module' }); }","{ type: 'module' })); }");
cpSync('evidence/ai-preview-002/worker-perf.js',root+'/ai/local/worker-perf.js');cpSync('evidence/ai-preview-002/preview-perf.js',root+'/src/local-ai/preview-perf.js');
const build={task:'AI-PREVIEW-002',strategy:'AI-005',sourceCommit:source,sourceTree:execFileSync('git',['rev-parse',source+'^{tree}'],{encoding:'utf8'}).trim(),previewOnlyOverlays:['ai/local/worker.js','ai/local/worker-perf.js','src/local-ai/client.js','src/local-ai/preview-perf.js'],performanceQuery:'?aiPerf=1',productionConnection:false,saveLoadSupported:false};
writeFileSync(root+'/ai003-build.json',JSON.stringify(build,null,2)+'\n');
for(const p of ['ai/fair/basicAgent.js','ai/fair/routing.js']){if(readFileSync(root+'/'+p,'utf8')!==readFileSync('.ai003-dist/'+p,'utf8'))throw Error('Strategy modified');}
execFileSync(process.execPath,['ai/local/audit.mjs'],{stdio:'inherit'});
const entries=[];function walk(dir){for(const name of readdirSync(dir).sort()){const file=dir+'/'+name;if(statSync(file).isDirectory())walk(file);else{const bytes=readFileSync(file);entries.push({path:file.slice(root.length+1),size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),gitBlob:createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')});}}}walk(root);
writeFileSync(root+'/AI-PREVIEW-MANIFEST.json',JSON.stringify({task:'AI-PREVIEW-002',sourceCommit:source,files:entries},null,2)+'\n');
console.log(JSON.stringify({payloadFiles:entries.length,manifest:resolve(root+'/AI-PREVIEW-MANIFEST.json'),source}));
