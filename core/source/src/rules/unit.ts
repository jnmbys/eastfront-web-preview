import type { GameRules } from '../core/config.js';
import type { Unit, UnitState, UnitStats } from '../core/types.js';

export function getUnitStats(unit: UnitState, rules: GameRules): UnitStats {
  const template = rules.unitTemplates[unit.templateId];
  if (!template) throw new Error(`Unknown unit template: ${unit.templateId}`);
  return template.steps[unit.step];
}

export function materializeUnit(unit: UnitState, rules: GameRules): Unit {
  return { ...unit, ...getUnitStats(unit, rules) };
}
