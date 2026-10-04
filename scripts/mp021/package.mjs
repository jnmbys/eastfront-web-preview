import {readFileSync,readdirSync} from 'node:fs';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
export const SOURCE='f1544a2a04417dcf525fe4c4cab621f7f3571ce9',CLIENT='a7dfdd9c57400c6a856186a70d8fb71b118b02dc';
export const root=resolve('.mp010-build/mp021/package');
export const sha=b=>createHash('sha256').update(b).digest('hex');
export function inventory(root){const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(d,e.name)):[join(d,e.name)]);return Object.fromEntries(walk(root).sort().map(p=>[relative(root,p).replaceAll('\\','/'),sha(readFileSync(p))]));}
export function verify(){const m=JSON.parse(readFileSync(join(root,'manifest.json')));if(m.sourceSha!==SOURCE||m.gameplayClientSha!==CLIENT)throw Error('Source mismatch');
 for(const part of ['client','server'])if(JSON.stringify(inventory(join(root,part)))!==JSON.stringify(m.files[part]))throw Error('Package changed: '+part);
 for(const [p,h]of Object.entries(m.harnessHashes))if(sha(readFileSync(p))!==h)throw Error('Harness changed: '+p);
 return m;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename))console.log(JSON.stringify({verified:true,...((m)=>({sourceSha:m.sourceSha,packageTreeSha256:m.packageTreeSha256}))(verify())}));
