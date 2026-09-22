import {readFileSync,writeFileSync,mkdirSync,cpSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import ts from 'typescript';
const label=process.argv[2]??'baseline',out=resolve(process.argv[3]??`../perf004-evidence/${label}`);
mkdirSync(out,{recursive:true});cpSync((process.env.PERF004_BASE_DIST??'dist')+'/app',out+'/app',{recursive:true});
const targets={
 'main.js':['refreshDynamicView','paintDeploymentFocus','syncFogSurface','bindDynamic','deploymentPanel','sidePanelMarkup','render'],
 'fog/runtime.js':['encode','FogRuntime.sync'], 'fog/surface.js':['deriveFogPlan','rasterizeFog','groundFor'],
 'presentation/runtime.js':['UnitAnimationRuntime.sync'], 'presentation/svgUnits.js':['SvgUnitPresentation.bind','SvgUnitPresentation.paint'],
 'presentation/unitPresence.js':['UnitPresenceLayer.bind','UnitPresenceLayer.create','UnitPresenceLayer.unmount'],
 'presentation/unitPresenceSvg.js':['createPresenceDefinitions'],
 'render/dynamicMap.js':['DynamicMapRenderer.update','DynamicMapRenderer.updateDeployment'],
 'ui/deploymentPanelRenderer.js':['DeploymentPanelRenderer.update'],
 'ui/commandPresentation.js':['deploymentLocations','commandHeader'],
 'core-adapter/session.js':['sessionPlayerView','dispatchGameAction'],
 'core-adapter/browserProjection.js':['deriveBrowserRenderModel'],
 'multiplayer/networkSession.js':['NetworkPlayerSession.receive','NetworkPlayerSession.renderModel'],
};
for(const [file,names] of Object.entries(targets)){
 const path=out+'/app/'+file;let code=readFileSync(path,'utf8'),edits=[];const found=[];
 const ast=ts.createSourceFile(path,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 function visit(n,owner=''){
  if(ts.isClassDeclaration(n))owner=n.name?.text??'';
  const name=(ts.isFunctionDeclaration(n)?n.name?.text:ts.isMethodDeclaration(n)?owner+'.'+n.name.getText(ast):null);
  if(name&&names.includes(name)&&n.body){found.push(name);edits.push([n.body.getStart(ast)+1,`const __p4end=perf4.begin(${JSON.stringify(file+':'+name)});try{`],[n.body.end-1,'}finally{__p4end();}']);}
  ts.forEachChild(n,c=>visit(c,owner));
 }visit(ast);
 if(found.length!==names.length)throw Error(file+' missing '+names.filter(n=>!found.includes(n)));
 for(const [offset,text] of edits.sort((a,b)=>b[0]-a[0]))code=code.slice(0,offset)+text+code.slice(offset);
 if(file==='main.js'){
  for(const [variable,selector] of [['panelScroll','.command-panel-scroll'],['rosterScroll','.roster-list'],['locationScroll','.location-grid']]){
   const old=`panel.querySelector('${selector}')?.scrollTop ?? 0`;
   if(!code.includes(old))throw Error('Missing scroll read '+variable);
   code=code.replace(old,`perf4.sync('layout:read-${variable}',()=>${old})`);
  }
  for(const [element,variable] of [['scroll','panelScroll'],['roster','rosterScroll'],['locations','locationScroll']]){
   const old=`${element}.scrollTop = ${variable};`;
   if(!code.includes(old))throw Error('Missing scroll write '+variable);
   code=code.replace(old,`perf4.sync('layout:write-${variable}',()=>{${old}});`);
  }
 }
 if(file==='fog/runtime.js'){
  code=code.replace('ctx.putImageData(data, 0, 0);',"perf4.sync('fog:upload',()=>ctx.putImageData(data, 0, 0));");
  code=code.replace("return canvas.toDataURL('image/png');","return perf4.sync('fog:encodePNG',()=>canvas.toDataURL('image/png'));");
 }
 const imp=relative(dirname(file),'perf004Trace.js').replaceAll('\\','/');code=`import {perf4} from '${imp.startsWith('.')?imp:'./'+imp}';\n`+code;writeFileSync(path,code);
}
writeFileSync(out+'/app/perf004Trace.js',readFileSync('scripts/perf004/trace.js','utf8'));
const index=readFileSync('dist/index.html','utf8').replace('<head>','<head><base href="../../">').replace('./app/main.js',`./previews/perf004-${label}/app/main.js`);
writeFileSync(out+'/index.html',index);
console.log(out);
