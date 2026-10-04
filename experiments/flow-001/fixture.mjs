// Deterministic legal setup shared by the runnable comparison entry and evidence harness.
// Every placement and phase transition is accepted by the original Core.
import { createLocalGameSession, dispatchGameAction, controllerIdForSide } from '../../app/core-adapter/session.js';
import { deploymentHexKeysForSide } from '../../app/core-adapter/core.js';
export function legalStart(rawMap, seed = 17001) {
    const s = createLocalGameSession(rawMap, seed);
    for (const side of ['SOVIET', 'GERMAN']) {
        s.activeViewerControllerId = controllerIdForSide(s, side);
        const hexes = deploymentHexKeysForSide(s.state, s.scenario, side).map(k => s.state.hexes[k].coord)
            .sort((a,b) => (side === 'SOVIET' ? b.q-a.q : a.q-b.q) || a.r-b.r);
        for (const unit of s.scenario.deployment.units.filter(u => u.side === side)) {
            const hex = hexes.find(h => Object.values(s.state.units).filter(u => u.alive && u.hex.q === h.q && u.hex.r === h.r).length < s.rules.stackingLimit);
            const r = dispatchGameAction(s, { type: 'DEPLOY_INITIAL_UNIT', controllerId:s.activeViewerControllerId, deploymentUnitId:unit.id, hex });
            if (!r.result.accepted) throw new Error(JSON.stringify(r.result.issues));
        }
        const r = dispatchGameAction(s, { type:'READY_FOR_PHASE_END', controllerId:s.activeViewerControllerId });
        if (!r.result.accepted) throw new Error(JSON.stringify(r.result.issues));
    }
    s.activeViewerControllerId = controllerIdForSide(s, 'GERMAN');
    return s;
}
