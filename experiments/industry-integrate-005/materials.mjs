// Pure lot arithmetic. This is NOT a receipt importer, grant verifier or runtime schema.
// Only synthetic unit tests currently have material lots; real CAMPAIGN-004 has none.
export function quoteMaterialLots(recipe, lots, {side, receiverId, sourceId, turn}) {
  const errors = [], debits = [];
  const integer = n => Number.isSafeInteger(n) && n >= 0;
  if (!['G', 'S'].includes(side) || !receiverId || !sourceId || !integer(turn) || turn === 0) return {errors: ['MATERIAL_CONTEXT_UNRESOLVED'], debits: null};
  if (!recipe) return {errors: ['PE_TEMPLATE_UNRESOLVED'], debits: null};
  if (!Array.isArray(lots)) return {errors: ['MATERIAL_LEDGER_UNAVAILABLE'], debits: null};
  if (new Set(lots.map(l => l.lotId)).size !== lots.length) errors.push('DUPLICATE_MATERIAL_LOT');
  for (const lot of lots) {
    if (!lot.lotId || !lot.receiptId || lot.provenanceApproved !== true) errors.push('MATERIAL_PROVENANCE_MISSING');
    if (lot.side !== side || lot.receiverId !== receiverId || lot.sourceId !== sourceId) errors.push('MATERIAL_CUSTODY_OR_SOURCE_MISMATCH');
    if (lot.status !== 'RECEIVED' || !integer(lot.receivedEpoch) || lot.availableFromTurn !== lot.receivedEpoch + 1) errors.push('MATERIAL_AVAILABILITY_INVALID');
    if (lot.availableFromTurn > turn) errors.push('MATERIAL_NOT_YET_AVAILABLE');
    if (!integer(lot.quantity) || !integer(lot.reserved) || lot.reserved > lot.quantity) errors.push('INVALID_OR_DOUBLE_RESERVED_MATERIAL');
  }
  if (errors.length) return {errors: [...new Set(errors)], debits: null};
  for (const [material, cost] of Object.entries(recipe)) {
    if (!integer(cost) || cost === 0) { errors.push('INVALID_RECIPE_COST'); continue; }
    let remaining = cost;
    for (const lot of [...lots].sort((a, b) => a.lotId < b.lotId ? -1 : a.lotId > b.lotId ? 1 : 0)) {
      if (lot.material !== material) continue;
      const quantity = Math.min(remaining, lot.quantity - lot.reserved);
      if (quantity) debits.push({lotId: lot.lotId, material, quantity});
      remaining -= quantity;
    }
    if (remaining) errors.push('INSUFFICIENT_MATERIAL:' + material);
  }
  return {errors, debits: errors.length ? null : debits};
}
