import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const fixed='3e8d78a67e039ac10ea2eb2943d70fc4138ec9df';
const hash=b=>createHash('sha256').update(b).digest('hex');
const priorFile='evidence/mp-009-r1/frozen-audit.json';
const prior=JSON.parse(readFileSync(priorFile)),files=new Map(),newDifferences=[];
for(const row of prior.rows){
  if(!files.has(row.path))files.set(row.path,hash(readFileSync(row.path)));
  if(files.get(row.path)!==row.candidate)newDifferences.push({path:row.path,expected:row.candidate,actual:files.get(row.path)});
}
const manifests=prior.manifests.map(m=>({path:m.manifest,expected:m.sha256,actual:hash(readFileSync(m.manifest))}));
const protectedPaths=['src','server','vendor','tests/fixtures','scripts/mp010','scripts/mp011','evidence/mp-011','package.json','package-lock.json','docs/MP-009-R1.md','docs/MP-010.md','docs/MP-010-R1.md','evidence/mp-009','evidence/mp-009-r1','evidence/mp-010','evidence/mp-010-r1'];
const changed=execFileSync('git',['diff','--name-only',fixed,'--',...protectedPaths],{encoding:'utf8'}).trim();
const result={at:new Date().toISOString(),fixedCommit:fixed,priorFile,priorSha256:hash(readFileSync(priorFile)),entriesCompared:prior.rows.length,uniqueFiles:files.size,newDifferences,manifests,protectedPaths,changed,retainedRedTests:['UA002','UA003','UA003R1'],fullSuiteRerun:false,pass:!changed&&!newDifferences.length&&manifests.every(m=>m.actual===m.expected)};
writeFileSync('evidence/mp-011-r1/frozen-scope-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,entriesCompared:result.entriesCompared,uniqueFiles:files.size,newDifferences:newDifferences.length,retainedRedTests:result.retainedRedTests}));
if(!result.pass)process.exitCode=1;
