/** Conservative visibility: never animate a path through an undisclosed hex. */
export function filterPresentationEvents(events, before, after) {
    if (before.viewer !== after.viewer)
        return [];
    if (after.viewer === 'OBSERVER')
        return structuredClone([...events]);
    const prior = new Map(before.units.map(u => [u.id, u])), next = new Map(after.units.map(u => [u.id, u]));
    const known = (id) => prior.has(id) || next.has(id);
    const hexes = new Set([...before.identifiedHexKeys, ...after.identifiedHexKeys]);
    const result = [];
    for (const event of events) {
        if ('path' in event) {
            const friendly = (next.get(event.unitId) ?? prior.get(event.unitId))?.side === after.viewer;
            if (friendly || (prior.has(event.unitId) && next.has(event.unitId) && event.path.every(h => hexes.has(`${h.q},${h.r}`))))
                result.push(event);
        }
        else if ('unitId' in event) {
            if (known(event.unitId))
                result.push(event);
        }
        else {
            const unitIds = event.unitIds.filter(known), attackers = event.attackers.filter(p => known(p.unitId)), supporters = event.supporters?.filter(p => known(p.unitId));
            if (unitIds.length)
                result.push({ ...event, unitIds, attackers, ...(supporters ? { supporters } : {}) });
        }
    }
    return structuredClone(result);
}
