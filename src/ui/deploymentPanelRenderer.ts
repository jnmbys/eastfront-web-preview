import type {BrowserRenderModel} from '../render/coreModel.js';
import type {DeploymentTouch} from './deploymentTouch.js';
import {getLocale,t} from '../localization/index.js';

/** One mounted panel's public location cards. No rules, private state or cross-
 * session cache. Retain unchanged terrain cards while the small panel shell is
 * refreshed normally. All occupancy comes from the current authorized counters. */
export class DeploymentPanelRenderer {
 private owner:object|null=null;private panel:HTMLElement|null=null;private key='';
 private locations:Element|null=null;private cards=new Map<string,HTMLElement>();
 private counts=new Map<string,number>();private chosen:string|null=null;
 clear():void {this.owner=null;this.panel=null;this.key='';this.locations=null;this.cards.clear();this.counts.clear();this.chosen=null;}
 update(panel:HTMLElement,owner:object,model:BrowserRenderModel,selected:string|null,ui:DeploymentTouch,markup:(locations?:string)=>string):void {
  const d=model.deployment,row=d?.roster.find(r=>r.id===selected);
  if(!d||!row||row.placed||model.viewerSide!==model.activeSide){this.clear();panel.innerHTML=markup();return;}
  const terrain=new Map(model.hexes.map(h=>[`${h.coord.q},${h.coord.r}`,h.terrain]));
  // Revisions alone would invalidate every accepted deployment. Compare every
  // static card dependency instead; live occupancy/selection are patched below.
  const key=JSON.stringify([getLocale(),model.playerView.viewer,model.viewerControllerId,model.phase,model.activeSide,row.type,d.zoneKeys.map(k=>[k,terrain.get(k)])]);
  const reuse=this.owner===owner&&this.panel===panel&&this.key===key&&this.locations!==null&&panel.contains(this.locations);
  const counts=new Map<string,number>();for(const c of model.counters){const k=`${c.hex.q},${c.hex.r}`;counts.set(k,(counts.get(k)??0)+1);}
  const chosen=ui.unitId===selected?ui.key:null;
  if(reuse){
   const locations=this.locations!;
   panel.innerHTML=markup('<section data-retained-deployment-locations="true"></section>');
   panel.querySelector('[data-retained-deployment-locations]')!.replaceWith(locations);
   for(const k of new Set([...this.counts.keys(),...counts.keys()])){
    const count=counts.get(k)??0;if(count===(this.counts.get(k)??0))continue;
    const card=this.cards.get(k);if(card)card.children[3]!.textContent=t('deployment.occupancy',{occupancy:count?t('deployment.visibleUnits',{count}):t('deployment.noVisibleUnits')});
   }
   if(this.chosen!==chosen)for(const k of [this.chosen,chosen]){const card=k?this.cards.get(k):null;if(card){card.classList.toggle('selected',k===chosen);card.setAttribute('aria-pressed',String(k===chosen));}}
  }else{
   this.clear();panel.innerHTML=markup();this.locations=panel.querySelector('.deployment-locations');
   this.cards=new Map(Array.from(panel.querySelectorAll<HTMLElement>('[data-deploy-destination]')).map(card=>[card.dataset.deployDestination!,card]));
  }
  this.owner=owner;this.panel=panel;this.key=key;this.counts=counts;this.chosen=chosen;
 }
}
