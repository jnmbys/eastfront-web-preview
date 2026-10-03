import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {verify as verifyPrevious} from '../mp013/verify.mjs';
export function verify(){
  const previous=verifyPrevious(),revision=JSON.parse(readFileSync('scripts/mp014/revision.json'));
  for(const [path,expected] of Object.entries(revision.files))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw Error('MP014 hash mismatch: '+path);
  const changed=execFileSync('git',['diff','--name-only',revision.baseline,'--','scripts/mp013','evidence/mp-013','docs/MP-013.md','docs/MP-013-operation-card.md'],{encoding:'utf8'}).trim();
  if(changed)throw Error('MP013 baseline changed: '+changed);
  return {revision,manifest:previous.manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){verify();console.log('MP014 revision and unchanged MP013/MP012/auth/client packages verified');}
