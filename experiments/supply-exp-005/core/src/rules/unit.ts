import type { GameRules } from '../core/config.js';
import type { Unit, UnitState, UnitStats } from '../core/types.js';

export function getUnitStats(unit: UnitState, rules: GameRules): UnitStats {
  const template = rules.unitTemplates[unit.templateId];
  if (!template) throw new Error(`Unknown unit template: ${unit.templateId}`);
  const stats=template.steps[unit.step];
  if (!unit.expSupply) return stats;
  return {...stats,attack:Math.ceil(stats.attack*unit.expSupply.attackFactor),movement:unit.expSupply.movementCap===null?stats.movement:Math.min(stats.movement,unit.expSupply.movementCap)};
}

export function materializeUnit(unit: UnitState, rules: GameRules): Unit {
  return { ...unit, ...getUnitStats(unit, rules) };
}
