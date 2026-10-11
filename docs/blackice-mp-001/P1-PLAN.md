# P1 measurement plan (frozen before execution)

Baseline 99faf01b0f61df1dcf5f4333081145250ebf9ce2. Local Windows/Edge, two independent browser contexts, ephemeral loopback server and temporary save directory. Existing 4275/4277 untouched.

- One explicitly directed fixture: full opening army/economy retained, seed 219031. G-013/S-013 start at 23,4 / 24,4; German corps advance toward 24,4, Soviet corps hold. No mid-run resources, no forced contact or disabled retreat. Autopause disabled for the measurement; player/disconnect/save-failure pause retained.
- 20 s warmup, paused 20 s control, then >=300 s unpaused 1×, >=180 s unpaused 4×. Same room continues; report changing combat workload, not a controlled speed ratio. Any repair repeats this same initial fixture and sequence.
- Every ~10 s both pages drag/zoom, open direct list, select own unit, alternate HOLD and resume plan where available. Opening combat units are not selected for these commands. Record failures/rejections, not discard them. Save separately at boundaries.
- Observe server step, per-seat view, exclusive queue wait, durable save, CPU/RSS/event-loop delay, outbound bytes/backlog and combat/supply ticks. Browser: rAF opportunity intervals during input (not physical painted-frame proof), long tasks, observed DOM click feedback, send-to-RESULT, message/decoder/application timing where accessible, heap/DOM. Record visibility and headless status.
- Targets: gesture interval p95 <=33 ms; normal local ACK p95 <=500 ms; no repeated >1 s main-thread stalls; no sustained queue growth/reconnect storm. Loading, restoration, save and pause separate. Actual speed = steps × 2000 / advancing wall ms.
- Maximum two evidence-led repair rounds. No speculative gameplay change. No public/tablet/foreground physical display acceptance from this headless run. Raw bounded timing arrays retained without credentials or hidden state.

## Measurement-only correction before second run

The first complete run is retained as `baseline/`. Inspection of its final screenshot showed cumulative one-way panning. Its timing cannot certify a fixed-camera workload. No game/runtime code was changed. The `fixed-camera/` repeat returns each drag and zoom to its starting transform, records transforms, narrows rAF sampling to gestures, adds clicked-unit-to-matching-heading and pointer-to-camera-transform observations, and captures sanitized compositor DrawFrame events (if available). Same seed, full army, timing windows and two independent identities; fresh isolated namespace. Compositor tracing adds measurement overhead, so differences are not claimed as code improvement. No performance repair round used.
