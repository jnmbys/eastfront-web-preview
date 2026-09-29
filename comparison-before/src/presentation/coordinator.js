import { hexToPixel } from '../geometry/hex.js';
import { isTravelEvent, firingParticipants } from './events.js';
import { ANIMATION_TIMING as T, SPEED_MULTIPLIER } from './timing.js';
import { ZERO, mix, travelEase, travelAccent, cueAccent, fireDelay, fireStagger } from './motion.js';
const travelPhase = { move: 'moving', retreat: 'retreating', advance: 'advancing', breakthrough: 'breakthrough' };
const travelTiming = { move: T.MOVE_STEP, retreat: T.RETREAT_STEP, advance: T.ADVANCE_STEP, breakthrough: T.BREAKTHROUGH_STEP };
export function eventDuration(event) {
    if (isTravelEvent(event))
        return Math.max(1, event.path.length - 1) * travelTiming[event.kind];
    switch (event.kind) {
        case 'combat-started': return T.COMBAT_WINDUP;
        case 'combat-fire': return T.COMBAT_FIRE + fireStagger(firingParticipants(event).length);
        case 'hit': return T.HIT_REACTION;
        case 'destroyed': return T.DESTROYED;
        default: return T.COMBAT_RESULT;
    }
}
/** One short reaction per affected unit, then losses disappear together. Travel retains
 * the accepted event order. Only adjacent loss facts in this accepted action are grouped. */
