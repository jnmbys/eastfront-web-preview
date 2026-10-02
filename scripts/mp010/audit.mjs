import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {VERSIONS} from './config.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),path='evidence/mp-009-r1/frozen-audit.json',bytes=readFileSync(path),prior=JSON.parse(bytes),seen=new Map();
for(const row of prior.rows){if(!seen.has(row.path))seen.set(row.path,hash(readFileSync(row.path)));if(seen.get(row.path)!==row.candidate)throw Error('New frozen byte difference: '+row.path);}
for(const m of prior.manifests)if(hash(readFileSync(m.manifest))!==m.sha256)throw Error('Frozen manifest changed: '+m.manifest);
const protectedPaths=['src','server','vendor','tests/fixtures','docs/MP-009-R1.md','evidence/mp-009-r1','evidence/mp-009'];
const changed=execFileSync('git',['diff','--name-only',VERSIONS.candidate,'--',...protectedPaths],{encoding:'utf8'}).trim();if(changed)throw Error('Protected baseline changed: '+changed);
const priorPreparation='a414749358073b8db5a857940dc0b937087da20f';
const preserved=execFileSync('git',['diff','--name-only',priorPreparation,'--','evidence/mp-010','docs/MP-010.md'],{encoding:'utf8'}).trim();if(preserved)throw Error('Original MP010 evidence changed: '+preserved);
writeFileSync('evidence/mp-010-r1/frozen-scope-audit.json',JSON.stringify({candidate:VERSIONS.candidate,control:VERSIONS.control,priorPreparation,originalMP010EvidenceChanged:false,priorAudit:path,priorAuditSha256:hash(bytes),entriesCompared:prior.rows.length,uniqueFiles:seen.size,newDifferences:0,manifestChanges:0,retainedFailingTests:['UA002','UA003','UA003R1'],protectedPaths,changed,actualHashes:Object.fromEntries(seen)},null,2)+'\n');
console.log(`MP010 audit: ${prior.rows.length} entries / ${seen.size} files unchanged from R1; three red tests retained`);
