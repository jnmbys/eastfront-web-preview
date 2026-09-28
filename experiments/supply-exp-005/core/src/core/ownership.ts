import type { EntityId, GameState, UnitState } from './types.js';

/** UnitState.controllerId is the sole persisted ownership source. */
export function getControlledUnits(state: GameState, controllerId: EntityId): UnitState[] {
  return Object.values(state.units).filter((unit)=>unit.controllerId===controllerId);
}

export function getControlledUnitIds(state: GameState, controllerId: EntityId): EntityId[] {
  return getControlledUnits(state,controllerId).map((unit)=>unit.id);
}
