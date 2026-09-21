import type {ModelDisplay} from './modelDisplay.js';
import { HEX_SIZE } from '../geometry/hex.js';
import { selectTerrainLod, type TerrainLod } from '../render/terrainAssets.js';
import type { UnitPresentationState, AnimationLifecycle } from './coordinator.js';
import type { PresentationEvent } from './events.js';
import { CUE_PROFILES, EFFECT_LOD } from './motion.js';
import { UnitPresenceLayer } from './unitPresence.js';
import { selectPresenceLod, type UnitPresenceIdentity } from './unitPresenceTypes.js';

interface Binding {
  counter:Element;compact:Element|null;hit:Element|undefined;transform:string;hitTransform:string|null;opacity:string|null;
  anchorX:number;anchorY:number;effect?:Element;
}
const NS='http://www.w3.org/2000/svg';
const corners='M-28 -18V-28H-18 M18 -28H28V-18 M28 18V28H18 M-18 28H-28V18';

/** Clones carry artwork only. Neither the ghost nor any descendant is a hit target. */
function inertClone(source:Element):Element {
  const clone=source.cloneNode(true) as Element;
  for(const node of [clone,...Array.from(clone.querySelectorAll('*'))]){
    for(const {name} of Array.from(node.attributes)){
      if(name==='id'||name==='role'||name==='tabindex'||name.startsWith('aria-')||(name.startsWith('data-')&&name!=='data-damage')||name.startsWith('on'))node.removeAttribute(name);
    }
    node.setAttribute('pointer-events','none');
  }
  clone.setAttribute('aria-hidden','true');return clone;
}

/** One bind per DOM remount; frames touch only active counter/effect attributes.
 * Ghost capture occurs after accepted Core results, before the canonical DOM remount.
 * No Core queries, map markup rebuilds, layout measurements or terrain work in paint. */
export class SvgUnitPresentation {
  private bindings=new Map<string,Binding>();
  private ghosts=new Map<string,Binding>();
  private touched=new Set<string>();
  private root:ParentNode|null=null;
  private layer:Element|null=null;
  private fallbackLod:TerrainLod='medium';
  private fittedHexWidth=0;
  private readonly presence=new UnitPresenceLayer();
  private zoomObserver:MutationObserver|null=null;
  private resizeObserver:ResizeObserver|null=null;
  private lastStates:ReadonlyMap<string,UnitPresentationState>=new Map();
  private presenceLod:TerrainLod|null=null;
  private requestedModels:ModelDisplay='auto';
  private displayedMode='';
  get modelDisplay():ModelDisplay{return this.requestedModels;}
  setModelDisplay(mode:ModelDisplay):void{this.requestedModels=mode;this.paint(this.lastStates);}

