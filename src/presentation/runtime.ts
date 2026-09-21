import { AnimationCoordinator, sequenceEvents, type AnimationClock } from './coordinator.js';
import { observePresentationTransitions } from './transitionBus.js';
import { SvgUnitPresentation } from './svgUnits.js';
import type { AnimationSpeed } from './timing.js';
import type { LocalGameSession } from '../core-adapter/session.js';

/** UI-owned lifetime. Observers receive only detached immutable presentation facts. */
export class UnitAnimationRuntime {
  readonly coordinator:AnimationCoordinator;
  private readonly renderer=new SvgUnitPresentation();
  private session:object|null=null;
  private unsubscribe:()=>void=()=>{};
  private requestedSpeed:AnimationSpeed='normal';
  private reducedMotion=false;
  constructor(clock:AnimationClock){this.coordinator=new AnimationCoordinator(clock,states=>this.renderer.paint(states),
    (event,lifecycle)=>this.renderer.lifecycle(event,lifecycle));}
  get speed():AnimationSpeed{return this.requestedSpeed;}
  get effectiveSpeed():AnimationSpeed{return this.coordinator.animationSpeed;}
  setSpeed(speed:AnimationSpeed):void {this.requestedSpeed=speed;this.coordinator.setSpeed(this.reducedMotion?'instant':speed);}
  setReducedMotion(reduced:boolean):void {this.reducedMotion=reduced;this.setSpeed(this.requestedSpeed);}
  skip():void {this.coordinator.skip();}
  sync(session:LocalGameSession|null,root:ParentNode|null):void {
    if(this.session!==session){
      this.unsubscribe();this.coordinator.reset();this.renderer.dispose();this.session=session;
      this.unsubscribe=session?observePresentationTransitions(session,events=>{
        this.renderer.prepare(events);
        this.coordinator.enqueue(sequenceEvents(events));
      }):()=>{};
    }
    // No visible map (privacy, HOME or game over): settle and release old DOM references.
    if(!root){this.coordinator.reset();this.renderer.dispose();return;}
    // Remount boundary only. Pass detached identity, never GameState, to the renderer.
    // The canonical Counter DOM controls visibility (including deployment privacy).
    const identities=Object.values(session?.state.units??{}).map(({id,side,type})=>({id,side,type}));
    this.renderer.bind(root,identities);this.renderer.paint(this.coordinator.snapshot());
  }
  dispose():void {this.unsubscribe();this.coordinator.dispose();this.renderer.dispose();this.session=null;}
}
