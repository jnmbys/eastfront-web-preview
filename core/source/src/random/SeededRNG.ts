import type { RandomState } from '../core/types.js';

export interface RandomProvider {
  nextFloat(): number;
  rollDie(sides: number): number;
  roll2D6(): number;
  snapshot(): RandomState;
}

/** Deterministic xorshift32 PRNG. State is serializable for exact replay. */
export class SeededRNG implements RandomProvider {
  private seed: number;
  private state: number;
  private draws: number;

  constructor(seedOrState: number | RandomState) {
    if (typeof seedOrState === 'number') {
      const seed = seedOrState >>> 0 || 0x9e3779b9;
      this.seed = seed;
      this.state = seed;
      this.draws = 0;
    } else {
      this.seed = seedOrState.seed >>> 0;
      this.state = seedOrState.state >>> 0 || 0x9e3779b9;
      this.draws = seedOrState.draws;
    }
  }

  nextFloat(): number {
    let x = this.state >>> 0;
    x ^= (x << 13) >>> 0;
    x ^= x >>> 17;
    x ^= (x << 5) >>> 0;
    this.state = x >>> 0;
    this.draws += 1;
    return this.state / 0x100000000;
  }

  rollDie(sides: number): number {
    if (!Number.isInteger(sides) || sides < 2) throw new Error('Die must have at least 2 sides.');
    return Math.floor(this.nextFloat() * sides) + 1;
  }

  roll2D6(): number {
    return this.rollDie(6) + this.rollDie(6);
  }

  snapshot(): RandomState {
    return { seed: this.seed, state: this.state, draws: this.draws };
  }
}
