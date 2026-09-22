/** Cooperative terrain work. A timer is a real task boundary (unlike Promise.resolve).
 * Only detached static surfaces use this scheduler; it never observes game state. */
export interface TerrainWorkControl {
  checkpoint(): Promise<void>;
}
export interface TerrainBuildTiming { readonly stage: string; readonly elapsedMs: number; readonly workMs: number; readonly maxSliceMs: number; readonly yields: number; }
const observers = new Set<(timing: TerrainBuildTiming) => void>();
export function observeTerrainBuild(observer: (timing: TerrainBuildTiming) => void): () => void {
  observers.add(observer); return () => { observers.delete(observer); };
}
export const yieldTerrainTask = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
export function finishTerrainWork<T>(work: Generator<void, T, void>): T {
  let next = work.next(); while (!next.done) next = work.next(); return next.value;
}
export async function runTerrainWork<T>(stage: string, work: Generator<void, T, void>, control?: TerrainWorkControl): Promise<T> {
  const start = performance.now(); let workMs = 0, maxSliceMs = 0, yields = 0;
  try {
    await yieldTerrainTask();
    while (true) {
      await control?.checkpoint();
      const slice = performance.now(); let next;
      do { next = work.next(); } while (!next.done && performance.now() - slice < 6);
      const duration = performance.now() - slice; workMs += duration; maxSliceMs = Math.max(maxSliceMs, duration);
      if (next.done) return next.value;
      yields++; await yieldTerrainTask();
    }
  } finally {
    work.return(undefined as T); // run finally blocks on cancellation/failure
    const timing = { stage, elapsedMs: performance.now() - start, workMs, maxSliceMs, yields };
    for (const observer of observers) { try { observer(timing); } catch { /* Diagnostics cannot stop a build. */ } }
  }
}
