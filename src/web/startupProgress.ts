import type { TerrainLoadProgressEvent } from '../render/terrainLoadProgress.js';

// Five loader boundaries plus home markup readiness. No elapsed-time/byte estimates.
export const STARTUP_MILESTONES = ['resources', 'model', 'far', 'medium', 'close'] as const;
export type StartupMilestone = typeof STARTUP_MILESTONES[number];
export type StartupStage = 'initializing' | 'assets' | 'building' | 'ready' | 'failed';
export interface StartupSnapshot {
  readonly stage: StartupStage;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly completedAssets: number;
  readonly batchCompleted: number;
  readonly batchTotal: number | null;
}
export class StartupProgress {
  private readonly completed = new Set<StartupMilestone>();
  private value: StartupSnapshot = Object.freeze({ stage: 'initializing', completedSteps: 0,
    totalSteps: STARTUP_MILESTONES.length + 1, completedAssets: 0, batchCompleted: 0, batchTotal: null });
  private readonly listeners = new Set<(snapshot: StartupSnapshot) => void>();
  get snapshot(): StartupSnapshot { return this.value; }
  subscribe(listener: (snapshot: StartupSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }
  private publish(change: Partial<StartupSnapshot>): void {
    if (this.value.stage === 'ready' || this.value.stage === 'failed') return;
    this.value = Object.freeze({ ...this.value, ...change });
    for (const listener of this.listeners) {
      try { listener(this.value); } catch { /* UI observation cannot stop startup. */ }
    }
  }
  complete(milestone: StartupMilestone): void {
    if (this.value.stage === 'ready' || this.value.stage === 'failed') return;
    if (!STARTUP_MILESTONES.includes(milestone) || this.completed.has(milestone)) return;
    this.completed.add(milestone);
    this.publish({ completedSteps: this.completed.size });
  }
  building(): void { this.publish({ stage: 'building', batchTotal: null }); }
  observe = (event: TerrainLoadProgressEvent): void => {
    if (event.kind === 'assets') this.publish({ stage: 'assets', batchCompleted: 0, batchTotal: event.total });
    else if (event.kind === 'building') this.building();
    else this.publish({ completedAssets: this.value.completedAssets + 1, batchCompleted: this.value.batchCompleted + 1 });
  };
  finish(): void {
    if (this.completed.size === STARTUP_MILESTONES.length) this.publish({ stage: 'ready', completedSteps: this.value.totalSteps, batchTotal: null });
  }
  fail(): void { this.publish({ stage: 'failed', batchTotal: null }); }
}
export const startupProgress = new StartupProgress();
