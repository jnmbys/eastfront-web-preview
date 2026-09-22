import {perf4} from '../perf004Trace.js';
import { getLocale, t } from '../localization/index.js';
/** Patch the small deployment shell without ever detaching the retained location
 * subtree. Replacing its ancestors invalidates layout for hundreds of cards even
 * when their element identities survive. This reconciler is scoped to this panel. */
function patchShell(parent, next, locations) {
    const key = (el, index) => el.getAttribute('data-retained-deployment-locations') !== null ? 'class:deployment-locations' :
        el.getAttribute('id') ? `id:${el.getAttribute('id')}` : el.getAttribute('data-deploy-unit-id') ? `unit:${el.getAttribute('data-deploy-unit-id')}` :
            el.getAttribute('class') ? `class:${el.getAttribute('class')}` : `${el.tagName}:${index}`;
    const old = new Map(Array.from(parent.children).map((el, index) => [key(el, index), el]));
    const desired = Array.from(next.children), keys = new Set(desired.map(key));
    for (const [id, node] of old)
        if (!keys.has(id))
            node.remove();
    const kept = new Set();
    let cursor = parent.firstElementChild;
    for (const [index, wanted] of desired.entries()) {
        const id = key(wanted, index), current = old.get(id);
        let node;
        if (wanted.getAttribute('data-retained-deployment-locations') !== null)
            node = locations;
        else if (current && (current.contains(locations) || current.getAttribute('class') === 'roster-list')) {
            patchShell(current, wanted, locations);
            node = current;
        }
        else if (current && current.innerHTML === wanted.innerHTML && current.textContent === wanted.textContent &&
            JSON.stringify(Array.from(current.attributes).map(a => [a.name, a.value])) === JSON.stringify(Array.from(wanted.attributes).map(a => [a.name, a.value])))
            node = current;
        else
            node = wanted;
        if (node === cursor)
            cursor = cursor.nextElementSibling;
        else if (current === cursor) {
            cursor = current.nextElementSibling;
            current.replaceWith(node);
        }
        else
            parent.insertBefore(node, cursor);
        kept.add(node);
        old.delete(id);
    }
    for (const node of Array.from(parent.children))
        if (!kept.has(node))
            node.remove();
}
/** One mounted panel's public location cards. No rules, private state or cross-
 * session cache. Retain unchanged terrain cards while the small panel shell is
 * refreshed normally. All occupancy comes from the current authorized counters. */
export class DeploymentPanelRenderer {
    owner = null;
    panel = null;
    key = '';
    locations = null;
    cards = new Map();
    counts = new Map();
    chosen = null;
    clear() { this.owner = null; this.panel = null; this.key = ''; this.locations = null; this.cards.clear(); this.counts.clear(); this.chosen = null; }
    update(panel, owner, model, selected, ui, markup) {const __p4end=perf4.begin("ui/deploymentPanelRenderer.js:DeploymentPanelRenderer.update");try{
        const d = model.deployment, row = d?.roster.find(r => r.id === selected);
        if (!d || !row || row.placed || model.viewerSide !== model.activeSide) {
            this.clear();
            panel.innerHTML = markup();
            return false;
        }
        const terrain = new Map(model.hexes.map(h => [`${h.coord.q},${h.coord.r}`, h.terrain]));
        // Revisions alone would invalidate every accepted deployment. Compare every
        // static card dependency instead; live occupancy/selection are patched below.
        const key = JSON.stringify([getLocale(), model.playerView.viewer, model.viewerControllerId, model.phase, model.activeSide, row.type, d.zoneKeys.map(k => [k, terrain.get(k)])]);
        const reuse = this.owner === owner && this.panel === panel && this.key === key && this.locations !== null && panel.contains(this.locations);
        const counts = new Map();
        for (const c of model.counters) {
            const k = `${c.hex.q},${c.hex.r}`;
            counts.set(k, (counts.get(k) ?? 0) + 1);
        }
        const chosen = ui.unitId === selected ? ui.key : null;
        if (reuse) {
            const locations = this.locations;
            const next = panel.ownerDocument.createElement('div');
            next.innerHTML = markup('<section data-retained-deployment-locations="true"></section>');
            patchShell(panel, next, locations);
            for (const k of new Set([...this.counts.keys(), ...counts.keys()])) {
                const count = counts.get(k) ?? 0;
                if (count === (this.counts.get(k) ?? 0))
                    continue;
                const card = this.cards.get(k);
                if (card)
                    card.children[3].textContent = t('deployment.occupancy', { occupancy: count ? t('deployment.visibleUnits', { count }) : t('deployment.noVisibleUnits') });
            }
            if (this.chosen !== chosen)
                for (const k of [this.chosen, chosen]) {
                    const card = k ? this.cards.get(k) : null;
                    if (card) {
                        card.classList.toggle('selected', k === chosen);
                        card.setAttribute('aria-pressed', String(k === chosen));
                    }
                }
        }
        else {
            this.clear();
            panel.innerHTML = markup();
            this.locations = panel.querySelector('.deployment-locations');
            this.cards = new Map(Array.from(panel.querySelectorAll('[data-deploy-destination]')).map(card => [card.dataset.deployDestination, card]));
        }
        this.owner = owner;
        this.panel = panel;
        this.key = key;
        this.counts = counts;
        this.chosen = chosen;
        return reuse;
    }finally{__p4end();}}
}
