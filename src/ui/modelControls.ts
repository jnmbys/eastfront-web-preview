import { t } from '../localization/index.js';
import {saveModelDisplay,type ModelDisplay} from '../presentation/modelDisplay.js';
import type {UnitAnimationRuntime} from '../presentation/runtime.js';
export function modelControls(runtime:UnitAnimationRuntime):string {
 return `<label class="model-controls" for="unit-models">${t('models.label')} <select id="unit-models">${(['auto','off'] as const).map(mode=>`<option value="${mode}" ${runtime.modelDisplay===mode?'selected':''}>${t(`models.${mode}`)}</option>`).join('')}</select></label>`;
}
export function bindModelControls(root:ParentNode,runtime:UnitAnimationRuntime):void {
 root.querySelector<HTMLSelectElement>('#unit-models')?.addEventListener('change',event=>{const mode=(event.currentTarget as HTMLSelectElement).value;if(mode!=='auto'&&mode!=='off')return;runtime.setModelDisplay(mode as ModelDisplay);saveModelDisplay(mode);});
}
