import { t } from '../localization/index.js';
import type { UnitAnimationRuntime } from '../presentation/runtime.js';
import type { AnimationSpeed } from '../presentation/timing.js';

export function animationControls(runtime:UnitAnimationRuntime):string {
  return `<div class="animation-controls"><label for="animation-speed">${t('animation.speed')}</label><select id="animation-speed">${(['normal','fast','instant'] as const).map(speed=>`<option value="${speed}" ${runtime.speed===speed?'selected':''}>${t(`animation.${speed}`)}</option>`).join('')}</select><button id="animation-skip" class="map-control-button" type="button">${t('animation.skip')}</button></div>`;
}
export function bindAnimationControls(root:ParentNode,runtime:UnitAnimationRuntime):void {
  root.querySelector<HTMLSelectElement>('#animation-speed')?.addEventListener('change',event=>{
    const value=(event.currentTarget as HTMLSelectElement).value;
    if(['normal','fast','instant'].includes(value))runtime.setSpeed(value as AnimationSpeed);
  });
  root.querySelector('#animation-skip')?.addEventListener('click',()=>runtime.skip());
}
