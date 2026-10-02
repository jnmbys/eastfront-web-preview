import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const manifest=JSON.parse(readFileSync('scripts/mp011-r1/revision.json'));
for(const [path,expected] of Object.entries(manifest.files))if(createHash('sha256').update(readFileSync(path)).digest('hex')!==expected)throw Error('Revision mismatch: '+path);
execFileSync(process.execPath,['scripts/mp010/integrity.mjs'],{stdio:'inherit'});
const changed=execFileSync('git',['diff','--name-only','3e8d78a67e039ac10ea2eb2943d70fc4138ec9df','--','src','server','scripts/mp010','scripts/mp011','evidence/mp-011','package.json','package-lock.json'],{encoding:'utf8'}).trim();
if(changed)throw Error('Original baseline changed: '+changed);
console.log('MP011R1 independent boundary revision verified: '+manifest.revision);
