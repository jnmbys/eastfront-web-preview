/** Bounded versioned decoded image cache. Active leases survive disposal until released. */
export interface LeaseImage {source:CanvasImageSource;width:number;height:number;release?:()=>void;}
export class ImageLeaseCache {
 private entries=new Map<string,{image:LeaseImage;refs:number;bytes:number;cached:boolean}>();private pending=new Map<string,Promise<any>>();private closed=false;
 readonly stats={hits:0,loads:0,bytes:0,peakBytes:0,entries:0};
 constructor(readonly version:string,readonly maxBytes=32*1024*1024,readonly maxEntries=40){}
 private evict(){for(const [key,row] of this.entries){if(this.stats.bytes<=this.maxBytes&&this.entries.size<=this.maxEntries)break;if(row.refs)continue;this.entries.delete(key);this.stats.bytes-=row.bytes;row.cached=false;row.image.release?.();}this.stats.entries=this.entries.size;}
 async acquire(key:string,load:()=>Promise<LeaseImage>):Promise<LeaseImage>{key=this.version+':'+key;let row=this.entries.get(key);if(row){this.stats.hits++;this.entries.delete(key);this.entries.set(key,row);}else{let p=this.pending.get(key);if(p)this.stats.hits++;else{this.stats.loads++;p=load().then(image=>{const r={image,refs:0,bytes:image.width*image.height*4,cached:!this.closed};if(r.cached){this.entries.set(key,r);this.stats.bytes+=r.bytes;}return r;}).finally(()=>this.pending.delete(key));this.pending.set(key,p);}row=await p;}
 row!.refs++;this.evict();this.stats.peakBytes=Math.max(this.stats.peakBytes,this.stats.bytes);let released=false;const leased=row!;
 return {...leased.image,release:()=>{if(released)return;released=true;leased.refs--;if(!leased.cached&&leased.refs===0)leased.image.release?.();this.evict();}};
 }
 dispose(){this.closed=true;for(const row of this.entries.values()){row.cached=false;if(!row.refs)row.image.release?.();}this.entries.clear();this.stats.bytes=0;this.stats.entries=0;}
}
