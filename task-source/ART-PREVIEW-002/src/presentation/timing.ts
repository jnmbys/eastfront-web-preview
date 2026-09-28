export type AnimationSpeed='normal'|'fast'|'instant';
export const ANIMATION_TIMING=Object.freeze({
  MOVE_STEP:260,COMBAT_WINDUP:110,COMBAT_FIRE:130,COMBAT_RESULT:0,
  FIRE_STAGGER:28,FIRE_STAGGER_CAP:84,
  HIT_REACTION:120,RETREAT_STEP:190,ADVANCE_STEP:215,BREAKTHROUGH_STEP:165,DESTROYED:170,
});
export const SPEED_MULTIPLIER:Readonly<Record<AnimationSpeed,number>>=Object.freeze({normal:1,fast:0.4,instant:0});
