import { AnimationCoordinator, sequenceEvents } from './coordinator.js';
import { observePresentationTransitions } from './transitionBus.js';
import { SvgUnitPresentation } from './svgUnits.js';
/** UI-owned lifetime. Observers receive only detached immutable presentation facts. */
export class UnitAnimationRuntime {
    coordinator;
    renderer = new SvgUnitPresentation();
    session = null;
    unsubscribe = () => { };
    requestedSpeed = 'normal';
    reducedMotion = false;
    constructor(clock) {
        this.coordinator = new AnimationCoordinator(clock, states => this.renderer.paint(states), (event, lifecycle) => this.renderer.lifecycle(event, lifecycle));
    }
    get speed() { return this.requestedSpeed; }
    get effectiveSpeed() { return this.coordinator.animationSpeed; }
    setSpeed(speed) { this.requestedSpeed = speed; this.coordinator.setSpeed(this.reducedMotion ? 'instant' : speed); }
    setReducedMotion(reduced) { this.reducedMotion = reduced; this.setSpeed(this.requestedSpeed); }
    skip() { this.coordinator.skip(); }
    sync(session, root) {
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
        const identities = Object.values(session?.state.units ?? {}).map(({ id, side, type }) => ({ id, side, type }));
        this.renderer.bind(root, identities);
        this.renderer.paint(this.coordinator.snapshot());
    }
    dispose() { this.unsubscribe(); this.coordinator.dispose(); this.renderer.dispose(); this.session = null; }
}
