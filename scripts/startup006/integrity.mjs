import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
export const SOURCE='380047b5dccd9cc247ac50d4fb3d81a2336df394';
export const DELIVERY='a17478d2848235c0128d4875fc6d86725169d4a2';
export const candidate=resolve('.startup006/candidate');
export const manifest=JSON.parse(readFileSync('evidence/startup-005/candidate-manifest.json'));
export const sha256=b=>createHash('sha256').update(b).digest('hex');
export function verify(){
 if(manifest.sourceCommit!==SOURCE)throw Error('Wrong source');
 for(const f of manifest.files){const bytes=readFileSync(resolve(candidate,f.path));if(bytes.length!==f.bytes||sha256(bytes)!==f.sha256)throw Error('Candidate byte mismatch: '+f.path);}
 if(JSON.parse(readFileSync(resolve(candidate,'diagnostics/transport/build.json'))).sourceCommit!==SOURCE)throw Error('Build metadata mismatch');
 if(JSON.parse(readFileSync(resolve(candidate,'multiplayer-config.json'))).serverUrl!=='')throw Error('Candidate has a configured multiplayer service');
 return {sourceCommit:SOURCE,deliveryHead:DELIVERY,files:manifest.files.length,zipSha256:manifest.zipSha256};
}
