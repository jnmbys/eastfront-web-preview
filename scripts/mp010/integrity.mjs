import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
export const artifacts=resolve(import.meta.dirname,'../../.mp010-build/artifacts');
const hash=b=>createHash('sha256').update(b).digest('hex');
function files(root){return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]).sort();}
export function verifyArtifacts(root=artifacts){
 const m=JSON.parse(readFileSync(join(root,'manifest.json')));
 for(const [p,digest] of Object.entries(m.harnessHashes??{}))if(hash(readFileSync(join(import.meta.dirname,p)))!==digest)throw Error('Harness changed after build: '+p);
 for(const [label,b] of Object.entries({...m.builds,server:m.server})){
  const dir=join(root,label),paths=files(dir).map(p=>relative(dir,p).replaceAll('\\','/'));
  if(JSON.stringify(paths)!==JSON.stringify(Object.keys(b.hashes)))throw Error('Artifact file inventory differs: '+label);
  for(const p of paths)if(hash(readFileSync(join(dir,p)))!==b.hashes[p])throw Error('Artifact hash differs: '+label+'/'+p);
  if(hash(JSON.stringify(b.hashes))!==b.treeSha256)throw Error('Artifact tree digest differs: '+label);
 }
 return m;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))console.log(JSON.stringify({verified:true,...Object.fromEntries(Object.entries(verifyArtifacts().builds).map(([k,v])=>[k,{sourceSha:v.sourceSha,treeSha256:v.treeSha256}]))},null,2));
