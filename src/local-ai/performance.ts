/** Opt-in scalar diagnostics, no state/actions/coordinates; no live DOM repaint.
 * Parent spans are inclusive. Queue time includes clone/dispatch, not just wire time.
 * RAF marks a callback opportunity before paint, never presentation latency. */
type Summary={count:number;totalMs:number;maxMs:number;lastMs:number;samples:number[]};
class LocalPerformance {
 enabled=false;private active=false;private generation=0;private rows:Record<string,Summary>={};private installed=false;private startedAt=0;
 private pending=new Set<string>();private supported:string[]=[];
 start(enabled:boolean){this.enabled=enabled;this.active=enabled;this.generation++;this.rows={};this.pending.clear();this.startedAt=performance.now();if(enabled)this.install();}
 stop(){this.record('stopHandled',0);this.active=false;this.generation++;this.pending.clear();}
 record(name:string,ms:number){if(!this.active||!Number.isFinite(ms)||ms<0)return;const r=this.rows[name]??={count:0,totalMs:0,maxMs:0,lastMs:0,samples:[]};r.count++;r.totalMs+=ms;r.maxMs=Math.max(r.maxMs,ms);r.lastMs=ms;r.samples.push(ms);if(r.samples.length>128)r.samples.shift();}
 measure<T>(name:string,fn:()=>T):T{if(!this.active)return fn();const start=performance.now();try{return fn();}finally{this.record(name,performance.now()-start);}}
 total(name:string){return this.rows[name]?.totalMs??0;}
 last(name:string){return this.rows[name]?.lastMs??0;}
 report(){return {version:'AI-PERF-006',active:this.active,generation:this.generation,visibility:typeof document==='undefined'?'worker':document.visibilityState,supported:this.supported,stages:structuredClone(this.rows)};}
 private install(){
  if(this.installed||typeof document==='undefined')return;this.installed=true;
  if(typeof PerformanceObserver!=='undefined'){
   this.supported=[...PerformanceObserver.supportedEntryTypes];
   if(this.supported.includes('longtask'))new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.startTime>=this.startedAt)this.record('mainLongTask',e.duration);}).observe({type:'longtask',buffered:false});
  }
  for(const type of ['pointermove','pointerup','wheel','click'])document.addEventListener(type,event=>{
   if(!this.active||document.visibilityState!=='visible')return;
   const el=event.target instanceof Element?event.target:null;
   const control=el?.closest('button')?.id;
   const name=control==='ai-exit'||control==='restart-button'?'exit':control==='ai-takeover'?'takeover':type==='wheel'||control?.startsWith('zoom-')?'zoom':type==='pointermove'&&'buttons' in event&&event.buttons?'drag':'other';
   if(name==='other')return;
   const start=performance.now(),queue=start-event.timeStamp,epoch=this.generation;
   if(queue>=0&&queue<60000)this.record(name+'EventQueue',queue);
   if(this.pending.has(name))return;this.pending.add(name);
   requestAnimationFrame(()=>{if(epoch!==this.generation)return;this.pending.delete(name);this.record(name+'CallbackToRAF',performance.now()-start);});
  },{capture:true,passive:true});
 }
}
export const perf006=new LocalPerformance();
