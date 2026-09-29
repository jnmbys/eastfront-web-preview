import type { EntityId, GameState, UnitState } from './types.js';
/** UnitState.controllerId is the sole persisted ownership source. */
export declare function getControlledUnits(state: GameState, controllerId: EntityId): UnitState[];
export declare function getControlledUnitIds(state: GameState, controllerId: EntityId): EntityId[];
