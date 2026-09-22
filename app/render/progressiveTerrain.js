import { yieldTerrainTask } from './terrainWork.js';
const lods = ['far', 'medium', 'close'];
/** One bounded static-map cache and one builder, independent of sessions/viewers.
 * Pausing retains partial detached work. Disposal rejects it at the next safe batch.
 * The caller alone decides whether a completed surface belongs in the current UI. */
export class ProgressiveTerrain {
    build;
    changed;
    release;
    ready = new Map();
    failures = new Map();
    wanted = [];
    running = null;
    active = true;
    disposed = false;
    wake = [];
    waiters = new Map();
    constructor(build, changed, release) {
        this.build = build;
        this.changed = changed;
        this.release = release;
    }
    async checkpoint() {
        while (!this.active && !this.disposed)
            await new Promise(resolve => this.wake.push(resolve));
        if (this.disposed)
            throw new Error('Terrain build disposed');
    }
    pause() { this.active = false; }
    resume() { if (this.disposed)
        return; this.active = true; this.wake.splice(0).forEach(wake => wake()); void this.pump(); }
    request(lod) {
        if (this.disposed)
            return Promise.reject(new Error('Terrain cache disposed'));
        if (this.ready.has(lod))
            return Promise.resolve(this.ready.get(lod));
        if (this.failures.has(lod))
            return Promise.reject(this.failures.get(lod));
        const result = new Promise((resolve, reject) => {
            const list = this.waiters.get(lod) ?? [];
            list.push({ resolve, reject });
            this.waiters.set(lod, list);
        });
        this.prioritize(lod);
        return result;
    }
    prioritize(lod) {
        if (this.disposed || this.ready.has(lod) || this.failures.has(lod) || this.running === lod)
            return;
        this.wanted = [lod, ...this.wanted.filter(item => item !== lod)];
        void this.pump();
    }
    continueAll() {
        for (const lod of lods)
            if (!this.ready.has(lod) && !this.failures.has(lod) && this.running !== lod && !this.wanted.includes(lod))
                this.wanted.push(lod);
        void this.pump();
    }
    retry() { this.failures.clear(); this.continueAll(); }
    best(lod) {
        return this.ready.get(lod) ?? [...lods].sort((a, b) => Math.abs(lods.indexOf(a) - lods.indexOf(lod)) - Math.abs(lods.indexOf(b) - lods.indexOf(lod))).map(item => this.ready.get(item)).find(Boolean);
    }
    dispose() {
        this.disposed = true;
        this.wanted = [];
        this.wake.splice(0).forEach(wake => wake());
        for (const list of this.waiters.values())
            for (const item of list)
                item.reject(new Error('Terrain cache disposed'));
        this.waiters.clear();
        for (const surface of this.ready.values())
            this.release(surface);
        this.ready.clear();
    }
    async pump() {
        if (this.running || !this.active || this.disposed)
            return;
        const lod = this.wanted.shift();
        if (!lod)
            return;
        this.running = lod;
        try {
            await yieldTerrainTask();
            await this.checkpoint();
            const surface = await this.build(lod, this);
            if (this.disposed) {
                this.release(surface);
                return;
            }
            this.ready.set(lod, surface);
            for (const waiter of this.waiters.get(lod) ?? [])
                waiter.resolve(surface);
        }
        catch (error) {
            if (!this.disposed)
                this.failures.set(lod, error);
            for (const waiter of this.waiters.get(lod) ?? [])
                waiter.reject(error);
        }
        finally {
            this.waiters.delete(lod);
            this.running = null;
            if (!this.disposed) {
                this.changed(lod);
                void this.pump();
            }
        }
    }
}
