/** Presentation-only trailing work. Never delays receipt/state application or simulation. */
export class ViewportWork {
  private timer: ReturnType<typeof setTimeout>|null = null;
  private held = false;
  private dirty = false;
  private scaleChanged = false;
  constructor(private readonly paint:(scaleChanged:boolean)=>void,
    private readonly schedule:typeof setTimeout=setTimeout,
    private readonly cancel:typeof clearTimeout=clearTimeout,
    private readonly delay=120) {}
  get busy():boolean { return this.held || this.timer!==null; }
  hold():void { this.held=true; this.clearTimer(); }
  request(scaleChanged=false):void {
    this.dirty=true; this.scaleChanged ||= scaleChanged;
    if(!this.held)this.arm();
  }
  release():void {
    this.held=false;
    if(this.dirty)this.arm();
  }
  dispose():void { this.clearTimer();this.held=false;this.dirty=false;this.scaleChanged=false; }
  // Window timer functions require their native receiver. Calling a stored
  // function as this.schedule()/this.cancel() binds the scheduler as `this`
  // and throws Illegal invocation in browsers (Node timers tolerate it).
  private clearTimer():void { if(this.timer!==null)this.cancel.call(globalThis,this.timer);this.timer=null; }
  private arm():void {
    this.clearTimer();
    this.timer=this.schedule.call(globalThis,()=>{
      this.timer=null;
      const scale=this.scaleChanged;this.dirty=false;this.scaleChanged=false;
      this.paint(scale);
    },this.delay);
  }
}
