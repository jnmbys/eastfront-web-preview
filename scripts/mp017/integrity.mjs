import {readFileSync,readdirSync} from 'node:fs';
import {resolve,relative,join} from 'node:path';
import {createHash} from 'node:crypto';
import {VERSIONS,SERVER_SHA,FORMAT} from './config.mjs';
export const artifacts=resolve(import.meta.dirname,'../../.mp010-build/mp017/artifacts');
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function inventory(root){const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):[join(dir,e.name)]);return Object.fromEntries(walk(root).sort().map(p=>[relative(root,p).replaceAll('\\','/'),hash(readFileSync(p))]));}
export function verifyArtifacts(){
 const m=JSON.parse(readFileSync(join(artifacts,'manifest.json')));
 if(JSON.stringify(m.versions)!==JSON.stringify(VERSIONS)||m.serverSha!==SERVER_SHA||m.snapshotFormat!==FORMAT)throw Error('MP017 version mismatch');
 for(const[p,h]of Object.entries(m.harnessHashes))if(hash(readFileSync(p))!==h)throw Error('Harness revision changed: '+p);
 for(const[label,b]of Object.entries({...m.builds,server:m.server})){const current=inventory(join(artifacts,label));if(JSON.stringify(current)!==JSON.stringify(b.hashes)||hash(JSON.stringify(current))!==b.treeSha256)throw Error('Package mismatch: '+label);}
 return m;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){const m=verifyArtifacts();console.log(JSON.stringify({verified:true,versions:m.versions,server:m.server.treeSha256,builds:Object.fromEntries(Object.entries(m.builds).map(([k,v])=>[k,v.treeSha256])),diagnosticSha256:m.diagnosticSha256},null,2));}