  prepare(events:readonly PresentationEvent[]):void {
    for(const event of events){
      if(event.kind!=='destroyed'||this.ghosts.has(event.unitId))continue;
      const binding=this.bindings.get(event.unitId);if(!binding)continue;
      this.presence.capture(event.unitId);
      binding.effect?.remove();delete binding.effect;
      const clone=inertClone(binding.counter);clone.setAttribute('data-presentation-ghost',event.unitId);
      this.ghosts.set(event.unitId,{...binding,counter:clone,compact:clone.querySelector('.compact-unit'),hit:undefined});
      // Core already removed this unit. Its old DOM must stop receiving input immediately.
      binding.counter.remove();binding.hit?.remove();this.bindings.delete(event.unitId);this.touched.delete(event.unitId);
      this.layer?.appendChild(clone);
    }
  }
  lifecycle(event:PresentationEvent,lifecycle:AnimationLifecycle):void {
    if(event.kind==='destroyed'&&lifecycle!=='started'){
      this.ghosts.get(event.unitId)?.counter.remove();this.ghosts.delete(event.unitId);
      this.presence.removeGhost(event.unitId);
    }
  }
  bind(root:ParentNode|null,identities:readonly UnitPresenceIdentity[]=[]):void {
    const sameRoot=root===this.root&&root!==null;
    if(sameRoot){
      const counters=Array.from(root.querySelectorAll('[data-unit-id]'));
      if(counters.length===this.bindings.size&&counters.every(el=>this.bindings.get(el.getAttribute('data-unit-id')??'')?.counter===el)){
        this.fallbackLod=(root.querySelector('#eastfront-map')?.getAttribute('data-lod') as TerrainLod)??'medium';
        if(!this.fittedHexWidth){const svg=root.querySelector<SVGSVGElement>('#eastfront-map'),width=Number(svg?.getAttribute('viewBox')?.split(/\s+/)[2]);this.fittedHexWidth=width&&svg?.clientWidth?svg.clientWidth*Math.sqrt(3)*HEX_SIZE/width:0;}
        this.presence.syncSelection(new Map([...this.bindings].map(([id,b])=>[id,b.counter])));return;
      }
    }
    this.zoomObserver?.disconnect();this.resizeObserver?.disconnect();
    this.clear();this.bindings.clear();this.displayedMode='';this.root=root;this.layer=null;if(!root){this.presence.dispose();return;}
    const svg=root.querySelector<SVGSVGElement>('#eastfront-map');
    this.layer=root.querySelector('#counter-layer');
    this.fallbackLod=(svg?.getAttribute('data-lod') as TerrainLod)??'medium';
    const width=Number(svg?.getAttribute('viewBox')?.split(/\s+/)[2]);
    this.fittedHexWidth=width&&svg?.clientWidth?svg.clientWidth*Math.sqrt(3)*HEX_SIZE/width:0;
    const hits=new Map(Array.from(root.querySelectorAll('[data-hit-unit-id]')).map(el=>[el.getAttribute('data-hit-unit-id'),el]));
    for(const counter of Array.from(root.querySelectorAll('[data-unit-id]'))){
      const id=counter.getAttribute('data-unit-id');if(!id)continue;
      this.bindings.set(id,this.binding(counter,hits.get(id)));
    }
    for(const [id,ghost] of this.ghosts){
      const stale=this.bindings.get(id);stale?.counter.remove();stale?.hit?.remove();this.bindings.delete(id);
      this.layer?.appendChild(ghost.counter);
    }
    this.presence.bind(this.layer,identities,new Map([...this.bindings].map(([id,binding])=>[id,binding.counter])));
    // React to the existing Camera scalar; no camera writes and no idle RAF loop.
    if(typeof MutationObserver!=='undefined'){
      this.zoomObserver=new MutationObserver(()=>this.paint(this.lastStates));
      this.zoomObserver.observe(root as Node,{attributes:true,attributeFilter:['data-zoom']});
    }
    if(typeof ResizeObserver!=='undefined'&&svg){
      this.resizeObserver=new ResizeObserver(()=>{
        this.fittedHexWidth=width&&svg.clientWidth?svg.clientWidth*Math.sqrt(3)*HEX_SIZE/width:0;
        this.paint(this.lastStates);
      });this.resizeObserver.observe(svg);
    }
  }
  paint(states:ReadonlyMap<string,UnitPresentationState>):void {
    this.lastStates=states;
    for(const id of this.touched)if(!states.has(id))this.restore(id);
    this.touched.clear();
    // Camera already writes this scalar. Reading it cannot force layout or move the camera.
    const zoom=Number((this.root as Element|null)?.getAttribute?.('data-zoom'))||1;
    const lod=this.fittedHexWidth?selectTerrainLod(this.fittedHexWidth*zoom):this.fallbackLod;
    this.presenceLod=this.fittedHexWidth?selectPresenceLod(this.fittedHexWidth*zoom,this.presenceLod):this.fallbackLod;
    const models=this.requestedModels==='auto'&&this.presenceLod!=='far';
    this.presence.setLod(models?this.presenceLod:'far');
    const display=models?'model':'counter';
    if(display!==this.displayedMode){
      this.displayedMode=display;
      for(const binding of [...this.bindings.values(),...this.ghosts.values()]){
        binding.counter.setAttribute('data-unit-display',display);
        // Attribute visibility also supports software rendering and inert destroyed clones.
        binding.counter.querySelector('.counter-face')?.setAttribute('visibility',models?'hidden':'visible');
        binding.counter.querySelector('.counter-face')?.setAttribute('opacity',models?'0':'1');
        binding.counter.querySelector('.compact-plate')?.setAttribute('opacity',models?'1':'0');
        binding.counter.querySelector('.compact-unit')?.setAttribute('visibility',models?'visible':'hidden');
        binding.hit?.setAttribute('visibility',models?'hidden':'visible');
        binding.hit?.setAttribute('pointer-events',models?'none':'all');
        binding.counter.querySelector('.model-hit-proxy')?.setAttribute('pointer-events',models&&binding.counter.getAttribute('data-presentation-ghost')===null?'all':'none');
      }
    }
    const weight=EFFECT_LOD[lod];
    for(const [id,state]of states){
      const binding=this.ghosts.get(id)??this.bindings.get(id);if(!binding)continue;
      const {x,y}=state.currentVisualPosition,dx=state.motionOffset.x*weight,dy=state.motionOffset.y*weight;
      const scale=1+(state.scale-1)*weight;
      const accent=dx||dy||scale!==1?` translate(${dx} ${dy}) scale(${scale})`:'';
      const transform=`translate(${x} ${y})${accent}`;
      binding.counter.setAttribute('transform',transform);
      binding.counter.setAttribute('opacity',String(state.visible?state.opacity:0));
      binding.counter.setAttribute('data-animation-phase',state.phase);
      binding.hit?.setAttribute('transform',`translate(${state.currentCanonicalPosition.x-binding.anchorX} ${state.currentCanonicalPosition.y-binding.anchorY})`);
      this.effect(binding,state,weight,lod);
      const composition=this.presence.paint(id,state,transform,state.visible?state.opacity:0);
      if(composition&&(composition.x||composition.y))binding.compact?.setAttribute('transform',`translate(${composition.x} ${composition.y})`);
      else if(binding.compact?.getAttribute('transform')!=null)binding.compact.removeAttribute('transform');
      this.touched.add(id);
    }
  }
  clear():void {for(const id of this.touched)this.restore(id);this.touched.clear();}
  dispose():void {
    this.zoomObserver?.disconnect();this.resizeObserver?.disconnect();this.zoomObserver=null;this.resizeObserver=null;
    this.clear();for(const ghost of this.ghosts.values())ghost.counter.remove();
    this.ghosts.clear();this.bindings.clear();this.layer=null;this.root=null;
    this.presence.dispose();this.lastStates=new Map();
    this.presenceLod=null;this.displayedMode='';
  }
  private binding(counter:Element,hit:Element|undefined):Binding {
    return {counter,compact:counter.querySelector('.compact-unit'),hit,transform:counter.getAttribute('transform')??'',hitTransform:hit?.getAttribute('transform')??null,
      opacity:counter.getAttribute('opacity'),anchorX:Number(counter.getAttribute('data-anchor-x')),anchorY:Number(counter.getAttribute('data-anchor-y'))};
  }
  private effect(binding:Binding,state:UnitPresentationState,weight:number,lod:TerrainLod):void {
    if(state.effect<=0||state.phase==='idle'){
      if(binding.effect)binding.effect.setAttribute('opacity','0');return;
    }
    let effect=binding.effect;
    if(!effect){
      effect=binding.counter.ownerDocument.createElementNS(NS,'path');
      effect.setAttribute('data-presentation-effect','');effect.setAttribute('pointer-events','none');effect.setAttribute('aria-hidden','true');
      effect.setAttribute('fill','none');effect.setAttribute('stroke-linecap','round');effect.setAttribute('stroke-linejoin','round');
      binding.counter.appendChild(effect);binding.effect=effect;
    }
    const phase=state.phase,travel=['moving','retreating','advancing','breakthrough'].includes(phase);
    const angle=Math.atan2(state.direction.y,state.direction.x)*180/Math.PI;
    const reach=CUE_PROFILES[state.character].reach;
    let path=corners,rotation=0,color='#dbc68d',stroke=1.6;
    if(phase==='firing'){
      path=lod==='far'?'M25 -3L28 0L25 3':`M25 -4L${25+reach} 0L25 4 M27 -8L30 -10 M27 8L30 10`;
      rotation=angle;color='#fff0bd';stroke=2;
    }else if(phase==='hit'||phase==='destroyed'){color='#e3a08a';stroke=2;}
    else if(travel){
      path=phase==='retreating'?'M-27 -8L-30 0L-27 8':phase==='breakthrough'?'M25 -7L29 0L25 7 M30 -5L33 0L30 5':phase==='advancing'?'M25 -6L28 0L25 6':'M-17 28Q0 32 17 28';
      rotation=phase==='moving'?0:angle;stroke=phase==='moving'?3:1.5;if(phase==='moving')color='#07121d';
      if(phase==='moving')color='#07121d';
    }
    effect.setAttribute('d',path);effect.setAttribute('transform',`rotate(${rotation})`);
    effect.setAttribute('stroke',color);effect.setAttribute('stroke-width',String(stroke));
    effect.setAttribute('opacity',String(state.effect*weight));
  }
  private restore(id:string):void {
    this.presence.restore(id);
    const binding=this.ghosts.get(id)??this.bindings.get(id);if(!binding)return;
    binding.effect?.remove();delete binding.effect;if(binding.compact?.getAttribute('transform')!=null)binding.compact.removeAttribute('transform');
    binding.counter.setAttribute('transform',binding.transform);binding.counter.removeAttribute('data-animation-phase');
    if(binding.opacity===null)binding.counter.removeAttribute('opacity');else binding.counter.setAttribute('opacity',binding.opacity);
    if(binding.hit){if(binding.hitTransform===null)binding.hit.removeAttribute('transform');else binding.hit.setAttribute('transform',binding.hitTransform);}
  }
}
