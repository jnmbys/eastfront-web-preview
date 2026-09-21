export type AnimationSpeed='normal'|'fast'|'instant';
export const ANIMATION_TIMING=Object.freeze({
  MOVE_STEP:260,COMBAT_WINDUP:160,COMBAT_FIRE:120,COMBAT_RESULT:0,
  HIT_REACTION:150,RETREAT_STEP:220,ADVANCE_STEP:240,BREAKTHROUGH_STEP:200,DESTROYED:160,
});
export const SPEED_MULTIPLIER:Readonly<Record<AnimationSpeed,number>>=Object.freeze({normal:1,fast:0.4,instant:0});
