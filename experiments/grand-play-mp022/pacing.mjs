// Wall-time scheduling only. Game steps remain atomic five-minute settlements.
// Never bank CPU/network stalls as future catch-up work or compute future RNG.
export const INTERACTIVE_STEP_MS=2000;
export function pacedBudget(accumulated,elapsed,speed,period=INTERACTIVE_STEP_MS){
 const budget=Math.min(period,Math.max(0,accumulated)+Math.min(250,Math.max(0,elapsed))*speed);
 return {due:budget>=period,remaining:budget>=period?0:budget};
}
