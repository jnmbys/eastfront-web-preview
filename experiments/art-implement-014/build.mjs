import {cp,mkdir,rm,readFile,writeFile,readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const root=resolve(import.meta.dirname,'../..'),dir=import.meta.dirname,out=resolve(dir,'dist');
if(out!==resolve(root,'experiments/art-implement-014/dist'))throw Error('Refusing cleanup outside the 014 output directory');
const sourceRoot=resolve(root,'task-source/ART-PREVIEW-002');
await cp(resolve(root,'candidate/vendor'),resolve(sourceRoot,'vendor'),{recursive:true});
execFileSync(process.execPath,[resolve(sourceRoot,'node_modules/typescript/bin/tsc'),'--noEmit'],{cwd:sourceRoot,stdio:'inherit'});
execFileSync(process.execPath,[resolve(sourceRoot,'node_modules/typescript/bin/tsc')],{cwd:sourceRoot,stdio:'inherit'});
await cp(resolve(sourceRoot,'vendor'),resolve(sourceRoot,'dist/vendor'),{recursive:true});
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
const compiled=resolve(root,'task-source/ART-PREVIEW-002/dist');
// Copy only the statically resolved entry dependency closure. No game bootstrap/backend client is served.
const require=createRequire(import.meta.url),ts=require(resolve(root,'task-source/ART-PREVIEW-002/node_modules/typescript'));
const copied=new Set();
async function copyModule(file){if(copied.has(file))return;copied.add(file);const source=resolve(compiled,file),dest=resolve(out,file);await mkdir(resolve(dest,'..'),{recursive:true});await cp(source,dest);if(!file.endsWith('.js'))return;const ast=ts.createSourceFile(file,await readFile(source,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);const imports=[];function visit(node){if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier)imports.push(node.moduleSpecifier.text);if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){if(!ts.isStringLiteral(node.arguments[0]))throw Error('Unresolved dynamic import in '+file);imports.push(node.arguments[0].text);}ts.forEachChild(node,visit);}visit(ast);for(const ref of imports){if(!ref.startsWith('.'))throw Error('Nonlocal runtime dependency '+ref);const next=relative(compiled,resolve(source,'..',ref));if(next.startsWith('..'))throw Error('Escaping runtime dependency');await copyModule(next);}}
await copyModule('app/experiments/artBlend011.js');
for(const n of ['index.html','slice.css'])await cp(resolve(dir,n),resolve(out,n));
await mkdir(resolve(out,'assets'),{recursive:true});
for(const n of ['terrain-atlas.webp','meadow.webp','buildings.webp'])await cp(resolve(root,'experiments/art-slice-005/assets',n),resolve(out,'assets',n));
await cp(resolve(root,'experiments/art-terrain-010/assets/terrain010.webp'),resolve(out,'assets/terrain010.webp'));
await cp(resolve(root,'experiments/art-polish-007/assets/details.webp'),resolve(out,'assets/details.webp'));
await cp(resolve(root,'candidate/vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'),resolve(out,'map.json'));
await writeFile(resolve(out,'_headers'),'/*\n  X-Robots-Tag: noindex, nofollow\n  Cache-Control: no-cache\n');
const entries=[];async function walk(d){for(const e of await readdir(d,{withFileTypes:true})){const p=resolve(d,e.name);if(e.isDirectory())await walk(p);else entries.push({path:relative(out,p),bytes:(await stat(p)).size,sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}}await walk(out);entries.sort((a,b)=>a.path.localeCompare(b.path));
await writeFile(resolve(out,'manifest.json'),JSON.stringify({task:'ART-IMPLEMENT-014',entries},null,2)+'\n');
console.log(JSON.stringify({output:out,files:entries.length,bytes:entries.reduce((s,e)=>s+e.bytes,0)}));
