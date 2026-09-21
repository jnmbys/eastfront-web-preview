import type { TerrainLod } from '../render/terrainAssets.js';
import type { UnitPresentationState } from './coordinator.js';
import { PRESENCE_FAMILY, PRESENCE_LOD, PRESENCE_PALETTE, type UnitPresenceIdentity } from './unitPresenceTypes.js';
import { createPresenceDefinitions, presenceNode as node } from './unitPresenceSvg.js';

interface PresenceBinding {
  root:Element; pedestal:Element; body:Element; detail:Element; flash:Element; emphasis:Element;
  transform:string; scale:number; x:number; y:number; facing:number; family:string;
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
    this.unmount();if(!counterLayer?.parentNode)return;
    const doc=counterLayer.ownerDocument;
    this.definitions=createPresenceDefinitions(doc);
    this.layer=node(doc,'g',{'data-unit-presence-layer':'','aria-hidden':'true',focusable:'false','pointer-events':'none'});
    counterLayer.parentNode.insertBefore(this.definitions,counterLayer);
    counterLayer.parentNode.insertBefore(this.layer,counterLayer);
    for(const identity of identities){
      const counter=counters.get(identity.id);if(!counter||this.ghosts.has(identity.id))continue;
      this.units.set(identity.id,this.create(identity,counter));
    }
    for(const ghost of this.ghosts.values())this.layer.appendChild(ghost.root);
    this.setLod(this.lod,true);
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
    this.layer?.setAttribute('data-presence-lod',lod);
    for(const binding of [...this.units.values(),...this.ghosts.values()]){
      binding.pedestal.setAttribute('transform',`translate(${binding.x} ${binding.y}) scale(${PRESENCE_LOD[lod].scale*binding.scale})`);
      binding.detail.setAttribute('visibility',lod==='close'?'visible':'hidden');
      binding.root.setAttribute('opacity',String(PRESENCE_LOD[lod].opacity));
    }
  }
  paint(id:string,state:UnitPresentationState,transform:string,opacity:number):void {
    const binding=this.ghosts.get(id)??this.units.get(id);if(!binding)return;
    // Identical parent transform guarantees travel, recoil and settle remain synchronized.
    binding.root.setAttribute('transform',transform);
    binding.root.setAttribute('opacity',String(opacity*PRESENCE_LOD[this.lod].opacity));
    binding.root.setAttribute('data-presence-phase',state.phase);
    const directional=state.phase==='firing'||['moving','retreating','advancing','breakthrough'].includes(state.phase);
    const angle=directional?Math.atan2(state.direction.y,state.direction.x)*180/Math.PI:binding.facing;
    // Silhouette stays isometric; the small cue orients toward the accepted target.
    const facing=directional&&Math.abs(state.direction.x)>.15?(state.direction.x<0?-1:1):binding.facing;
    const collapse=state.phase==='destroyed'?` translate(0 ${state.progress*2}) rotate(${state.progress*9})`:'';
    binding.body.setAttribute('transform',`scale(${facing} 1)${collapse}`);
    const fire=state.phase==='firing'?state.effect:0;
    binding.flash.setAttribute('transform',`rotate(${angle})`);
    binding.flash.setAttribute('opacity',String(fire*(this.lod==='far'?0:1)));
    binding.emphasis.setAttribute('opacity',String(['windup','hit','destroyed'].includes(state.phase)?state.effect*.55:0));
    binding.emphasis.setAttribute('stroke',state.phase==='hit'||state.phase==='destroyed'?'#efb39d':'#e0c98d');
  }
  restore(id:string):void {
    const binding=this.ghosts.get(id)??this.units.get(id);if(!binding)return;
    binding.root.setAttribute('transform',binding.transform);binding.root.removeAttribute('data-presence-phase');
    binding.root.setAttribute('opacity',String(PRESENCE_LOD[this.lod].opacity));
    binding.body.setAttribute('transform',`scale(${binding.facing} 1)`);
    binding.flash.setAttribute('opacity','0');binding.flash.setAttribute('transform','rotate(0)');
    binding.emphasis.setAttribute('opacity','0');binding.emphasis.setAttribute('stroke','#e0c98d');
  }
  dispose():void {this.unmount();for(const id of this.ghosts.keys())this.removeGhost(id);}
  private unmount():void {
    for(const ghost of this.ghosts.values())ghost.root.remove();
    this.layer?.remove();this.definitions?.remove();this.layer=null;this.definitions=null;this.units.clear();
  }
  private create(identity:UnitPresenceIdentity,counter:Element):PresenceBinding {
    const doc=counter.ownerDocument,family=PRESENCE_FAMILY[identity.type],palette=PRESENCE_PALETTE[identity.side];
    const transform=counter.getAttribute('transform')??'',position=transform.match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/);
    const offsetX=Number(position?.[1])-Number(counter.getAttribute('data-anchor-x'));
    const half=Number(counter.querySelector('.counter-body')?.getAttribute('width')??48)/2;
    const stacked=Math.abs(offsetX)>.1, x=stacked?Math.sign(offsetX)*12:0,y=-half-(stacked?20:10);
    const scale=(stacked?.86:1)*(identity.type==='HEAVY_TANK'?1.08:1);
    const facing=identity.side==='GERMAN'?1:-1;
    const root=node(doc,'g',{'data-presence-id':identity.id,'data-presence-family':family,'data-presence-faction':identity.side,
      transform,opacity:1,color:palette.body,'aria-hidden':'true',focusable:'false'},this.layer!);
    const pedestal=node(doc,'g',{},root);
    node(doc,'ellipse',{cx:0,cy:6,rx:family==='infantry'?21:24,ry:5,fill:'#0d1720','fill-opacity':.38},pedestal);
    const classes=counter.getAttribute('class')??'';
    if(/selected|combat-attacker-(primary|selected)/.test(classes))node(doc,'ellipse',{cx:0,cy:6,rx:24,ry:6,fill:'none',stroke:palette.accent,'stroke-opacity':.45,'stroke-width':1},pedestal);
    const emphasis=node(doc,'ellipse',{cx:0,cy:4,rx:25,ry:8,fill:'none',stroke:'#e0c98d','stroke-width':1.3,opacity:0},pedestal);
    const body=node(doc,'g',{transform:`scale(${facing} 1)`},pedestal);
    node(doc,'use',{href:`#presence-${family}`},body);
    const detail=node(doc,'g',{},body);
    node(doc,'use',{href:`#presence-${family}-detail`},detail);
    if(identity.type==='JAGER'||identity.type==='ELITE_INFANTRY')node(doc,'path',{d:'M-8 8l8 2 8-2',fill:'none',stroke:palette.accent,'stroke-width':1.3},detail);
    const flash=node(doc,'g',{'data-presence-fire':'',opacity:0,transform:'rotate(0)'},pedestal);
    // Compact vector cue. Direction comes solely from the existing accepted participant.
    const burst=family==='armor'||family==='artillery'||family==='anti-tank';
    node(doc,'path',{d:burst?'M23 0l5-2-1-3 5 4 5 1-6 2 1 4-5-4Z':'M18-5l5 1-2 2 5 2-7-1 M20 4l5 1',fill:burst?'#fff0bc':'none',stroke:'#fff0bc','stroke-width':1.1},flash);
    return {root,pedestal,body,detail,flash,emphasis,transform,scale,x,y,facing,family};
  }
}
