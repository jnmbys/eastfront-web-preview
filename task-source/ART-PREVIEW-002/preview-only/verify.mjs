import {createHash} from 'node:crypto';import assert from 'node:assert/strict';import {readFile,readdir,stat,writeFile} from 'node:fs/promises';import {resolve,dirname} from 'node:path';import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'preview-dist');const reports=[];
for(const scene of ['movement','combat']){
 const results=[];
 for(const variant of ['baseline','candidate']){const d=resolve(out,variant),imp=p=>import(pathToFileURL(resolve(d,p)).href),{createScene}=await imp('preview/scene.mjs'),{deriveBrowserRenderModel}=await imp('app/render/coreModel.js'),{createPresentationState}=await imp('app/state/presentation.js');const raw=JSON.parse(await readFile(resolve(d,'vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'),'utf8')),f=createScene(raw,scene),p=createPresentationState(false,false);if(f.battleId)p.selectedBattleId=f.battleId;const model=deriveBrowserRenderModel(f.session,p);results.push({model,actions:f.actions});
 if(scene==='combat'){assert.equal(f.session.state.combatTransactions[f.battleId].stage,'CLOSED');const {combatResults}=await imp('app/ui/combatResult.js');const res=combatResults(f.session),html=res.html(model,false);assert(html.includes('result-close'));res.close();assert(res.html(model,false).includes('data-result-history'));assert(res.open(f.battleId));}
 }
 assert.deepEqual(results[0],results[1]);if(scene==='movement'){const previous=JSON.parse(await readFile(resolve(root,'preview-only/reference-local-scene.json'),'utf8'));assert.deepEqual(results[1].model,previous.model);}
 reports.push({scene,actions:results[0].actions.length,hexes:results[0].model.hexes.length,visibleUnits:results[0].model.counters.length,equivalent:true});
}
async function files(dir){return (await Promise.all((await readdir(dir)).map(async n=>{const p=resolve(dir,n);return (await stat(p)).isDirectory()?files(p):[p];}))).flat();}
let links=0;
for(const variant of ['baseline','candidate']){
 const dir=resolve(out,variant);for(const f of await files(resolve(dir,'app'))){if(!f.endsWith('.js'))continue;const js=await readFile(f,'utf8');for(const m of js.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)){await stat(resolve(dirname(f),m[1]));links++;}}
 assert.equal(JSON.parse(await readFile(resolve(dir,'multiplayer-config.json'),'utf8')).serverUrl,'');
 const main=await readFile(resolve(dir,'app/main.js'),'utf8');assert(main.includes('enterArtPreview()'));assert(!main.includes('addMultiplayerHomeButton(root,'));assert(main.includes('await boot()'));
 const vs=JSON.parse(await readFile(resolve(dir,'app/assets/VS2_ASSET_MANIFEST.json'),'utf8'));for(const asset of vs.assets)await stat(resolve(dir,'assets/terrain/vs2-002',asset.file));
 // Exact asset references read from public manifest, without fetching a browser URL.
 const manifest=JSON.parse(await readFile(resolve(dir,'assets/terrain/p4r3/manifest.json'),'utf8'));
 const paths=[];function walk(v){if(typeof v==='string'&&/\.png$/.test(v))paths.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);}walk(manifest);for(const p of new Set(paths)){await stat(resolve(dir,'assets/terrain/p4r3',p));}
}
const normal=await readFile(resolve(root,'dist/app/main.js'),'utf8');assert(!normal.includes('enterArtPreview'));assert(!normal.includes('createArtPreviewScene'));assert(normal.includes('addMultiplayerHomeButton(root,'));
const result={scenes:reports,moduleLinksVerified:links,normalBuildHasNoPreviewEntry:true,productionConnectionsDisabled:true,combatCloseReopenLogic:true,browserExecuted:false};await writeFile(resolve(root,'../evidence/preview-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
