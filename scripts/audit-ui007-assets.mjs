import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const runtime=new URL('../public/assets/terrain/p4r3/',import.meta.url);
const baseline=new URL('../public/dev-assets/terrain/p4r3-baseline/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',runtime),'utf8'));
const refs=[...new Set(manifest.assets.flatMap(e=>e.companion?[e.file,e.companion]:[e.file]))].sort();
const csv=(await readFile(new URL('../docs/p5-handoff/P5_ASSET_HASHES.csv',import.meta.url),'utf8')).replace(/^\uFEFF/,'').trim().split(/\r?\n/);
const expected=new Map(csv.slice(1).map(line=>{const c=line.split(',');return [c[0],{p4:c[3],p5:c[4],status:c[5]}]}));
const p5r1=JSON.parse(await readFile(new URL('../docs/p5r1-handoff/P5R1_CHANGED_ASSETS.json',import.meta.url),'utf8')).changedProductionAssets[0];
const sha=async url=>createHash('sha256').update(await readFile(url)).digest('hex');
let changed=0,unchanged=0,payload=0,p5r1Changed=0,p5Unchanged=0;const errors=[];
for(const rel of refs){const exp=expected.get(rel);if(!exp){errors.push(`missing expected hash ${rel}`);continue;}const r=new URL(rel,runtime),b=new URL(rel,baseline);try{const rs=await sha(r),bs=await sha(b);payload+=(await stat(r)).size;const want=rel===p5r1.file?p5r1.afterSHA256:exp.p5;if(rs!==want)errors.push(`runtime mismatch ${rel}`);if(bs!==exp.p4)errors.push(`baseline P4R3 mismatch ${rel}`);if(rel===p5r1.file){if(rs!==exp.p5)p5r1Changed++;}else if(rs===exp.p5)p5Unchanged++;rs===bs?unchanged++:changed++;}catch(e){errors.push(`missing ${rel}: ${e.message}`);}}
const msha=await sha(new URL('manifest.json',runtime)),bsha=await sha(new URL('manifest.json',baseline));
if(msha!==bsha)errors.push('manifest differs from P4R3/P5 baseline');
const result={result:errors.length?'FAIL':'CLEAN',runtimeRasterCount:refs.length,changedFromP4R3:changed,unchangedFromP4R3:unchanged,p5r1ChangedRasterCount:p5r1Changed,p5BaselineUnchangedRasterCount:p5Unchanged,runtimePayloadBytes:payload,runtimePayloadMiB:Number((payload/1024/1024).toFixed(3)),manifestSha256:msha,p5r1Asset:p5r1.file,p5r1RuntimeSha256:await sha(new URL(p5r1.file,runtime)),errors};
console.log(JSON.stringify(result,null,2));if(errors.length||refs.length!==123||changed!==73||unchanged!==50||p5r1Changed!==1||p5Unchanged!==122)process.exit(1);
