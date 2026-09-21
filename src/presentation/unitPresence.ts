import type { TerrainLod } from '../render/terrainAssets.js';
import type { UnitPresentationState } from './coordinator.js';
import { PRESENCE_FAMILY, PRESENCE_LOD, PRESENCE_PALETTE, PRESENCE_PROFILE, presenceComposition, type PresenceFamily, type UnitPresenceIdentity } from './unitPresenceTypes.js';
import { createPresenceDefinitions, presenceNode as node } from './unitPresenceSvg.js';

interface PresenceBinding {
  root:Element; selection:Element;selected:boolean; pedestal:Element; body:Element; detail:Element; flash:Element; emphasis:Element;
  transform:string; half:number; stackSign:number; heavy:boolean; facing:number; family:PresenceFamily;
  from:ReturnType<typeof presenceComposition>|null;
}

/** Pure SVG companion layer. All anchor/motion values are supplied by Counter/UA-002.
 * No gameplay state, geometry, RNG, scheduler, camera write, or terrain dependency. */
export class UnitPresenceLayer {
  private layer:Element|null=null;
  private definitions:Element|null=null;
  private units=new Map<string,PresenceBinding>();
  private ghosts=new Map<string,PresenceBinding>();
  private lod:TerrainLod='far';

  bind(counterLayer:Element|null,identities:readonly UnitPresenceIdentity[],counters:ReadonlyMap<string,Element>):void {
    const previous=new Map(this.units);
    this.unmount();if(!counterLayer?.parentNode)return;
    const doc=counterLayer.ownerDocument;
    this.definitions=createPresenceDefinitions(doc);
    this.layer=node(doc,'g',{'data-unit-presence-layer':'','aria-hidden':'true',focusable:'false','pointer-events':'none'});
    counterLayer.parentNode.insertBefore(this.definitions,counterLayer);
    counterLayer.parentNode.insertBefore(this.layer,counterLayer);
    for(const identity of identities){
      const counter=counters.get(identity.id);if(!counter||this.ghosts.has(identity.id))continue;
      const binding=this.create(identity,counter),old=previous.get(identity.id);
      if(old)binding.from=old.transform===binding.transform?old.from:this.composition(old);
      this.units.set(identity.id,binding);
    }
    for(const ghost of this.ghosts.values())this.layer.appendChild(ghost.root);
    this.setLod(this.lod,true);
  }
  syncSelection(counters:ReadonlyMap<string,Element>):void {
    for(const [id,binding]of this.units){
      const selected=/selected|combat-attacker-(primary|selected)/.test(counters.get(id)?.getAttribute('class')??'');
      if(selected!==binding.selected){binding.selected=selected;binding.selection.setAttribute('opacity',selected?'1':'0');}
    }
  }
  capture(id:string):void {
    const entry=this.units.get(id);if(!entry)return;
    entry.root.removeAttribute('data-presence-id');entry.root.setAttribute('data-presence-ghost',id);
    this.units.delete(id);this.ghosts.set(id,entry);
  }
  removeGhost(id:string):void {this.ghosts.get(id)?.root.remove();this.ghosts.delete(id);}
  setLod(lod:TerrainLod,force=false):void {
    if(lod===this.lod&&!force)return;this.lod=lod;
    this.layer?.setAttribute('visibility',lod==='far'?'hidden':'visible');
    this.layer?.setAttribute('opacity',lod==='far'?'0':'1');
    this.layer?.setAttribute('data-presence-lod',lod);
    for(const binding of [...this.units.values(),...this.ghosts.values()]){
      const {x,y,scale}=this.composition(binding);
      binding.pedestal.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);
      binding.detail.setAttribute('visibility',lod==='close'?'visible':'hidden');
      binding.root.setAttribute('opacity',String(PRESENCE_LOD[lod].opacity));
    }
  }
  paint(id:string,state:UnitPresentationState,transform:string,opacity:number):{x:number;y:number}|undefined {
    const binding=this.ghosts.get(id)??this.units.get(id);if(!binding)return;
    if(this.lod==='far')return;
    // Identical parent transform guarantees travel, recoil and settle remain synchronized.
    binding.root.setAttribute('transform',transform);
    binding.root.setAttribute('opacity',String(opacity*PRESENCE_LOD[this.lod].opacity));
    binding.root.setAttribute('data-presence-phase',state.phase);
    // Reuse the coordinator's travel progress when entering/leaving a stack. A larger
    // display offset must not teleport between the solo and formation ground strips.
    const ground=this.composition(binding),from=binding.from??ground;
    const travel=['moving','retreating','advancing','breakthrough'].includes(state.phase);
    const p=travel?state.progress*state.progress*(3-2*state.progress):1;
    const x=from.x+(ground.x-from.x)*p,y=from.y+(ground.y-from.y)*p,scale=from.scale+(ground.scale-from.scale)*p;
    binding.pedestal.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);
    const directional=state.phase==='firing'||['moving','retreating','advancing','breakthrough'].includes(state.phase);
    const angle=directional?Math.atan2(state.direction.y,state.direction.x)*180/Math.PI:binding.facing;
    // Silhouette stays isometric; the small cue orients toward the accepted target.
    const facing=directional&&Math.abs(state.direction.x)>.15?(state.direction.x<0?-1:1):binding.facing;
    const collapse=state.phase==='destroyed'?` translate(0 ${state.progress*2}) rotate(${state.progress*9})`:'';
    binding.body.setAttribute('transform',`scale(${facing} 1)${collapse}`);
    const fire=state.phase==='firing'?state.effect:0;
    binding.flash.setAttribute('transform',`rotate(${angle})`);
    binding.flash.setAttribute('opacity',String(fire));
    binding.emphasis.setAttribute('opacity',String(['windup','hit','destroyed'].includes(state.phase)?state.effect*.55:0));
    binding.emphasis.setAttribute('stroke',state.phase==='hit'||state.phase==='destroyed'?'#efb39d':'#e0c98d');
    // Plate/proxy follow this same stack-entry interpolation, without another clock.
    return {x:x-ground.x,y:y-ground.y+PRESENCE_PROFILE[binding.family].foot*(scale-ground.scale)};
  }
  restore(id:string):void {
    const binding=this.ghosts.get(id)??this.units.get(id);if(!binding)return;
    binding.root.setAttribute('transform',binding.transform);binding.root.removeAttribute('data-presence-phase');
    binding.root.setAttribute('opacity',String(PRESENCE_LOD[this.lod].opacity));
    binding.body.setAttribute('transform',`scale(${binding.facing} 1)`);
    const {x,y,scale}=this.composition(binding);
    binding.pedestal.setAttribute('transform',`translate(${x} ${y}) scale(${scale})`);
    binding.flash.setAttribute('opacity','0');binding.flash.setAttribute('transform','rotate(0)');
    binding.emphasis.setAttribute('opacity','0');binding.emphasis.setAttribute('stroke','#e0c98d');
  }
  dispose():void {this.unmount();for(const id of this.ghosts.keys())this.removeGhost(id);}
  private unmount():void {
    for(const ghost of this.ghosts.values())ghost.root.remove();
    this.layer?.remove();this.definitions?.remove();this.layer=null;this.definitions=null;this.units.clear();
  }
  private composition(binding:PresenceBinding){return presenceComposition(binding.family,binding.half,binding.stackSign,binding.heavy,this.lod);}
  private create(identity:UnitPresenceIdentity,counter:Element):PresenceBinding {
    const doc=counter.ownerDocument,family=PRESENCE_FAMILY[identity.type],palette=PRESENCE_PALETTE[identity.side];
    const transform=counter.getAttribute('transform')??'',position=transform.match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
    const offsetX=Number(position?.[1])-Number(counter.getAttribute('data-anchor-x'));
    const half=Number(counter.querySelector('.counter-body')?.getAttribute('width')??48)/2;
    const stackSign=Math.abs(offsetX)>.1?Math.sign(offsetX):0,heavy=identity.type==='HEAVY_TANK';
    const profile=PRESENCE_PROFILE[family];
    const facing=identity.side==='GERMAN'?1:-1;
    const root=node(doc,'g',{'data-presence-id':identity.id,'data-presence-family':family,'data-presence-faction':identity.side,
      transform,opacity:1,color:palette.body,'aria-hidden':'true',focusable:'false'},this.layer!);
    const pedestal=node(doc,'g',{'data-presence-ground':''},root);
    // Nested under the same anchor/motion transform as the model: no floating CSS shadow.
    // Two small translucent ellipses give broad ambient grounding and a tight contact core.
    const ground=node(doc,'g',{'data-presence-contact':''},pedestal);
    node(doc,'ellipse',{cx:-1,cy:profile.foot,rx:profile.shadow+3,ry:4.5,fill:'#16211e','fill-opacity':.22},ground);
    node(doc,'ellipse',{cx:0,cy:profile.foot-1,rx:profile.shadow,ry:2.8,fill:'#101b1b','fill-opacity':.52},ground);
    const classes=counter.getAttribute('class')??'';
    const selected=/selected|combat-attacker-(primary|selected)/.test(classes);
    const selection=node(doc,'ellipse',{opacity:selected?1:0,cx:0,cy:profile.foot,rx:profile.shadow+2,ry:5,fill:'none',stroke:palette.accent,'stroke-opacity':.45,'stroke-width':1},pedestal);
    const emphasis=node(doc,'ellipse',{cx:0,cy:profile.foot,rx:profile.shadow+3,ry:6,fill:'none',stroke:'#e0c98d','stroke-width':1.3,opacity:0},pedestal);
    const body=node(doc,'g',{transform:`scale(${facing} 1)`},pedestal);
    node(doc,'use',{href:`#presence-${family}`},body);
    const detail=node(doc,'g',{},body);
    node(doc,'use',{href:`#presence-${family}-detail`},detail);
    if(identity.type==='JAGER'||identity.type==='ELITE_INFANTRY')node(doc,'path',{d:'M-8 8l8 2 8-2',fill:'none',stroke:palette.accent,'stroke-width':1.3},detail);
    const flash=node(doc,'g',{'data-presence-fire':'',opacity:0,transform:'rotate(0)'},pedestal);
    // Compact vector cue. Direction comes solely from the existing accepted participant.
    const burst=family==='armor'||family==='artillery'||family==='anti-tank';
    node(doc,'path',{d:burst?`M${profile.muzzle} 0l4-2-1-3 4 4 4 1-5 2 1 3-4-3Z`:`M${profile.muzzle-5}-5l5 1-2 2 5 2-7-1 m1 5l5 1`,fill:burst?'#fff0bc':'none',stroke:'#fff0bc','stroke-width':1.1},flash);
    return {root,selection,selected,pedestal,body,detail,flash,emphasis,transform,half,stackSign,heavy,facing,family,from:null};
  }
}
