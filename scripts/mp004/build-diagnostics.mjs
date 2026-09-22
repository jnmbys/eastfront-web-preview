// Instrument compiled copies only. Production source and protocol are unchanged.
import {cpSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import ts from 'typescript';
const mode=process.argv[2]??'browser',label=process.argv[3]??'before';
const out=resolve(`../mp004-evidence/${mode}-${label}`);
mkdirSync(out,{recursive:true});
cpSync(mode==='browser'?'dist/app':'.server-dist',mode==='browser'?out+'/app':out,{recursive:true});
const root=mode==='browser'?out+'/app':out;
const targets=mode==='browser'?{
 'main.js':['refreshDynamicView','updateNetworkStatus'],
 'multiplayer/client.js':['LobbyClient.receive','LobbyClient.notify'],
 'multiplayer/networkSession.js':['NetworkPlayerSession.receive'],
}:{
 'server/authority.js':['RoomAuthority.receive','RoomAuthority.handle','RoomAuthority.emit','RoomAuthority.snapshot','RoomAuthority.broadcastSnapshots'],
 'server/gameplay.js':['validateIntent','applyIntent','queryModel','forcedAction'],
 'server/match.js':['playerSnapshot'],
 'src/core-adapter/session.js':['dispatchGameAction'],
 'src/core-adapter/browserProjection.js':['deriveBrowserRenderModel'],
 'src/player-view/playerView.js':['derivePlayerView'],
};
for(const [file,names]of Object.entries(targets)){
 const path=root+'/'+file;let code=readFileSync(path,'utf8');const edits=[],found=[];
 const ast=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function visit(n,owner=''){
  if(ts.isClassDeclaration(n))owner=n.name?.text??'';
  const name=ts.isFunctionDeclaration(n)?n.name?.text:ts.isMethodDeclaration(n)?owner+'.'+n.name.getText(ast):null;
  if(name&&names.includes(name)&&n.body){found.push(name);edits.push([n.body.getStart(ast)+1,`const __end=trace.begin(${JSON.stringify(name)});try{`],[n.body.end-1,'}finally{__end();}']);}
  ts.forEachChild(n,c=>visit(c,owner));
 }visit(ast);
 if(found.length!==names.length)throw Error('Missing diagnostic target '+file);
 for(const [i,s]of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,i)+s+code.slice(i);
 if(file==='multiplayer/client.js')code=code.replace('JSON.parse(String(event.data))','trace.parse(String(event.data))');
 const imp=relative(dirname(file),'mp004Trace.js').replaceAll('\\','/');
 writeFileSync(path,`import {trace} from '${imp.startsWith('.')?imp:'./'+imp}';\n`+code);
}
cpSync(`scripts/mp004/${mode}-trace.js`,root+'/mp004Trace.js');
if(mode==='browser'){
 const index=readFileSync('dist/index.html','utf8').replace('<head>','<head><base href="../../">').replace('./app/main.js',`./previews/mp004-${label}/app/main.js`);
 writeFileSync(out+'/index.html',index);
}else{
 const path=out+'/server/runtime.js';let code=readFileSync(path,'utf8');
 code=code.replace("import { PROTOCOL_VERSION }", "import {trace} from '../mp004Trace.js';\nimport { PROTOCOL_VERSION }");
 code=code.replace('ws.send(JSON.stringify(message),', 'const __send=trace.send(message,ws.bufferedAmount); ws.send(__send.text,');
 code=code.replace(/error => \{\s*if \(error\)/, 'error => {__send.complete(ws.bufferedAmount,!!error);if (error)');
 if(!code.includes('__send.complete'))throw Error('Transport diagnostic target missing');
 writeFileSync(path,code);
}
console.log(out);
