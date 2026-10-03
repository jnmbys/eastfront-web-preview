import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verify} from './verify.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),{revision,manifest}=verify();
const frozen=JSON.parse(readFileSync('evidence/mp-009-r1/frozen-audit.json')),checked=new Map(),differences=[];
for(const row of frozen.rows){if(!checked.has(row.path))checked.set(row.path,hash(readFileSync(row.path)));if(checked.get(row.path)!==row.candidate)differences.push({path:row.path,expected:row.candidate,actual:checked.get(row.path)});}
const manifests=frozen.manifests.map(m=>({path:m.manifest,expected:m.sha256,actual:hash(readFileSync(m.manifest))}));
const result={baseline:revision.baseline,protectedPathsUnchanged:true,frozenEntries:frozen.rows.length,uniqueFiles:checked.size,newDifferences:differences,manifests,retainedRedTests:['UA002','UA003','UA003R1'],fullSuiteRerun:false,versions:manifest.versions,treeHashes:Object.fromEntries(Object.entries(manifest.builds).map(([k,v])=>[k,v.treeSha256])),archiveSha256:hash(readFileSync('.mp010-build/mp010-r1-artifacts.zip')),pass:!differences.length&&manifests.every(m=>m.expected===m.actual)};
mkdirSync('evidence/mp-014',{recursive:true});writeFileSync('evidence/mp-014/scope-audit.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({pass:result.pass,frozenEntries:result.frozenEntries,newDifferences:differences.length}));if(!result.pass)process.exitCode=1;
