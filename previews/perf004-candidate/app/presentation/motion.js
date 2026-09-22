import { ANIMATION_TIMING as T } from './timing.js';
/** All dimensions are small presentation offsets, never alternate map geometry. */
export const MOTION_PROFILES = Object.freeze({
    move: { lift: 2.6, scale: 0.018, forward: 0 },
    retreat: { lift: 1.2, scale: 0.010, forward: -0.7 },
    advance: { lift: 1.8, scale: 0.025, forward: 0.6 },
    breakthrough: { lift: 2.9, scale: 0.040, forward: 1.2 },
});
export const CUE_PROFILES = Object.freeze({
    generic: { recoil: 1.5, reach: 7 }, infantry: { recoil: 1.2, reach: 6 },
    armor: { recoil: 2.4, reach: 8 }, artillery: { recoil: 2, reach: 10 },
});
export const EFFECT_LOD = Object.freeze({ far: 0.18, medium: 0.72, close: 1 });
export const ZERO = Object.freeze({ x: 0, y: 0 });
export const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const smooth = (t) => t * t * t * (t * (t * 6 - 15) + 10);
/** Each accepted segment retains its exact endpoints; settle is inside its duration. */
export function travelEase(kind, t) {
    const settle = kind === 'move' ? 0.88 : kind === 'retreat' ? 0.92 : 0.90;
    const at = Math.min(1, t / settle);
    return smooth(kind === 'retreat' ? Math.pow(at, 0.72) : kind === 'breakthrough' ? Math.pow(at, 0.78) : at);
}
export function travelAccent(kind, progress, direction) {
    const profile = MOTION_PROFILES[kind], envelope = Math.sin(Math.PI * progress);
    const urgency = kind === 'retreat' ? Math.sin(Math.PI * Math.min(1, progress * 5)) * .6 : 0;
    return { motionOffset: { x: direction.x * profile.forward * envelope, y: direction.y * profile.forward * envelope - profile.lift * envelope },
        scale: 1 + profile.scale * envelope, effect: Math.max(envelope * .4, urgency) };
}
export function fireStagger(count) { return Math.min(T.FIRE_STAGGER_CAP, Math.max(0, count - 1) * T.FIRE_STAGGER); }
export function fireDelay(index, count) { return count > 1 ? index * fireStagger(count) / (count - 1) : 0; }
export function cueAccent(phase, progress, direction, character) {
    const envelope = Math.sin(Math.PI * progress), recoil = CUE_PROFILES[character].recoil;
    switch (phase) {
        case 'windup': return { motionOffset: ZERO, scale: 1 + envelope * .025, effect: envelope * .45, opacity: 1 };
        case 'firing': return { motionOffset: { x: -direction.x * recoil * envelope, y: -direction.y * recoil * envelope }, scale: 1 + envelope * .012, effect: envelope, opacity: 1 };
        case 'hit': return { motionOffset: { x: Math.sin(progress * Math.PI * 4) * envelope * 1.8, y: 0 }, scale: 1 - envelope * .012, effect: envelope, opacity: 1 };
        case 'destroyed': return { motionOffset: { x: 0, y: progress * 2 }, scale: 1 - progress * .18, effect: envelope, opacity: (1 - progress) ** 2 };
    }
}
