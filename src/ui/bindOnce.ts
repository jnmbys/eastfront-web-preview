// Retained controls may be rebound to a newer authorized view. Replace only the
// handler at this call site; distinct behaviors on the same element are retained.
const bindings=new WeakMap<EventTarget,Map<string,{type:string;fn:EventListener;capture:boolean}>>();
export function bindOnce<K extends keyof HTMLElementEventMap>(site:string,target:EventTarget|null|undefined,type:K,fn:(event:HTMLElementEventMap[K])=>void,options?:boolean|AddEventListenerOptions):void{
 if(!target)return;let map=bindings.get(target);if(!map)bindings.set(target,map=new Map());
 const old=map.get(site);if(old)target.removeEventListener(old.type,old.fn,old.capture);
 const capture=typeof options==='boolean'?options:!!options?.capture;
 target.addEventListener(type,fn as EventListener,options);map.set(site,{type,fn:fn as EventListener,capture});
}
