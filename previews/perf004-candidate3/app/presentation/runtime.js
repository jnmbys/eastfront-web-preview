import {perf4} from '../perf004Trace.js';
import { readModelDisplay } from './modelDisplay.js';
import { AnimationCoordinator, sequenceEvents } from './coordinator.js';
import { observePresentationTransitions } from './transitionBus.js';
import { SvgUnitPresentation } from './svgUnits.js';
import { sessionPlayerView } from '../core-adapter/session.js';
/** UI-owned lifetime. Observers receive only detached immutable presentation facts. */
export class UnitAnimationRuntime {
    coordinator;
    renderer = new SvgUnitPresentation();
    session = null;
    viewerKey = '';
    unsubscribe = () => { };
    requestedSpeed = 'normal';
    reducedMotion = false;
    constructor(clock) {
        this.coordinator = new AnimationCoordinator(clock, states => this.renderer.paint(states), (event, lifecycle) => this.renderer.lifecycle(event, lifecycle));
        this.renderer.setModelDisplay(readModelDisplay());
    }
    get modelDisplay() { return this.renderer.modelDisplay; }
    setModelDisplay(mode) { this.renderer.setModelDisplay(mode); }
    get speed() { return this.requestedSpeed; }
    get effectiveSpeed() { return this.coordinator.animationSpeed; }
    setSpeed(speed) { this.requestedSpeed = speed; this.coordinator.setSpeed(this.reducedMotion ? 'instant' : speed); }
    setReducedMotion(reduced) { this.reducedMotion = reduced; this.setSpeed(this.requestedSpeed); }
    skip() { this.coordinator.skip(); }
    sync(session, root) {const __p4end=perf4.begin("presentation/runtime.js:UnitAnimationRuntime.sync");try{
        const view = session ? ('playerView' in session ? session.playerView : sessionPlayerView(session)) : null;
        const viewerKey = `${view?.viewer}:${session?.visibilityRevision ?? 0}`;
        if (this.viewerKey !== viewerKey) {
            this.coordinator.reset();
            this.renderer.dispose();
            this.viewerKey = viewerKey;
        }
        if (this.session !== session) {
            this.unsubscribe();
            this.coordinator.reset();
            this.renderer.dispose();
            this.session = session;
            this.unsubscribe = session ? observePresentationTransitions(session, events => {
                this.renderer.prepare(events);
                this.coordinator.enqueue(sequenceEvents(events));
            }) : () => { };
        }
        // No visible map (privacy, HOME or game over): settle and release old DOM references.
        if (!root) {
            this.coordinator.reset();
            this.renderer.dispose();
            return;
        }
        // Remount boundary only. Pass detached identity, never GameState, to the renderer.
        // The canonical Counter DOM controls visibility (including deployment privacy).
        const identities = (view?.units ?? []).map(({ id, side, type }) => ({ id, side, type }));
        this.renderer.bind(root, identities);
        this.renderer.paint(this.coordinator.snapshot());
    }finally{__p4end();}}
    dispose() { this.unsubscribe(); this.coordinator.dispose(); this.renderer.dispose(); this.session = null; }
}
