// Controlled CPU/DOM-operation comparison only. Does not emulate browser paint/input.
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {svgDom} from '../../tests/helpers/performance-dom.mjs';
import '../../tests/helpers/deployment-dom.mjs';
const baseline=process.env.PERF006_BASELINE??'/tmp/ai-perf006-baseline-dist';
const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
const rows=[];
for(let round=0;round<3;round++)for(const [label,dir] of (round%2?[['after','.ai003-dist'],['before',baseline]]:[['before',baseline],['after','.ai003-dist']])){
 const load=p=>import(pathToFileURL(resolve(dir,p)).href);
 const [{LocalMatch},{prepareLocalScenario},{NetworkPlayerSession},{createPresentationState},{DynamicMapRenderer},{coreSvgMarkup}]=await Promise.all(['ai/local/LocalMatch.js','ai/local/scenarios.js','src/multiplayer/networkSession.js','src/state/presentation.js','src/render/dynamicMap.js','src/render/coreSvg.js'].map(load));
 const stages={};const measure=(name,fn)=>{const a=performance.now();try{return fn();}finally{(stages[name]??=[]).push(performance.now()-a);}};
 const setup=prepareLocalScenario({map,seed:17,humanSide:'GERMAN',scenario:'campaign'});
 const m=new LocalMatch(setup.session,'GERMAN',input=>measure('policy',()=>setup.policy(input)));
 const original=m.snapshot.bind(m);m.snapshot=(...args)=>measure('snapshot',()=>original(...args));
 const first=m.snapshot(true);let callback;
 const client={state:{snapshot:first.payload,connection:'CONNECTED',synced:true,pending:false},canMutate:true,subscribe(f){callback=f;return()=>{callback=null;}},send(){return null;},resyncMatch(){throw Error('unexpected resync');},dispose(){}};
 const session=new NetworkPlayerSession(client,createPresentationState(),()=>{});
 const options={debug:false,rendererMode:'production',staticTerrainSurface:true,lod:'medium'};
 const initial=session.renderModel(),root=svgDom(coreSvgMarkup(initial,options)),layer=root.querySelector('#map-dynamic-layer'),renderer=new DynamicMapRenderer();renderer.adopt(layer,initial,options);
 const trace=[];const created=root.ownerDocument.created;
 while(m.shouldThink){
  const message=measure('thinkInclusive',()=>m.think());
  const packet=measure('cloneNodeOnly',()=>structuredClone(message));client.state.snapshot=packet.payload;
  measure('stateApply',()=>callback(packet));
  const model=measure('renderModel',()=>session.renderModel());
  measure('mapUpdateSoftware',()=>renderer.update(layer,model,options));
  trace.push({meta:m.meta,view:packet.payload.view,model:packet.payload.model,revision:packet.payload.matchRevision});
 }
 session.dispose();
 rows.push({round,label,accepted:m.meta.accepted,rejected:m.meta.rejected,hash:createHash('sha256').update(JSON.stringify(trace,(key,value)=>key==='matchId'?'RUN_ID':value)).digest('hex'),createdNodes:root.ownerDocument.created-created,stages:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,{count:v.length,totalMs:v.reduce((a,b)=>a+b,0),maxMs:Math.max(...v),samples:v}]))});
}
if(new Set(rows.map(r=>r.hash)).size!==1)throw Error('behavior changed');
writeFileSync('evidence/ai-perf-006/stages-before-after.json',JSON.stringify({environment:{node:process.version,platform:process.platform,scope:'seed17 initial Soviet AI deployment33, same authorized full map. Software DOM, no browser scheduling, paint, GPU or input measurements.'},rows},null,2));
console.log(rows.map(({round,label,accepted,hash,createdNodes,stages})=>({round,label,accepted,hash,createdNodes,maxMs:Object.fromEntries(Object.entries(stages).map(([k,v])=>[k,v.maxMs]))})));
