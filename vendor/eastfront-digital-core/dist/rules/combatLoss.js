export function remainingDamageCapacity(state, rules, unitId) {
    const unit = state.units[unitId];
    if (!unit || !unit.alive)
        return 0;
    const template = rules.unitTemplates[unit.templateId];
    if (!template)
        return 0;
    return Math.max(0, template.maxDamageSteps - unit.step);
}
/**
 * Loss fairness is round based: while enough losses remain for every currently-capable
 * participant, each must take one before any can take another. Choice exists only in the
 * final partial round.
 */
export function analyzeLossRequirement(state, rules, requirement) {
    const eligibleUnitIds = [...new Set(requirement.eligibleUnitIds)]
        .filter(id => state.units[id]?.alive && state.units[id]?.side === requirement.side)
        .sort();
    const capacityByUnitId = {};
    for (const id of eligibleUnitIds)
        capacityByUnitId[id] = remainingDamageCapacity(state, rules, id);
    const totalCapacity = eligibleUnitIds.reduce((sum, id) => sum + (capacityByUnitId[id] ?? 0), 0);
    const effectiveSteps = Math.min(requirement.steps, totalCapacity);
    const caps = { ...capacityByUnitId };
    const sequence = [];
    let remaining = effectiveSteps;
    let unique = true;
    while (remaining > 0) {
        const active = eligibleUnitIds.filter(id => (caps[id] ?? 0) > 0);
        if (active.length === 0)
            break;
        if (remaining < active.length) {
            unique = false;
            break;
        }
        for (const id of active) {
            sequence.push(id);
            caps[id] = (caps[id] ?? 0) - 1;
        }
        remaining -= active.length;
    }
    return {
        requestedSteps: requirement.steps,
        effectiveSteps,
        totalCapacity,
        eligibleUnitIds,
        capacityByUnitId,
        unique,
        uniqueSequence: unique ? sequence : null
    };
}
export function validateLossAllocationSequence(state, rules, requirement, unitIdsByStep) {
    const analysis = analyzeLossRequirement(state, rules, requirement);
    const issues = [];
    if (unitIdsByStep.length !== analysis.effectiveSteps) {
        issues.push({ code: 'INVALID_LOSS_ALLOCATION', message: 'Loss allocation must contain exactly the number of actionable loss steps.', details: { requestedSteps: requirement.steps, effectiveSteps: analysis.effectiveSteps, providedSteps: unitIdsByStep.length, totalCapacity: analysis.totalCapacity } });
        return issues;
    }
    if (analysis.effectiveSteps === 0)
        return issues;
    const caps = { ...analysis.capacityByUnitId };
    let offset = 0;
    while (offset < unitIdsByStep.length) {
        const active = analysis.eligibleUnitIds.filter(id => (caps[id] ?? 0) > 0);
        if (active.length === 0) {
            issues.push({ code: 'INVALID_LOSS_ALLOCATION', message: 'Loss allocation exceeds remaining participant damage capacity.' });
            return issues;
        }
        const remaining = unitIdsByStep.length - offset;
        const roundCount = Math.min(remaining, active.length);
        const chosen = unitIdsByStep.slice(offset, offset + roundCount);
        const chosenSet = new Set(chosen);
        if (chosenSet.size !== chosen.length) {
            issues.push({ code: 'INVALID_LOSS_ALLOCATION', message: 'A unit may not take a second loss in the same fairness round before other capable participants take one.', details: { roundActiveUnitIds: active, chosenUnitIds: [...chosen] } });
            return issues;
        }
        for (const id of chosen) {
            if (!active.includes(id)) {
                issues.push({ code: 'INVALID_LOSS_ALLOCATION', message: 'Loss was assigned to an ineligible or exhausted combat participant.', unitId: id, details: { roundActiveUnitIds: active } });
                return issues;
            }
        }
        if (remaining >= active.length) {
            // A full fairness round is mandatory: every currently-capable unit exactly once.
            if (chosen.length !== active.length || active.some(id => !chosenSet.has(id))) {
                issues.push({ code: 'INVALID_LOSS_ALLOCATION', message: 'Losses must be distributed evenly before any participant takes another step.', details: { requiredThisRound: active, chosenUnitIds: [...chosen] } });
                return issues;
            }
        }
        for (const id of chosen)
            caps[id] = (caps[id] ?? 0) - 1;
        offset += roundCount;
    }
    return issues;
}
export function allocationsFromSequence(sequence) {
    const allocations = {};
    for (const id of sequence)
        allocations[id] = (allocations[id] ?? 0) + 1;
    return allocations;
}
export function applyLossSequence(state, rules, battleId, side, sequence, actionId, automatic) {
    const events = [];
    const allocations = allocationsFromSequence(sequence);
    for (const unitId of sequence) {
        const unit = state.units[unitId];
        if (!unit || !unit.alive)
            throw new Error(`Validated loss sequence references unavailable unit ${unitId}.`);
        const template = rules.unitTemplates[unit.templateId];
        if (!template)
            throw new Error(`Unknown unit template ${unit.templateId} during loss application.`);
        const fromStep = unit.step;
        if (fromStep + 1 >= template.maxDamageSteps) {
            unit.alive = false;
            unit.entrenched = false;
            events.push({ type: 'UnitStepLost', actionId, battleId, unitId, fromStep, toStep: null });
            events.push({ type: 'UnitDestroyed', actionId, battleId, unitId });
        }
        else {
            const nextStep = (fromStep + 1);
            unit.step = nextStep;
            events.push({ type: 'UnitStepLost', actionId, battleId, unitId, fromStep, toStep: nextStep });
        }
    }
    events.push({ type: 'LossesAllocated', actionId, battleId, side, allocations, automatic });
    return { allocations, events };
}
