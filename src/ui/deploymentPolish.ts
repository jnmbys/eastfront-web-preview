import { msg, formatMessage, type Message, type MessageKey } from '../localization/index.js';
import {hexPolygon} from '../geometry/hex.js';
import type {BrowserRenderModel} from '../render/coreModel.js';
import type {DeploymentTouch} from './deploymentTouch.js';
export function deploymentRejectionMessage(issues:readonly {code:string}[]):Message {
 const keys:Record<string,MessageKey>={STACKING_LIMIT:'deployment.stackLimit',INVALID_DEPLOYMENT_HEX:'deployment.invalidHex',DEPLOYMENT_UNIT_UNAVAILABLE:'deployment.unavailable',WRONG_PHASE:'deployment.wrongPhase',WRONG_SIDE:'deployment.wrongSide',INVALID_CONTROLLER:'deployment.invalidController'};
 return issues.length?{parts:[...new Set(issues.map(i=>keys[i.code]??'deployment.rejected'))].map(key=>msg(key)),separator:' '}:msg('deployment.retry');
}
export function deploymentRejection(issues:readonly {code:string}[]):string {return formatMessage(deploymentRejectionMessage(issues));}
export function deploymentFocus(model:BrowserRenderModel,ui:DeploymentTouch,selected:string|null):string{
 if(!model.deployment||model.activeSide!==model.viewerSide||ui.unitId!==selected||!ui.key||!model.deployment.zoneKeys.includes(ui.key))return '';
 const h=model.hexes.find(h=>`${h.coord.q},${h.coord.r}`===ui.key);if(!h)return '';
 return `<g id="deployment-focus" aria-hidden="true" pointer-events="none"><polygon class="deployment-focus-halo" points="${hexPolygon(h.coord).map(p=>`${p.x},${p.y}`).join(' ')}"/><polygon class="deployment-focus-ring" points="${hexPolygon(h.coord).map(p=>`${p.x},${p.y}`).join(' ')}"/></g>`;
}
