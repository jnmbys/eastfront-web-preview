/** UnitState.controllerId is the sole persisted ownership source. */
export function getControlledUnits(state, controllerId) {
    return Object.values(state.units).filter((unit) => unit.controllerId === controllerId);
}
export function getControlledUnitIds(state, controllerId) {
    return getControlledUnits(state, controllerId).map((unit) => unit.id);
}
