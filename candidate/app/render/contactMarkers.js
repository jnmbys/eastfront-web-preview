import { hexToPixel } from '../geometry/hex.js';
import { t } from '../localization/index.js';
const esc = (s) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Intelligence is never a Counter, hit target, unit ID or Presence identity. */
export function contactMarkers(view) {
    return `<g id="intelligence-layer" pointer-events="none">${[...view.contacts, ...view.lastKnown].map(c => {
        const p = hexToPixel(c.hex), past = c.status === 'LAST_KNOWN';
        const label = past ? t('fow.lastKnownTurn', { turn: c.lastSeenTurn }) : t('fow.contact');
        const symbol = past
            ? '<path d="M-13 -18 H13 L21 -10 V10 L13 18 H-13 L-21 10 V-10Z" fill="#354450" fill-opacity=".4" stroke="#d0c9ac" stroke-width="1.7" stroke-dasharray="4 4"/><circle r="8" fill="none" stroke="#d0c9ac" stroke-width="1.6"/><path d="M0 -5 V0 L4 3" fill="none" stroke="#d0c9ac" stroke-width="1.6"/>'
            : '<path d="M0 -22 L22 -10 V9 L0 23 -22 9 V-10Z" fill="#1f303c" stroke="#c5ac79" stroke-width="1.8"/><path d="M-14 -9 L0 -16 14 -9 M-14 12 L0 18 14 12" fill="none" stroke="#bda576" stroke-width="1.3"/><circle cx="-10" cy="1" r="2.3" fill="#c5ac79"/><circle cx="10" cy="1" r="2.3" fill="#c5ac79"/><text x="0" y="7" text-anchor="middle" fill="#f1e6cb" font-family="sans-serif" font-size="20">?</text>';
        return `<g data-intelligence="${c.status}" transform="translate(${p.x} ${p.y})" role="img" aria-label="${esc(label)}" opacity="${past ? .66 : .97}"><title>${esc(label)}</title>${symbol}</g>`;
    }).join('')}</g>`;
}
