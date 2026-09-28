export function getUnitStats(unit, rules) {
    const template = rules.unitTemplates[unit.templateId];
    if (!template)
        throw new Error(`Unknown unit template: ${unit.templateId}`);
    return template.steps[unit.step];
}
export function materializeUnit(unit, rules) {
    return { ...unit, ...getUnitStats(unit, rules) };
}
