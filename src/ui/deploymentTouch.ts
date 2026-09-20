import type {LocalGameSession} from '../core-adapter/session.js';
import type {PresentationState} from '../state/presentation.js';
import type {BrowserRenderModel} from '../render/coreModel.js';
import {deploySelectedUnit} from '../interaction/intents.js';
export interface DeploymentTouch {unitId:string|null;key:string|null;status:'idle'|'selected'|'deployed'|'invalid';message:string;}
export const createDeploymentTouch=():DeploymentTouch=>({unitId:null,key:null,status:'idle',message:''});
export function chooseDeploymentTarget(ui:DeploymentTouch,model:BrowserRenderModel,unitId:string|null,key:string):boolean{
 const row=model.deployment?.roster.find(r=>r.id===unitId);
 if(!row||row.placed||model.viewerSide!==model.activeSide||!model.deployment?.zoneKeys.includes(key))return false;
 ui.unitId=unitId;ui.key=key;ui.status='selected';ui.message='Position selected. Confirm to deploy.';return true;
}
export function confirmDeploymentTarget(ui:DeploymentTouch,session:LocalGameSession,presentation:PresentationState):void{
 if(!ui.key||!ui.unitId||ui.unitId!==presentation.selectedDeploymentUnitId){ui.status='invalid';ui.message='Select a unit and a deployment position again.';return;}
 const id=ui.unitId,[q,r]=ui.key.split(',').map(Number);
 deploySelectedUnit(session,presentation,{q:q!,r:r!});
 const accepted=session.lastResult?.accepted===true;
 ui.status=accepted?'deployed':'invalid';ui.message=accepted?`${id} deployed. Next reserve selected when available.`:(presentation.message??'Deployment rejected.');
 if(accepted){ui.key=null;ui.unitId=null;}
}
