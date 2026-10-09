// Authorized document diff. Default arrays are atomic; release mode also diffs equal-length array fields.
export function canonical(x){if(Array.isArray(x))return '['+x.map(canonical).join(',')+']';if(x&&typeof x==='object')return '{'+Object.keys(x).sort().map(k=>JSON.stringify(k)+':'+canonical(x[k])).join(',')+'}';return JSON.stringify(x);}
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
// Compare authorized JSON trees once. Re-serializing every ancestor/subtree made
// a tiny clock delta cost more CPU than the entire snapshot projection.
function equal(a,b){
 if(a===b)return true;
 if(Array.isArray(a)&&Array.isArray(b))return a.length===b.length&&a.every((v,i)=>equal(v,b[i]));
 if(object(a)&&object(b)){const keys=Object.keys(a);return keys.length===Object.keys(b).length&&keys.every(k=>Object.hasOwn(b,k)&&equal(a[k],b[k]));}
 return false;
}
export function diff(before,after,path=[],out={set:[],remove:[]},arrays=false){
 if(before===after)return out;
 if(arrays&&Array.isArray(before)&&Array.isArray(after)&&before.length===after.length){
  const small={set:[],remove:[]};for(let i=0;i<after.length;i++)diff(before[i],after[i],[...path,String(i)],small,true);
  if(!small.set.length&&!small.remove.length)return out;
  const whole={path,value:after};if(JSON.stringify(small).length<JSON.stringify(whole).length){out.set.push(...small.set);out.remove.push(...small.remove);}else out.set.push(whole);return out;
 }
 if(object(before)&&object(after)){
  for(const k of Object.keys(before))if(!Object.hasOwn(after,k))out.remove.push([...path,k]);
  for(const k of Object.keys(after))diff(before[k],after[k],[...path,k],out,arrays);
 }else if(!equal(before,after))out.set.push({path,value:after});return out;
}
export function patch(before,change){
 // Copy only changed ancestors. Previous authorized versions remain immutable;
 // all dependent deltas are applied in sequence, never dropped for rendering.
 const clone=x=>Array.isArray(x)?x.slice():object(x)?{...x}:x;
 let next=clone(before);const owned=new WeakSet();if(next&&typeof next==='object')owned.add(next);
 const safe=k=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('UNSAFE_PATH');};
 const locate=path=>{let p=next;for(const k of path){safe(k);if(!(object(p)||Array.isArray(p)&&/^(0|[1-9]\d*)$/.test(k))||!Object.hasOwn(p,k))throw Error('PATCH_BASE_MISSING');let child=p[k];if(child&&typeof child==='object'&&!owned.has(child)){child=clone(child);p[k]=child;owned.add(child);}p=child;}return p;};
 for(const path of change.remove){if(!path.length)throw Error('ROOT_DELETE');path.forEach(safe);const p=locate(path.slice(0,-1));delete p[path.at(-1)];}
 for(const {path,value}of change.set){path.forEach(safe);if(!path.length){next=structuredClone(value);if(next&&typeof next==='object')owned.add(next);}else locate(path.slice(0,-1))[path.at(-1)]=structuredClone(value);}return next;
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
