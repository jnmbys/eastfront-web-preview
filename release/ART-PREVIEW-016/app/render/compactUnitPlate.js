import { t } from '../localization/index.js';
import { PRESENCE_FAMILY } from '../presentation/unitPresenceTypes.js';
/** Detached CounterModel already obeys PlayerView. No state queries or new identity. */
export function compactUnitPlate(c, index, count) {
    const stacked = count > 1, sign = stacked ? (index === 0 ? -1 : 1) : 0;
    const x = sign * 12.5, y = 20 + (sign < 0 ? 6 : sign > 0 ? -7 : 0), width = stacked ? 35 : 42;
    const country = c.side === 'GERMAN' ? 'DE' : 'SU', category = t(`models.${PRESENCE_FAMILY[c.type]}`);
    const step = c.step === 0 ? '' : c.step === 1 ? '/' : '//';
    // The proxy is a child of the existing data-unit-id button. Events bubble to its
    // established click/keyboard route; this rectangle has no independent identity/logic.
    return `<g class="compact-unit" visibility="hidden">
 <rect class="model-hit-proxy" x="${x - (stacked ? 18.5 : 34)}" y="${-37 + (sign < 0 ? 6 : sign > 0 ? -7 : 0)}" width="${stacked ? 37 : 68}" height="68" fill="#fff" fill-opacity=".001" stroke="none" pointer-events="none"/>
 <g class="compact-plate" transform="translate(${x} ${y})" pointer-events="none" aria-hidden="true">
 <rect class="compact-body" x="${-width / 2}" y="-10" width="${width}" height="20" rx="3"/>
 <text class="compact-category" y="-2" text-anchor="middle">${country} · ${category}</text>
 <text class="compact-stats" y="7" text-anchor="middle" font-size="${stacked ? 7.5 : 9}">${c.stats.attack}-${c.stats.defense}-${c.stats.movement}${step ? ' ' + step : ''}</text>
 ${stacked && index === count - 1 ? '<text class="compact-stack" x="-19" y="17" text-anchor="middle">×2</text>' : ''}
 ${step ? '<path class="compact-damage" d="M-19 -7v14" stroke-dasharray="2 2"/>' : ''}
 ${c.supplyState === 'OUT_OF_SUPPLY' ? '<g class="compact-oos" transform="translate(0 13)"><path d="M-3 -3l6 6m0-6l-6 6"/></g>' : ''}
 ${c.entrenched ? '<path class="compact-entrench" d="M-6 11v3h12v-3"/>' : ''}
 </g></g>`;
}
