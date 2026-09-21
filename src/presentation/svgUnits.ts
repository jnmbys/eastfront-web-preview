import type { UnitPresentationState } from './coordinator.js';

interface Binding {counter:Element;hit:Element|undefined;transform:string;hitTransform:string|null;opacity:string|null;anchorX:number;anchorY:number;}

/** Binds once per DOM remount; RAF only touches active counter/hit attributes.
 * Camera, terrain canvas, NATO artwork, scale and canonical data-hex are untouched.
 */
export class SvgUnitPresentation {
  private bindings=new Map<string,Binding>();
  private touched=new Set<string>();
  bind(root:ParentNode|null):void {
    this.clear();this.bindings.clear();if(!root)return;
    const hits=new Map(Array.from(root.querySelectorAll('[data-hit-unit-id]')).map(el=>[el.getAttribute('data-hit-unit-id'),el]));
    for(const counter of Array.from(root.querySelectorAll('[data-unit-id]'))){
      const id=counter.getAttribute('data-unit-id');if(!id)continue;
      const hit=hits.get(id);
      this.bindings.set(id,{counter,hit,transform:counter.getAttribute('transform')??'',hitTransform:hit?.getAttribute('transform')??null,
        opacity:counter.getAttribute('opacity'),anchorX:Number(counter.getAttribute('data-anchor-x')),anchorY:Number(counter.getAttribute('data-anchor-y'))});
    }
  }
  paint(states:ReadonlyMap<string,UnitPresentationState>):void {
    for(const id of this.touched)if(!states.has(id))this.restore(id);
    this.touched=new Set();
    for(const [id,state]of states){
      const binding=this.bindings.get(id);if(!binding)continue;
      binding.counter.setAttribute('transform',`translate(${state.currentVisualPosition.x} ${state.currentVisualPosition.y})`);
      binding.counter.setAttribute('opacity',String(state.visible?state.opacity:0));
      binding.counter.setAttribute('data-animation-phase',state.phase);
      binding.hit?.setAttribute('transform',`translate(${state.currentCanonicalPosition.x-binding.anchorX} ${state.currentCanonicalPosition.y-binding.anchorY})`);
      this.touched.add(id);
    }
  }
  clear():void {for(const id of this.touched)this.restore(id);this.touched.clear();}
  dispose():void {this.clear();this.bindings.clear();}
  private restore(id:string):void {
    const binding=this.bindings.get(id);if(!binding)return;
    binding.counter.setAttribute('transform',binding.transform);
    binding.counter.removeAttribute('data-animation-phase');
    if(binding.opacity===null)binding.counter.removeAttribute('opacity');else binding.counter.setAttribute('opacity',binding.opacity);
    if(binding.hit){if(binding.hitTransform===null)binding.hit.removeAttribute('transform');else binding.hit.setAttribute('transform',binding.hitTransform);}
  }
}
