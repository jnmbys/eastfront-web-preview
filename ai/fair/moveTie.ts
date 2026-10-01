import type {FairIntent} from './types.js';
/** Reorder only MOVE slots within an exactly equal primary-score group.
 * Other action slots stay fixed; equal endpoint distances keep the original
 * stable order (including the existing agentOrder tie breaker). */
export function prioritizeMoveTies<T extends {a:FairIntent;score:number}>(
  ranked:readonly T[],distance:(a:Extract<FairIntent,{type:'MOVE'}>)=>number,
):T[]{
  const out=[...ranked];
  for(let first=0;first<out.length;){
    let end=first+1;while(end<out.length&&out[end]!.score===out[first]!.score)end++;
    const slots:number[]=[];for(let i=first;i<end;i++)if(out[i]!.a.type==='MOVE')slots.push(i);
    if(slots.length>1){
      const moves=slots.map(i=>({entry:out[i]!,i,d:distance(out[i]!.a as Extract<FairIntent,{type:'MOVE'}>)}))
        .sort((a,b)=>a.d-b.d||a.i-b.i);
      for(let n=0;n<slots.length;n++)out[slots[n]!] = moves[n]!.entry;
    }
    first=end;
  }
  return out;
}
