// Preview-only opt-in observability. No game state or action interception.
const enabled=new URLSearchParams(location.search).get('aiPerf')==='1';
let panel,output,active=false,generation=0,thinking=false;
let data={};
const fresh=()=>({version:'AI-PREVIEW-002',strategy:'AI-005',source:'695ca0524eb039808491b18c69cea1fb74da0cca',workerStarted:0,workerSteps:0,policyCalls:0,policyTotalMs:0,policyMaxMs:0,policyLastMs:0,workerStepMaxMs:0,longTaskSupported:typeof PerformanceObserver==='function'&&(PerformanceObserver.supportedEntryTypes?.includes('longtask')??false),longTasks:0,longTaskMaxMs:0,thinkingLongTasks:0,thinkingLongTaskMaxMs:0,rafGapMaxMs:0,thinkingRafGapMaxMs:0,interactionSamples:0,interactionMaxMs:0,thinkingInteractionSamples:0,thinkingInteractionMaxMs:0,stopped:false});
data=fresh();
function render(){if(output)output.textContent=JSON.stringify(data,null,2);}
if(enabled){
 panel=document.createElement('details');panel.id='ai-preview-performance';panel.style.cssText='position:fixed;right:8px;bottom:8px;z-index:99999;max-height:45vh;max-width:430px;overflow:auto;background:#fff;color:#111;border:1px solid #555;padding:6px;font:12px monospace';
 const title=document.createElement('summary');title.textContent='AI-005 性能诊断（毫秒）';panel.append(title);output=document.createElement('pre');output.setAttribute('aria-label','AI-005 性能数据');panel.append(output);
 document.body.append(panel);render();
 if(data.longTaskSupported)new PerformanceObserver(list=>{for(const entry of list.getEntries()){if(!active)continue;data.longTasks++;data.longTaskMaxMs=Math.max(data.longTaskMaxMs,entry.duration);if(thinking){data.thinkingLongTasks++;data.thinkingLongTaskMaxMs=Math.max(data.thinkingLongTaskMaxMs,entry.duration);}}render();}).observe({type:'longtask',buffered:false});
 let last=performance.now();const frame=now=>{if(active){const gap=now-last;data.rafGapMaxMs=Math.max(data.rafGapMaxMs,gap);if(thinking)data.thinkingRafGapMaxMs=Math.max(data.thinkingRafGapMaxMs,gap);}last=now;requestAnimationFrame(frame);};requestAnimationFrame(frame);
 for(const type of ['pointerup','wheel','click'])document.addEventListener(type,event=>{
  if(!active||panel.contains(event.target))return;const start=performance.now(),wasThinking=thinking,epoch=generation;
  requestAnimationFrame(()=>{if(epoch!==generation)return;const ms=performance.now()-start;data.interactionSamples++;data.interactionMaxMs=Math.max(data.interactionMaxMs,ms);if(wasThinking){data.thinkingInteractionSamples++;data.thinkingInteractionMaxMs=Math.max(data.thinkingInteractionMaxMs,ms);}render();});
 },{capture:true,passive:true});
}
export function attachPreviewPerf(worker){
 if(!enabled)return worker;
 generation++;active=true;thinking=false;data=fresh();data.workerStarted=1;render();
 const epoch=generation;
 worker.addEventListener('message',event=>{
  if(epoch!==generation||!active)return;const m=event.data;
  if(m.kind==='AI_PREVIEW_PERF'){
   data.workerSteps++;data.policyCalls=m.policy.count;data.policyTotalMs=m.policy.totalMs;data.policyMaxMs=m.policy.maxMs;data.policyLastMs=m.policy.lastMs;data.workerStepMaxMs=Math.max(data.workerStepMaxMs,m.workerStepMs);render();
  }else if(m.meta){thinking=!m.meta.paused&&!m.meta.manual&&m.meta.ownerSide!==m.meta.humanSide;}
 });
 const terminate=worker.terminate.bind(worker);worker.terminate=()=>{if(epoch===generation){active=false;thinking=false;data.stopped=true;render();}terminate();};
 return worker;
}
