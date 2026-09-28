import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
import ts from '../task-source/ART-PREVIEW-002/node_modules/typescript/lib/typescript.js';
const root=resolve(import.meta.dirname,'..'),accepted=resolve(root,'candidate'),rebuilt=resolve(root,'task-source/ART-PREVIEW-002/dist'),out=resolve(root,'evidence/ART-BUILD-003');
async function files(dir){const result={};for(const e of await readdir(dir,{withFileTypes:true})){const p=resolve(dir,e.name);if(e.isDirectory())Object.assign(result,await files(p));else result[p]=createHash('sha256').update(await readFile(p)).digest('hex');}return result;}
const x=Object.fromEntries(Object.entries(await files(accepted)).map(([p,h])=>[relative(accepted,p),h])),y=Object.fromEntries(Object.entries(await files(rebuilt)).map(([p,h])=>[relative(rebuilt,p),h]));
const differences=[];const printer=ts.createPrinter({removeComments:true,newLine:ts.NewLineKind.LineFeed});
for(const p of [...new Set([...Object.keys(x),...Object.keys(y)])].sort())if(x[p]!==y[p]){
 const d={path:p,accepted:x[p]??null,rebuilt:y[p]??null};
 if(p.endsWith('.js')&&x[p]&&y[p]){
  const a=ts.createSourceFile(p,await readFile(resolve(accepted,p),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),b=ts.createSourceFile(p,await readFile(resolve(rebuilt,p),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  d.parseErrors=[a.parseDiagnostics.length,b.parseDiagnostics.length];d.commentFreePrintedSyntaxEqual=printer.printFile(a)===printer.printFile(b);
 }
 differences.push(d);
}
const report={acceptedCommit:'8778cb4f307c3d01f471ac2b326f8beef4c5f500',acceptedFiles:Object.keys(x).length,rebuiltFiles:Object.keys(y).length,byteIdentical:differences.length===0,differences,rebuiltHashes:y};
await mkdir(out,{recursive:true});await writeFile(resolve(out,'artifact-diff.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,rebuiltHashes:undefined},null,2));
if(differences.some(d=>d.commentFreePrintedSyntaxEqual!==true||d.parseErrors?.some(Boolean)))process.exitCode=1;
