/** Deterministic xorshift32 PRNG. State is serializable for exact replay. */
export class SeededRNG {
    seed;
    state;
    draws;
    constructor(seedOrState) {
        if (typeof seedOrState === 'number') {
            const seed = seedOrState >>> 0 || 0x9e3779b9;
            this.seed = seed;
            this.state = seed;
            this.draws = 0;
        }
        else {
            this.seed = seedOrState.seed >>> 0;
            this.state = seedOrState.state >>> 0 || 0x9e3779b9;
            this.draws = seedOrState.draws;
        }
    }
    nextFloat() {
        let x = this.state >>> 0;
        x ^= (x << 13) >>> 0;
        x ^= x >>> 17;
        x ^= (x << 5) >>> 0;
        this.state = x >>> 0;
        this.draws += 1;
        return this.state / 0x100000000;
    }
    rollDie(sides) {
        if (!Number.isInteger(sides) || sides < 2)
            throw new Error('Die must have at least 2 sides.');
        return Math.floor(this.nextFloat() * sides) + 1;
    }
    roll2D6() {
        return this.rollDie(6) + this.rollDie(6);
    }
    snapshot() {
        return { seed: this.seed, state: this.state, draws: this.draws };
    }
}
