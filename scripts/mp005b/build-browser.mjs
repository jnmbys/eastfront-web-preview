// Test-only compiled copies; normal Pages entry uses uninstrumented production modules.
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,relative} from 'node:path';
import ts from 'typescript';
const out='dist/diagnostics/mp005b';mkdirSync(out,{recursive:true});cpSync('dist/app',out+'/app',{recursive:true});cpSync('dist/vendor',out+'/vendor',{recursive:true});
for(const [file,targets] of Object.entries({'multiplayer/snapshotCodec.js':['decodeSnapshot'],'multiplayer/networkSession.js':['NetworkPlayerSession.receive'],'main.js':['refreshDynamicView']})){
 let code=readFileSync(out+'/app/'+file,'utf8'),edits=[],found=[];const ast=ts.createSourceFile(file,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const visit=(node,owner='')=>{if(ts.isClassDeclaration(node))owner=node.name?.text??'';
  const name=ts.isFunctionDeclaration(node)?node.name?.text:ts.isMethodDeclaration(node)?owner+'.'+node.name.getText(ast):null;
  if(targets.includes(name)&&node.body){found.push(name);edits.push([node.body.getStart(ast)+1,`const __end=mp5.begin(${JSON.stringify(name)},arguments[0]);try{`],[node.body.end-1,'}finally{__end();}']);}ts.forEachChild(node,n=>visit(n,owner));};visit(ast);
 if(found.length!==targets.length)throw Error('Missing instrumentation target '+file);
 for(const [offset,text] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,offset)+text+code.slice(offset);
 const path=relative(dirname(file),'mp005bTrace.js').replaceAll('\\','/');writeFileSync(out+'/app/'+file,`import {mp5} from '${path.startsWith('.')?path:'./'+path}';\n`+code);
}
let client=readFileSync(out+'/app/multiplayer/client.js','utf8');
for(const [old,next] of [
 ['let message;','const __arrival=performance.now();let message;'],
 ['message = JSON.parse(raw);','const __parse=performance.now();message = JSON.parse(raw);mp5.incoming(message,raw,__arrival,performance.now()-__parse);']
]){if(!client.includes(old))throw Error('Missing native message target');client=client.replace(old,next);}
writeFileSync(out+'/app/multiplayer/client.js',"import {mp5} from '../mp005bTrace.js';\n"+client);
cpSync('scripts/mp005b/browser-trace.js',out+'/app/mp005bTrace.js');
writeFileSync(out+'/index.html',readFileSync('dist/index.html','utf8').replace('<head>','<head><base href="../../">').replace('./app/main.js','./diagnostics/mp005b/app/main.js'));
console.log(out);
