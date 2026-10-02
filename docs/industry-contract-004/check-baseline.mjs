import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {baseline} from './baseline.mjs';
export const hash=x=>createHash('sha256').update(x).digest('hex');
export const canonical=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function checkBaseline(){
 const path=new URL('../industry-integration-003/LEDGER_DATA.json',import.meta.url),bytes=readFileSync(path),data=JSON.parse(bytes),runs=[...data.main,data.control],results=[];
 function diff(a,b,path='$'){if(typeof a!==typeof b||a===null||b===null||typeof a!=='object')return a===b?null:{path,expected:a,actual:b};const ka=Object.keys(a),kb=Object.keys(b);if(ka.length!==kb.length)return {path,expectedKeys:ka,actualKeys:kb};for(const k of ka){const d=diff(a[k],b[k],path+'.'+k);if(d)return d;}return null;}
 for(const saved of runs){const calculated=baseline(saved.summary.route,saved.summary.params),mismatch=diff(saved,calculated);results.push({route:saved.summary.route,rows:saved.rows.length,savedSemanticSHA256:hash(canonical(saved)),calculatedSemanticSHA256:hash(canonical(calculated)),exactMatch:mismatch===null,firstMismatch:mismatch});}
 const evidence={baselineCommit:'5cac9bd81a9776b8a2e2837f33818c0c72561ba4',inputPath:'../industry-integration-003/LEDGER_DATA.json',inputFileSHA256:hash(bytes),comparison:'Every summary value, all 96 rows, all per-unit actions and end-epoch state; JSON key order ignored, no numeric tolerance.',results,passed:results.every(r=>r.exactMatch)};
 writeFileSync(new URL('BASELINE_AUDIT.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');if(!evidence.passed)throw Error('Exact baseline reconstruction failed; see BASELINE_AUDIT.json. Stop candidate calculation.');return {data,runs,evidence};
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(checkBaseline().evidence,null,2));
