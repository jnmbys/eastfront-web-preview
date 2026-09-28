import type {DeepReadonly,FairInput,FairIntent} from '../fair/index.js';
// Compile-time guard; never run with privileged data.
export function contract(input:DeepReadonly<FairInput>):void {
  // @ts-expect-error Full state is not a strategy capability.
  input.state;
  // @ts-expect-error Observer full state is removed, not merely readonly.
  input.view.authoritativeState;
  // @ts-expect-error Combat RNG is not present.
  input.view.random;
  // @ts-expect-error No source scenario deployments or secret setup.
  input.rules.initialUnits;
  // @ts-expect-error No authoritative preview callback.
  input.preview({});
  // @ts-expect-error DTO is deeply readonly.
  input.view.hexes[0]!.coord.q=42;
  // @ts-expect-error Controller identity is injected by the host.
  const forged:FairIntent={type:'READY_FOR_PHASE_END',controllerId:'opponent'};
  void forged;
}
