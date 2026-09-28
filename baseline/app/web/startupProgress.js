// Five loader boundaries plus home markup readiness. No elapsed-time/byte estimates.
export const STARTUP_MILESTONES = ['resources', 'model', 'far', 'medium', 'close'];
export class StartupProgress {
    completed = new Set();
    value = Object.freeze({ stage: 'initializing', completedSteps: 0,
        totalSteps: STARTUP_MILESTONES.length + 1, completedAssets: 0, batchCompleted: 0, batchTotal: null });
    listeners = new Set();
    get snapshot() { return this.value; }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    publish(change) {
        if (this.value.stage === 'ready' || this.value.stage === 'failed')
            return;
        this.value = Object.freeze({ ...this.value, ...change });
        for (const listener of this.listeners) {
            try {
                listener(this.value);
            }
            catch { /* UI observation cannot stop startup. */ }
        }
    }
    complete(milestone) {
        if (this.value.stage === 'ready' || this.value.stage === 'failed')
            return;
        if (!STARTUP_MILESTONES.includes(milestone) || this.completed.has(milestone))
            return;
        this.completed.add(milestone);
        this.publish({ completedSteps: this.completed.size });
    }
    building() { this.publish({ stage: 'building', batchTotal: null }); }
    observe = (event) => {
        if (event.kind === 'assets')
            this.publish({ stage: 'assets', batchCompleted: 0, batchTotal: event.total });
        else if (event.kind === 'building')
            this.building();
        else
            this.publish({ completedAssets: this.value.completedAssets + 1, batchCompleted: this.value.batchCompleted + 1 });
    };
    finish() {
        if (this.completed.size === STARTUP_MILESTONES.length)
            this.publish({ stage: 'ready', completedSteps: this.value.totalSteps, batchTotal: null });
    }
    fail() { this.publish({ stage: 'failed', batchTotal: null }); }
}
export const startupProgress = new StartupProgress();
