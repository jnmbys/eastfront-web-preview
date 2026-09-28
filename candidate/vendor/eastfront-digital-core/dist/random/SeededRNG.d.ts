import type { RandomState } from '../core/types.js';
export interface RandomProvider {
    nextFloat(): number;
    rollDie(sides: number): number;
    roll2D6(): number;
    snapshot(): RandomState;
}
/** Deterministic xorshift32 PRNG. State is serializable for exact replay. */
export declare class SeededRNG implements RandomProvider {
    private seed;
    private state;
    private draws;
    constructor(seedOrState: number | RandomState);
    nextFloat(): number;
    rollDie(sides: number): number;
    roll2D6(): number;
    snapshot(): RandomState;
}
