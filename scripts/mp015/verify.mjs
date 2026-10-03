import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {verify as previous} from '../mp014/verify.mjs';
export function verify(){
  const original=previous(),revision=JSON.parse(readFileSync('scripts/mp015/revision.json'));
  for(const [path,expected] of Object.entries(revision.files))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw Error('MP015 preparation hash mismatch: '+path);
  const paths=['src','server','vendor','scripts/mp010','scripts/mp011','scripts/mp011-r1','scripts/mp012','scripts/mp013','scripts/mp014','scripts/mp014-public','evidence/mp-007','evidence/mp-008','evidence/mp-009','evidence/mp-009-r1','evidence/mp-010','evidence/mp-010-r1','evidence/mp-011','evidence/mp-011-r1','evidence/mp-012','evidence/mp-013','evidence/mp-014','evidence/mp-014-public','tests/fixtures','package.json','package-lock.json'];
  const changed=execFileSync('git',['diff','--name-only',revision.baseline,'--',...paths],{encoding:'utf8'}).trim();
  if(changed)throw Error('Fixed runtime or historical evidence changed: '+changed);
  return {revision,manifest:original.manifest};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){verify();console.log('MP015 preparation verified; fixed runtime and historical evidence unchanged');}
