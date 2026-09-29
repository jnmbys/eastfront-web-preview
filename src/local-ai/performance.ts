/** Opt-in scalar diagnostics, no state/actions/coordinates; no live DOM repaint.
 * Parent spans are inclusive. Queue time includes clone/dispatch, not just wire time.
 * RAF marks a callback opportunity before paint, never presentation latency. */
type InputSample={id:number;type:string;name:string;eventTimeStamp:number;captureNow:number;timeOrigin:number;trusted:boolean;visibilityAtCapture:string;visibilityChanges:number;timestampToCaptureMs:number|null;handlerCompletion:'unmeasured';status:'pending'|'raf'|'stopped';rafTimeStamp?:number;rafCallbackNow?:number;captureToRafCallbackMs?:number;visibilityAtRAF?:string;visibilityChanged?:boolean};
type Summary={count:number;totalMs:number;maxMs:number;lastMs:number;samples:number[]};
class LocalPerformance {
 enabled=false;private active=false;private generation=0;private rows:Record<string,Summary>={};private installed=false;private startedAt=0;
 private pending:InputSample[]=[];private inputs:InputSample[]=[];private nextInput=0;private visibilityChanges=0;private droppedInputs=0;private supported:string[]=[];
 start(enabled:boolean){this.enabled=enabled;this.active=enabled;this.generation++;this.rows={};this.pending=[];this.inputs=[];this.nextInput=0;this.visibilityChanges=0;this.droppedInputs=0;this.startedAt=performance.now();if(enabled)this.install();}
 stop(){this.record('stopHandled',0);this.active=false;this.generation++;for(const sample of this.pending)sample.status='stopped';this.pending=[];}
 record(name:string,ms:number){if(!this.active||!Number.isFinite(ms)||ms<0)return;const r=this.rows[name]??={count:0,totalMs:0,maxMs:0,lastMs:0,samples:[]};r.count++;r.totalMs+=ms;r.maxMs=Math.max(r.maxMs,ms);r.lastMs=ms;r.samples.push(ms);if(r.samples.length>128)r.samples.shift();}
 measure<T>(name:string,fn:()=>T):T{if(!this.active)return fn();const start=performance.now();try{return fn();}finally{this.record(name,performance.now()-start);}}
 total(name:string){return this.rows[name]?.totalMs??0;}
 last(name:string){return this.rows[name]?.lastMs??0;}
 report(){return {version:'AI-PERF-007',inputSemantics:'event timestamp -> capture; capture -> RAF callback, NOT handler completion or presentation; timestamp origin assumed, range checked only',inputs:structuredClone(this.inputs),droppedInputs:this.droppedInputs,visibilityChanges:this.visibilityChanges,active:this.active,generation:this.generation,visibility:typeof document==='undefined'?'worker':document.visibilityState,supported:this.supported,stages:structuredClone(this.rows)};}
 private install(){
  if(this.installed||typeof document==='undefined')return;this.installed=true;
  if(typeof PerformanceObserver!=='undefined'){
   this.supported=[...PerformanceObserver.supportedEntryTypes];
   if(this.supported.includes('longtask'))new PerformanceObserver(list=>{for(const e of list.getEntries())if(e.startTime>=this.startedAt)this.record('mainLongTask',e.duration);}).observe({type:'longtask',buffered:false});
  }
  document.addEventListener('visibilitychange',()=>{if(this.active)this.visibilityChanges++;},{passive:true});
  for(const type of ['pointermove','wheel','click'])document.addEventListener(type,event=>{
   if(!this.active)return;
   const el=event.target instanceof Element?event.target:null;
   const control=el?.closest('button')?.id;
   // Button intent is a click, not hover or pointerup. Restrict gestures to the map.
   const name=type==='click'?(control==='ai-exit'||control==='restart-button'?'exit':control==='ai-takeover'?'takeover':control?.startsWith('zoom-')?'zoom':'other'):
    el?.closest('#map-wrap')?(type==='wheel'?'zoom':type==='pointermove'&&'buttons' in event&&event.buttons?'drag':'other'):'other';
   if(name==='other')return;
   // Bound diagnostic work even when RAF is suspended. Never delay game handlers.
   if(this.pending.length>=32){this.droppedInputs++;return;}
   const start=performance.now(),delta=start-event.timeStamp,epoch=this.generation;
   const sample:InputSample={id:++this.nextInput,type,name,eventTimeStamp:event.timeStamp,captureNow:start,timeOrigin:performance.timeOrigin,
    trusted:event.isTrusted,visibilityAtCapture:document.visibilityState,visibilityChanges:this.visibilityChanges,
    timestampToCaptureMs:Number.isFinite(delta)&&delta>=0&&delta<60000?delta:null,handlerCompletion:'unmeasured',status:'pending'};
   this.inputs.push(sample);if(this.inputs.length>128)this.inputs.shift();
   this.pending.push(sample);if(this.pending.length>1)return;
   requestAnimationFrame(timestamp=>{
    if(epoch!==this.generation||!this.active)return;
    const end=performance.now(),batch=this.pending;this.pending=[];
    for(const item of batch){
     item.status='raf';item.rafTimeStamp=timestamp;item.rafCallbackNow=end;item.captureToRafCallbackMs=end-item.captureNow;
     item.visibilityAtRAF=document.visibilityState;item.visibilityChanged=item.visibilityChanges!==this.visibilityChanges;
    }
   });
  },{capture:true,passive:true});
 }
}
export const perf006=new LocalPerformance();
