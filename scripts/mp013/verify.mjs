import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {verifyArtifacts} from '../mp010/integrity.mjs';
export function verify(){
  const revision=JSON.parse(readFileSync('scripts/mp013/revision.json'));
  for(const [path,expected] of Object.entries(revision.files))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw Error('MP013 integration hash mismatch: '+path);
  const previous=JSON.parse(readFileSync('scripts/mp011-r1/revision.json'));
  for(const [path,expected] of Object.entries(previous.files))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw Error('Existing access boundary changed: '+path);
  const changed=execFileSync('git',['diff','--name-only',revision.baseline,'--','src','server','vendor','scripts/mp010','scripts/mp011','scripts/mp011-r1','scripts/mp012','evidence/mp-009','evidence/mp-009-r1','evidence/mp-010','evidence/mp-010-r1','evidence/mp-011','evidence/mp-011-r1','evidence/mp-012','tests/fixtures','package.json','package-lock.json'],{encoding:'utf8'}).trim();
  if(changed)throw Error('Protected baseline changed: '+changed);
  const manifest=verifyArtifacts();return {revision,manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){verify();console.log('MP013 integration, unchanged MP011-R1 boundary and pinned A/B packages verified');}
