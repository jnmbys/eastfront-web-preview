import {parseParameters} from '../fair/parameters.ts';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,join,relative} from 'node:path';
export const root=resolve(new URL('../..',import.meta.url).pathname);
export const baseline='695ca0524eb039808491b18c69cea1fb74da0cca';
export const versions=['ai005','minimal','ai005-param-v1'];
export const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
export function atomic(path,data){writeFileSync(path+'.tmp',JSON.stringify(data,null,2)+'\n');renameSync(path+'.tmp',path);}
function integer(v,min,max,name){if(!Number.isSafeInteger(v)||v<min||v>max)throw Error(`Invalid ${name}: ${min}..${max}`);}
function keys(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Unknown/malformed configuration fields');}
export function validate(c){
 keys(c,['seeds','baseline','candidate','limits']);keys(c.seeds,['tune','holdout']);keys(c.limits,['maxGames','maxDecisions','matchMs','batchMs']);
 for(const split of ['tune','holdout']){const seeds=c.seeds[split];if(!Array.isArray(seeds)||!seeds.length||seeds.length>100)throw Error('Each seed split needs 1..100 seeds');for(const seed of seeds)integer(seed,0,4294967295,'seed');if(new Set(seeds).size!==seeds.length)throw Error('Duplicate seed');}
 if(c.seeds.tune.some(s=>c.seeds.holdout.includes(s)))throw Error('Tune/holdout seeds overlap');
 for(const name of ['baseline','candidate']){const p=c[name];keys(p,['version','params']);if(!versions.includes(p.version))throw Error('Unregistered policy');if(p.version==='ai005-param-v1')p.params=parseParameters(p.params);else keys(p.params,[]);}
 if(c.baseline.version!=='ai005')throw Error('Comparison baseline must be frozen AI-005');
 integer(c.limits.maxGames,2,400,'maxGames');if(c.limits.maxGames%2)throw Error('maxGames must cover seat pairs');integer(c.limits.maxDecisions,1,10000,'maxDecisions');integer(c.limits.matchMs,50,600000,'matchMs');integer(c.limits.batchMs,50,3600000,'batchMs');
 return c;
}
export function jobs(c,split){if(!['tune','holdout'].includes(split))throw Error('Select tune or holdout explicitly');return c.seeds[split].flatMap(seed=>['GERMAN','SOVIET'].map(candidateSide=>({id:`${split}-${seed}-${candidateSide}`,split,seed,candidateSide,seats:{GERMAN:candidateSide==='GERMAN'?c.candidate:c.baseline,SOVIET:candidateSide==='SOVIET'?c.candidate:c.baseline}}))).slice(0,Math.floor(c.limits.maxGames/2)*2);}
function files(dir){return readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);}
export function identity(){
 // Rebuild before hashing; record source bytes in addition to the checkout commit.
 const tracked=execFileSync('git',['ls-files','ai/fair','ai/authority','src','vendor','ai/lab'],{cwd:root,encoding:'utf8'}).trim().split('\n');
 const frozen=execFileSync('git',['diff',baseline,'--','ai/fair','ai/authority','vendor',':(exclude)ai/fair/basicAgent.ts',':(exclude)ai/fair/parameters.ts'],{cwd:root,encoding:'utf8'});if(frozen.trim())throw Error('Frozen fair/authority/Core differs from AI-005');
 const original=execFileSync('git',['show',baseline+':ai/fair/basicAgent.ts'],{cwd:root,encoding:'utf8'});
 if(readFileSync(join(root,'ai/lab/frozenBasic.ts'),'utf8')!==original.replaceAll("from './","from '../fair/"))throw Error('Frozen baseline policy changed');
 const sourceHash=hash(tracked.map(p=>[p,hash(readFileSync(join(root,p)))]));
 const built=files(join(root,'.ai-dist')).filter(p=>p.endsWith('.js'));
 return {sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baselineCommit:baseline,sourceHash,runtimeHash:hash(built.map(p=>[relative(root,p),hash(readFileSync(p))])),labHash:hash(files(join(root,'ai/lab')).map(p=>[relative(root,p),hash(readFileSync(p))])),node:process.version};
}