export function sequenceEvents(events) {
    const steps = [];
    let hits = new Map(), losses = new Map();
    const flush = () => { if (hits.size)
        steps.push({ parallel: [...hits.values()] }); if (losses.size)
        steps.push({ parallel: [...losses.values()] }); hits.clear(); losses.clear(); };
    for (const event of events) {
        if (event.kind === 'hit') {
            hits.set(event.unitId, event);
            continue;
        }
        if (event.kind === 'destroyed') {
            losses.set(event.unitId, event);
            continue;
        }
        flush();
        steps.push({ parallel: [event] });
    }
    flush();
    return steps;
}
export class AnimationCoordinator {
    clock;
    paint;
    onEvent;
    queue = [];
    active = null;
    frame = null;
    states = new Map();
    paths = new WeakMap();
    disposed = false;
    speed = 'normal';
    constructor(clock, paint, onEvent = () => { }) {
        this.clock = clock;
        this.paint = paint;
        this.onEvent = onEvent;
    }
    get busy() { return this.active !== null || this.queue.length > 0; }
    get animationSpeed() { return this.speed; }
    snapshot() { return new Map(this.states); }
    enqueue(steps, policy = 'append') {
        if (this.disposed)
            return;
        // A duplicate unit in one parallel barrier has ambiguous transforms. Serialize it.
        const normalized = [];
        for (const step of steps) {
            for (const event of step.parallel)
                if (isTravelEvent(event))
                    this.paths.set(event, event.path.map(hex => hexToPixel(hex)));
            const ids = step.parallel.flatMap(e => 'unitId' in e ? [e.unitId] : e.kind === 'combat-started' || e.kind === 'combat-fire' ? (e.kind === 'combat-fire' ? firingParticipants(e) : e.attackers).map(a => a.unitId) : []);
            if (new Set(ids).size !== ids.length)
                normalized.push(...step.parallel.map(event => ({ parallel: [event] })));
            else
                normalized.push({ parallel: [...step.parallel] });
        }
        if (policy === 'finish-and-replace')
            this.skip();
        this.queue.push(...normalized);
        if (this.speed === 'instant') {
            this.skip();
            return;
        }
        if (!this.active)
            this.start(this.clock.now());
        this.render();
        this.schedule();
    }
    setSpeed(speed) {
        if (this.disposed)
            return;
        if (speed === 'instant') {
            this.speed = speed;
            this.skip();
            return;
        }
        // Account for elapsed time with the OLD speed, then retain interpolation progress.
        this.advance(this.clock.now());
        this.speed = speed;
        this.schedule();
    }
    /** Finish all visual work now. Canonical state was already committed before enqueue. */
    skip() {
        for (const event of [...(this.active?.events ?? []), ...this.queue.flatMap(step => step.parallel)])
            this.notify(event, 'skipped');
        this.cancelFrame();
        this.queue = [];
        this.active = null;
        this.states.clear();
        this.paint(this.snapshot());
    }
    reset() { this.skip(); }
    dispose() { this.skip(); this.disposed = true; }
    start(now) {
        const next = this.queue.shift();
        this.active = next ? { events: next.parallel, elapsed: 0, lastTime: now, durations: next.parallel.map(eventDuration) } : null;
        for (const event of this.active?.events ?? [])
            this.notify(event, 'started');
    }
    advance(now) {
        if (!this.active)
            return;
        let budget = Math.max(0, now - this.active.lastTime) / Math.max(SPEED_MULTIPLIER[this.speed], 0.001);
        this.active.lastTime = now;
        while (this.active) {
            const length = Math.max(0, ...this.active.durations), remaining = length - this.active.elapsed;
            if (budget < remaining) {
                this.active.elapsed += budget;
                break;
            }
            budget -= remaining;
            for (const event of this.active.events)
                this.notify(event, 'finished');
            this.start(now);
        }
    }
    render() {
        this.states.clear();
        // Hold queued movers at their actual source before their barrier starts. Otherwise
        // a render of already-committed Core state would flash the destination first.
        const waiting = this.queue.flatMap(step => step.parallel);
        for (const event of [...(this.active?.events ?? []), ...waiting]) {
            const index = this.active?.events.indexOf(event) ?? -1;
            const duration = index >= 0 ? this.active.durations[index] : eventDuration(event);
            const progress = index >= 0 ? Math.min(1, this.active.elapsed / Math.max(1, duration)) : 0;
            if (isTravelEvent(event)) {
                if (this.states.has(event.unitId))
                    continue;
                const points = this.paths.get(event), segments = points.length - 1;
                const at = progress * segments, i = Math.min(Math.floor(at), segments - 1), fraction = progress === 1 ? 1 : at - i;
                const eased = travelEase(event.kind, fraction);
                const anchor = mix(points[Math.max(0, i)], points[Math.max(0, i + 1)], eased);
                const offset = i === 0 ? mix(event.sourceOffset, segments === 1 ? event.destinationOffset : { x: 0, y: 0 }, eased)
                    : i === segments - 1 ? mix({ x: 0, y: 0 }, event.destinationOffset, eased) : { x: 0, y: 0 };
                const destination = points.at(-1);
                const delta = { x: points[Math.max(0, i + 1)].x - points[Math.max(0, i)].x, y: points[Math.max(0, i + 1)].y - points[Math.max(0, i)].y };
                const length = Math.hypot(delta.x, delta.y) || 1, direction = { x: delta.x / length, y: delta.y / length };
                this.states.set(event.unitId, Object.freeze({ unitId: event.unitId, currentCanonicalPosition: anchor,
                    currentVisualPosition: { x: anchor.x + offset.x, y: anchor.y + offset.y }, targetVisualPosition: { x: destination.x + event.destinationOffset.x, y: destination.y + event.destinationOffset.y },
                    phase: travelPhase[event.kind], progress, emphasis: Math.sin(progress * Math.PI) * 0.035, opacity: 1, visible: true,
                    ...travelAccent(event.kind, progress, direction), direction, character: 'generic' }));
            }
            else if (event.kind === 'hit' || event.kind === 'destroyed') {
                this.cue(event.participant, event.kind, progress, index >= 0);
            }
            else if (event.kind === 'combat-started' || event.kind === 'combat-fire') {
                const participants = event.kind === 'combat-fire' ? firingParticipants(event) : event.attackers;
                participants.forEach((participant, at) => {
                    const local = event.kind === 'combat-fire' ? Math.max(0, Math.min(1, ((index >= 0 ? this.active.elapsed : 0) - fireDelay(at, participants.length)) / T.COMBAT_FIRE)) : progress;
                    this.cue(participant, event.kind === 'combat-fire' ? 'firing' : 'windup', local, index >= 0);
                });
            }
        }
        this.paint(this.snapshot());
    }
    cue(participant, phase, progress, active) {
        if (this.states.has(participant.unitId))
            return;
        const position = { x: participant.position.x + participant.offset.x, y: participant.position.y + participant.offset.y };
        const accent = active ? cueAccent(phase, progress, participant.direction, participant.character) : { motionOffset: ZERO, scale: 1, effect: 0, opacity: 1 };
        this.states.set(participant.unitId, Object.freeze({ unitId: participant.unitId, currentCanonicalPosition: participant.position,
            currentVisualPosition: position, targetVisualPosition: position, phase: active ? phase : 'idle', progress,
            emphasis: accent.effect, visible: true, ...accent, direction: participant.direction, character: participant.character }));
    }
    schedule() {
        if (!this.busy || this.frame !== null || this.disposed)
            return;
        this.frame = this.clock.request(now => { this.frame = null; this.advance(now); this.render(); this.schedule(); });
    }
    cancelFrame() { if (this.frame !== null)
        this.clock.cancel(this.frame); this.frame = null; }
    notify(event, lifecycle) {
        try {
            this.onEvent(event, lifecycle);
        }
        catch (error) {
            console.error('Animation hook failed', error);
        }
    }
}
