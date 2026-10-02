// Continuous foreground time only. Hidden/unready intervals reset the full wait.
export class ForegroundGate {
  constructor(requiredVisibleMs = 5000) { this.requiredVisibleMs = requiredVisibleMs; this.since = null; }
  update(now, visible, targetReady) {
    if (!visible || !targetReady) this.since = null;
    else this.since ??= now;
    const continuousVisibleMs = this.since === null ? 0 : Math.max(0, now - this.since);
    return {requiredVisibleMs:this.requiredVisibleMs, continuousVisibleMs,
      satisfiedAtInput:visible && targetReady && continuousVisibleMs >= this.requiredVisibleMs};
  }
}
