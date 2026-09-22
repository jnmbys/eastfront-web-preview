// Public fixture inputs only. Baseline golden RGBA hashes were captured at 307cd9b.
import {readFileSync} from 'node:fs';
import {createLocalGameSession,dispatchGameAction,sessionPlayerView,setActiveViewer} from '../../dist/app/core-adapter/session.js';
import {deriveBrowserRenderModel} from '../../dist/app/render/coreModel.js';
import {createPresentationState} from '../../dist/app/state/presentation.js';
import {deriveFogPlan} from '../../dist/app/fog/surface.js';
export function fogCases(){
 const map=JSON.parse(readFileSync('vendor/eastfront-digital-core/reference/strategic-reset-f-map.json'));
 const s=createLocalGameSession(map,8246),out=[];
 const add=name=>{const view=sessionPlayerView(s);for(const kind of ['fog','recon'])out.push({name:name+':'+kind,kind,plan:deriveFogPlan(view,view.units.find(u=>u.type==='RECON')?.id??null)});};
 add('empty');const initial=deriveBrowserRenderModel(s,createPresentationState()).deployment;
 // Use the same legal sequential hexes as the full deployment regression.
 for(let i=0;i<initial.roster.length;i++){
  const [q,r]=initial.zoneKeys[i].split(',').map(Number);
  const result=dispatchGameAction(s,{type:'DEPLOY_INITIAL_UNIT',controllerId:s.activeViewerControllerId,deploymentUnitId:initial.roster[i].id,hex:{q,r}}).result;
  if(!result.accepted)throw Error('Fixture deployment rejected');add('deploy-'+(i+1));
 }
 const german=Object.values(s.state.controllers).find(c=>c.side==='GERMAN').id;setActiveViewer(s,german);add('other-viewer');
 return out;
}
