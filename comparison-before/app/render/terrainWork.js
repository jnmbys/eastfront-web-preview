const observers = new Set();
export function observeTerrainBuild(observer) {
    observers.add(observer);
    return () => { observers.delete(observer); };
}
export const yieldTerrainTask = () => new Promise(resolve => setTimeout(resolve, 0));
export function finishTerrainWork(work) {
    let next = work.next();
    while (!next.done)
        next = work.next();
    return next.value;
}
export async function runTerrainWork(stage, work, control) {
    const start = performance.now();
    let workMs = 0, maxSliceMs = 0, yields = 0;
    try {
        await yieldTerrainTask();
        while (true) {
            await control?.checkpoint();
            const slice = performance.now();
            let next;
            do {
                next = work.next();
            } while (!next.done && performance.now() - slice < 6);
            const duration = performance.now() - slice;
            workMs += duration;
            maxSliceMs = Math.max(maxSliceMs, duration);
            if (next.done)
                return next.value;
            yields++;
            await yieldTerrainTask();
        }
    }
    finally {
        work.return(undefined); // run finally blocks on cancellation/failure
        const timing = { stage, elapsedMs: performance.now() - start, workMs, maxSliceMs, yields };
        for (const observer of observers) {
            try {
                observer(timing);
            }
            catch { /* Diagnostics cannot stop a build. */ }
        }
    }
}
