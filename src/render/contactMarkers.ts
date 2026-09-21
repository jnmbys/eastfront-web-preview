import { hexToPixel } from '../geometry/hex.js';
import { t } from '../localization/index.js';
import type { PlayerViewState } from '../player-view/playerView.js';
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
/** Intelligence is never a Counter, hit target, unit ID or Presence identity. */
export function contactMarkers(view:PlayerViewState):string {
  return `<g id="intelligence-layer" pointer-events="none">${[...view.contacts,...view.lastKnown].map(c=>{
    const p=hexToPixel(c.hex),past=c.status==='LAST_KNOWN';
    const label=past?t('fow.lastKnownTurn',{turn:c.lastSeenTurn}):t('fow.contact');
    return `<g data-intelligence="${c.status}" transform="translate(${p.x} ${p.y})" role="img" aria-label="${esc(label)}" opacity="${past?.55:.95}"><title>${esc(label)}</title><path d="M0 -18 L20 0 0 18 -20 0Z" fill="#26313c" stroke="#c2aa78" stroke-width="1.7" ${past?'stroke-dasharray="4 3"':''}/><text x="0" y="6" text-anchor="middle" fill="#eee4ce" font-size="18">${past?'·':'?'}</text></g>`;
  }).join('')}</g>`;
}
