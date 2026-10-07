// Transport-neutral authorized document diff. Arrays are atomic; entities use stable object keys.
export function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
export function diff(before,after,path=[],out={set:[],remove:[]}){
 if(canonical(before)===canonical(after))return out;
 if(object(before)&&object(after)){
  for(const k of Object.keys(before))if(!Object.hasOwn(after,k))out.remove.push([...path,k]);
  for(const k of Object.keys(after))diff(before[k],after[k],[...path,k],out);
 }else out.set.push({path,value:after});return out;
}
export function patch(before,change){let next=structuredClone(before);const locate=path=>{let p=next;for(const k of path){if(['__proto__','constructor','prototype'].includes(k))throw Error('UNSAFE_PATH');if(!object(p)||!Object.hasOwn(p,k))throw Error('PATCH_BASE_MISSING');p=p[k];}return p;};
 for(const path of change.remove){if(!path.length)throw Error('ROOT_DELETE');const p=locate(path.slice(0,-1));delete p[path.at(-1)];}
 for(const {path,value} of change.set){if(path.some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error('UNSAFE_PATH');if(!path.length)next=structuredClone(value);else locate(path.slice(0,-1))[path.at(-1)]=structuredClone(value);}return next;
}
// One FIFO in each WS direction: latency is injected before app delivery / ws.send, never arbitrary reorder.
export class OrderedLink{
 constructor(profile,deliver,onOverflow=()=>{}){this.profile=profile;this.deliver=deliver;this.onOverflow=onOverflow;this.jobs=[];this.bytes=0;this.tail=0;this.closed=false;this.counter=0;this.metrics={messages:0,bytes:0,peakMessages:0,peakBytes:0};}
 send(text){if(this.closed)return false;const bytes=new TextEncoder().encode(text).length;if(this.jobs.length>=128||this.bytes+bytes>2*1024*1024){this.onOverflow();return false;}
  const now=performance.now(),p=this.profile,jitter=p.jitter?Math.sin(++this.counter*2.31)*p.jitter:0;
  const at=Math.max(now+Math.max(0,p.rtt/2+jitter),this.tail)+(p.bytesPerSecond?bytes/p.bytesPerSecond*1000:0);this.tail=at;this.bytes+=bytes;
  const job={bytes,timer:null};job.timer=setTimeout(()=>{this.jobs.shift();this.bytes-=bytes;if(!this.closed)this.deliver(text);},Math.max(0,at-now));this.jobs.push(job);
  this.metrics.messages++;this.metrics.bytes+=bytes;this.metrics.peakMessages=Math.max(this.metrics.peakMessages,this.jobs.length);this.metrics.peakBytes=Math.max(this.metrics.peakBytes,this.bytes);return true;
 }
 close(){this.closed=true;for(const j of this.jobs)clearTimeout(j.timer);this.jobs=[];this.bytes=0;}
}
