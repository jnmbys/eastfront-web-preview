import type {PendingIntent} from './pendingAction.js';
import {mt} from './catalog.js';
import {hexToPixel,polygonPointsString} from '../geometry/hex.js';
import {publishActionTiming,transportTimingEnabled} from './diagnosticTiming.js';

/** Separate non-interactive overlay; never masquerades as a Counter or hit target. */
export class PendingFeedbackRenderer {
  private node:SVGGElement|null=null;private key='';private frameRequest:string|null=null;
  update(parent:Element|null,intent:PendingIntent|null):void {
    if(!parent||!intent){this.node?.remove();this.node=null;this.key='';this.frameRequest=null;return;}
    const key=JSON.stringify([intent.requestId,intent.kind,intent.path,intent.stage,mt('intentOnly')]);
    if(this.node?.parentElement!==parent){this.node?.remove();this.node=parent.ownerDocument.createElementNS('http://www.w3.org/2000/svg','g');
      this.node.setAttribute('id','pending-action-layer');this.node.setAttribute('pointer-events','none');this.node.setAttribute('aria-hidden','true');parent.appendChild(this.node);this.key='';}
    if(key===this.key)return;this.key=key;
    const target=intent.path.at(-1);if(!target)return;
    const points=[...(intent.origin?[intent.origin]:[]),...intent.path].map(h=>hexToPixel(h)),end=hexToPixel(target);
    this.node.innerHTML=`${intent.kind==='move'?`<polyline points="${points.map(p=>`${p.x},${p.y}`).join(' ')}" fill="none" stroke="#ffdb70" stroke-width="3" stroke-dasharray="7 5"/>`:''}<polygon points="${polygonPointsString(target)}" fill="#ffdb7020" stroke="#ffdb70" stroke-width="3" stroke-dasharray="7 5"/><text x="${end.x}" y="${end.y-14}" text-anchor="middle" fill="#ffecac" stroke="#18232d" stroke-width="3" paint-order="stroke" font-size="12">${mt('intentOnly')}</text>`;
    if(transportTimingEnabled&&intent.requestId&&this.frameRequest!==intent.requestId){
      const id=intent.requestId,node=this.node;this.frameRequest=id;
      // A frame opportunity proxy, not a claim that the compositor painted pixels.
      requestAnimationFrame(()=>{if(this.node===node&&node.isConnected&&this.frameRequest===id)publishActionTiming({stage:'feedback-frame',at:performance.now(),requestId:id});});
    }
  }
}
